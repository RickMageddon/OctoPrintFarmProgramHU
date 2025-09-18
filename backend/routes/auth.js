const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const emailSchema = Joi.object({
    email: Joi.string().email().required().pattern(/@(student\.)?hu\.nl$/)
});

const verificationSchema = Joi.object({
    token: Joi.string().required(),
    code: Joi.string().length(6).required()
});

const registrationSchema = Joi.object({
    email: Joi.string().email().required().pattern(/@(student\.)?hu\.nl$/)
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check if user has verified HU email
const requireVerifiedEmail = (req, res, next) => {
    if (req.user && req.user.email_verified) {
        return next();
    }
    res.status(403).json({ error: 'HU email verification required' });
};

// Pre-registration: Submit HU email for verification before GitHub OAuth
router.post('/register', async (req, res) => {
    try {
        const { error, value } = registrationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Invalid email. Must be @hu.nl or @student.hu.nl' 
            });
        }

        const { email } = value;
        const db = req.app.locals.db;

        // Check if email is already registered or pending
        const existingUser = await db.get('SELECT id FROM users WHERE hu_email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ 
                error: 'This HU email is already registered' 
            });
        }

        const existingPending = await db.get('SELECT id FROM pending_registrations WHERE email = ? AND verified = FALSE', [email]);
        if (existingPending) {
            return res.status(409).json({ 
                error: 'This email already has a pending registration. Check your inbox or wait for expiration.' 
            });
        }

        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        // Store pending registration
        await db.run(
            `INSERT INTO pending_registrations (email, verification_code, expires_at) 
             VALUES (?, ?, ?)`,
            [email, verificationCode, expiresAt.toISOString()]
        );

        // Send verification email
        await req.app.locals.emailService.sendVerificationEmail(email, verificationCode);

        res.json({ 
            message: 'Verification code sent to your HU email address. Please check your inbox.',
            email: email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify registration code
router.post('/verify-registration', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }

        const db = req.app.locals.db;

        // Find pending registration
        const pending = await db.get(
            'SELECT * FROM pending_registrations WHERE email = ? AND verification_code = ?',
            [email, code]
        );

        if (!pending) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Check if expired
        if (new Date() > new Date(pending.expires_at)) {
            await db.run('DELETE FROM pending_registrations WHERE id = ?', [pending.id]);
            return res.status(400).json({ error: 'Verification code has expired. Please register again.' });
        }

        // Mark as verified
        await db.run(
            'UPDATE pending_registrations SET verified = TRUE WHERE id = ?',
            [pending.id]
        );

        res.json({ 
            message: 'Email verified successfully! You can now log in with GitHub.',
            verified: true
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
});

// Start GitHub OAuth
router.get('/github', passport.authenticate('github', { 
    scope: ['user:email', 'read:org'] 
}));

// GitHub OAuth callback
router.get('/github/callback', 
    passport.authenticate('github', { failureRedirect: '/login?error=oauth_failed' }),
    async (req, res) => {
        try {
            const db = req.app.locals.db;
            const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';

            // Check if user has a verified pre-registration
            const githubEmails = req.user.emails || [];
            let verifiedRegistration = null;

            for (const emailObj of githubEmails) {
                const email = emailObj.value;
                if (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) {
                    verifiedRegistration = await db.get(
                        'SELECT * FROM pending_registrations WHERE email = ? AND verified = TRUE',
                        [email]
                    );
                    if (verifiedRegistration) {
                        // Update user with verified HU email
                        await db.run(
                            'UPDATE users SET hu_email = ?, email_verified = TRUE WHERE id = ?',
                            [email, req.user.id]
                        );
                        
                        // Clean up pending registration
                        await db.run(
                            'DELETE FROM pending_registrations WHERE id = ?',
                            [verifiedRegistration.id]
                        );
                        break;
                    }
                }
            }

            if (!verifiedRegistration) {
                // User didn't pre-register with HU email
                return res.redirect(`${frontend}/login?error=no_registration`);
            }

            // Successful authentication with verified HU email
            res.redirect(`${frontend}/dashboard`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontend}/login?error=server_error`);
        }
    }
);

// Submit HU email for verification
router.post('/verify-email', requireAuth, async (req, res) => {
    try {
        const { error, value } = emailSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Invalid email. Must be @hu.nl or @student.hu.nl' 
            });
        }

        const { email } = value;
        const db = req.app.locals.db;
        const emailService = req.app.locals.emailService;

        // Generate verification token and code
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Update user with HU email and verification token
        await db.run(
            `UPDATE users SET 
             hu_email = ?, 
             verification_token = ?, 
             email_verified = FALSE 
             WHERE id = ?`,
            [email, verificationToken, req.user.id]
        );

        // Send verification email
        await emailService.sendVerificationEmail(email, verificationCode, req.user.username);

        // Store verification code in session (expires in 10 minutes)
        req.session.verificationCode = verificationCode;
        req.session.verificationExpiry = Date.now() + (10 * 60 * 1000);

        res.json({ 
            success: true, 
            message: 'Verification email sent',
            token: verificationToken
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify email with code
router.post('/verify-code', requireAuth, async (req, res) => {
    try {
        const { error, value } = verificationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: 'Invalid verification data' });
        }

        const { token, code } = value;
        const db = req.app.locals.db;

        // Check if verification code is valid and not expired
        if (!req.session.verificationCode || 
            !req.session.verificationExpiry || 
            Date.now() > req.session.verificationExpiry) {
            return res.status(400).json({ error: 'Verification code expired' });
        }

        if (req.session.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Verify token matches user
        const user = await db.get(
            'SELECT * FROM users WHERE id = ? AND verification_token = ?',
            [req.user.id, token]
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        // Mark email as verified
        await db.run(
            `UPDATE users SET 
             email_verified = TRUE, 
             verification_token = NULL 
             WHERE id = ?`,
            [req.user.id]
        );

        // Clear verification data from session
        delete req.session.verificationCode;
        delete req.session.verificationExpiry;

        // Log the verification
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'email_verified',
                `HU email verified: ${user.hu_email}`,
                req.ip
            ]
        );

        res.json({ 
            success: true, 
            message: 'Email verified successfully' 
        });

    } catch (error) {
        console.error('Code verification error:', error);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

// Get current user info
router.get('/user', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const user = await db.get(
            `SELECT id, github_id, username, email, hu_email, email_verified, 
                    is_admin, created_at, last_login 
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to destroy session' });
            }
            res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// Check authentication status
router.get('/status', (req, res) => {
    res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? {
            id: req.user.id,
            username: req.user.username,
            email_verified: req.user.email_verified,
            is_admin: req.user.is_admin
        } : null
    });
});

module.exports = router;
