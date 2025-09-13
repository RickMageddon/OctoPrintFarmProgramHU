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

// Start GitHub OAuth
router.get('/github', passport.authenticate('github', { 
    scope: ['user:email', 'read:org'] 
}));

// GitHub OAuth callback
router.get('/github/callback', 
    passport.authenticate('github', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
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
