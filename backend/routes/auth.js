const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const Joi = require('joi');
const axios = require('axios');

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

        // Generate username from email prefix (e.g., rick.vandervoort@student.hu.nl → rick.vandervoort)
        const username = email.split('@')[0];

        // Check if email is already registered
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ 
                error: 'This email is already registered' 
            });
        }

        // Check if username is already taken
        const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsername) {
            return res.status(409).json({ 
                error: 'Username already exists. Please contact support.' 
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

        // Store pending registration with username
        await db.run(
            `INSERT INTO pending_registrations (email, username, verification_code, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [email, username, verificationCode, expiresAt.toISOString()]
        );

        // Send verification email
        if (!req.app.locals.emailService) {
            throw new Error('Email service not initialized');
        }
        await req.app.locals.emailService.sendVerificationEmail(email, verificationCode);

        res.json({ 
            message: 'Verification code sent to your HU email address. Please check your inbox.',
            email: email,
            username: username
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify registration code and create user account
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

        // Check if user account already created
        if (pending.user_created) {
            return res.json({ 
                message: 'Email already verified. You can now log in with GitHub.',
                verified: true,
                username: pending.username
            });
        }

        // Create user account
        const result = await db.run(
            `INSERT INTO users (username, email, email_verified) 
             VALUES (?, ?, TRUE)`,
            [pending.username, pending.email]
        );

        // Mark pending registration as completed
        await db.run(
            'UPDATE pending_registrations SET verified = TRUE, user_created = TRUE WHERE id = ?',
            [pending.id]
        );

        res.json({ 
            message: 'Email verified successfully! Your account has been created. You can now log in with GitHub.',
            verified: true,
            username: pending.username,
            userId: result.lastID
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
});

// GitHub Device Flow - Step 1: Get device code
router.post('/github/device', async (req, res) => {
    try {
        const response = await axios.post('https://github.com/login/device/code', 
            new URLSearchParams({
                client_id: process.env.GITHUB_CLIENT_ID,
                scope: 'user:email read:org'
            }),
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const data = response.data;
        
        if (data.error) {
            return res.status(400).json({ error: data.error_description || 'Failed to get device code' });
        }

        // Store device_code in session for polling
        req.session.device_code = data.device_code;
        req.session.device_code_expires = Date.now() + (data.expires_in * 1000);

        res.json({
            user_code: data.user_code,
            verification_uri: data.verification_uri,
            expires_in: data.expires_in,
            interval: data.interval || 5
        });
    } catch (error) {
        console.error('Device flow initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate device flow' });
    }
});

// GitHub Device Flow - Step 2: Poll for authorization
router.post('/github/device/poll', async (req, res) => {
    try {
        const device_code = req.session.device_code;
        const expires_at = req.session.device_code_expires;

        if (!device_code) {
            return res.status(400).json({ error: 'No device code found. Please restart the flow.' });
        }

        if (Date.now() > expires_at) {
            delete req.session.device_code;
            delete req.session.device_code_expires;
            return res.status(400).json({ error: 'Device code expired. Please restart the flow.' });
        }

        const response = await axios.post('https://github.com/login/oauth/access_token',
            new URLSearchParams({
                client_id: process.env.GITHUB_CLIENT_ID,
                device_code: device_code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            }),
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const data = response.data;

        if (data.error) {
            if (data.error === 'authorization_pending') {
                return res.json({ status: 'pending' });
            } else if (data.error === 'slow_down') {
                return res.json({ status: 'slow_down' });
            } else if (data.error === 'expired_token') {
                delete req.session.device_code;
                delete req.session.device_code_expires;
                return res.status(400).json({ error: 'Device code expired. Please restart the flow.' });
            } else {
                return res.status(400).json({ error: data.error_description || 'Authorization failed' });
            }
        }

        // Success! We have an access token
        const access_token = data.access_token;
        
        // Get user info from GitHub
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/json'
            }
        });

        const emailResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/json'
            }
        });

        const githubUser = userResponse.data;
        const githubEmails = emailResponse.data;

        // Process the GitHub authentication (same logic as callback)
        await processGitHubAuth(req, res, githubUser, githubEmails);

    } catch (error) {
        console.error('Device flow polling error:', error);
        res.status(500).json({ error: 'Failed to poll authorization status' });
    }
});

// Helper function for GitHub authentication processing
async function processGitHubAuth(req, res, githubUser, githubEmails) {
    try {
        const db = req.app.locals.db;
        
        const githubId = githubUser.id;
        const githubUsername = githubUser.login;
        
        // Check if this GitHub account is already linked to another user
        const existingGithubUser = await db.get(
            'SELECT * FROM users WHERE github_id = ?',
            [githubId]
        );
        
        if (existingGithubUser) {
            // GitHub account is already linked, log them in
            await db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [existingGithubUser.id]
            );
            
            // Store user in session
            req.session.user = existingGithubUser;
            
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            // Check if this is their first completed login
            const redirectPath = !existingGithubUser.first_login_completed 
                ? `/setup/study-direction?userId=${existingGithubUser.id}`
                : '/dashboard';
            
            return res.json({ 
                status: 'success', 
                user: existingGithubUser,
                redirect: redirectPath
            });
        }

        // Find HU email in GitHub emails and match with verified user account
        let matchedUser = null;
        let huEmail = null;

        for (const emailObj of githubEmails) {
            const email = emailObj.email;
            if (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) {
                // Check if this HU email has a verified user account
                matchedUser = await db.get(
                    'SELECT * FROM users WHERE email = ? AND email_verified = TRUE',
                    [email]
                );
                if (matchedUser) {
                    huEmail = email;
                    break;
                }
            }
        }

        if (!matchedUser) {
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            return res.status(400).json({ 
                error: 'no_verified_email',
                message: 'No verified HU email found in your GitHub account. Please register first with your HU email.'
            });
        }

        if (matchedUser.github_linked) {
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            return res.status(400).json({ 
                error: 'github_already_linked',
                message: 'This user account already has a GitHub account linked.'
            });
        }

        // Link GitHub account to the verified user account
        await db.run(
            `UPDATE users SET 
             github_id = ?, 
             github_username = ?, 
             github_email = ?, 
             github_linked = TRUE,
             last_login = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [githubId, githubUsername, githubEmails.find(e => e.primary)?.email || githubEmails[0]?.email, matchedUser.id]
        );

        // Get updated user
        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [matchedUser.id]);
        
        // Store user in session
        req.session.user = updatedUser;

        // Clean up any pending registrations for this email
        await db.run(
            'DELETE FROM pending_registrations WHERE email = ?',
            [huEmail]
        );

        // Clean up device flow session
        delete req.session.device_code;
        delete req.session.device_code_expires;

        // Check if this is their first completed login
        const redirectPath = !matchedUser.first_login_completed 
            ? `/setup/study-direction?userId=${matchedUser.id}`
            : '/dashboard';

        res.json({ 
            status: 'success', 
            user: updatedUser,
            redirect: redirectPath
        });

    } catch (error) {
        console.error('GitHub auth processing error:', error);
        res.status(500).json({ error: 'Failed to process GitHub authentication' });
    }
}

// Legacy OAuth redirect (keeping for backwards compatibility)
router.get('/github', passport.authenticate('github', { 
    scope: ['user:email', 'read:org'] 
}));

// GitHub OAuth callback - Legacy flow (keeping for backwards compatibility)
router.get('/github/callback', 
    passport.authenticate('github', { failureRedirect: '/login?error=oauth_failed' }),
    async (req, res) => {
        try {
            const db = req.app.locals.db;
            const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
            
            const githubProfile = req.user;
            const githubId = githubProfile.id;
            const githubUsername = githubProfile.username;
            const githubEmails = githubProfile.emails || [];
            
            // Check if this GitHub account is already linked to another user
            const existingGithubUser = await db.get(
                'SELECT * FROM users WHERE github_id = ?',
                [githubId]
            );
            
            if (existingGithubUser) {
                // GitHub account is already linked, log them in
                await db.run(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [existingGithubUser.id]
                );
                
                // Check if this is their first completed login (for study direction selection)
                if (!existingGithubUser.first_login_completed) {
                    return res.redirect(`${frontend}/setup/study-direction?userId=${existingGithubUser.id}`);
                }
                
                return res.redirect(`${frontend}/dashboard`);
            }

            // Find HU email in GitHub emails and match with verified user account
            let matchedUser = null;
            let huEmail = null;

            for (const emailObj of githubEmails) {
                const email = emailObj.value;
                if (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) {
                    // Check if this HU email has a verified user account
                    matchedUser = await db.get(
                        'SELECT * FROM users WHERE email = ? AND email_verified = TRUE',
                        [email]
                    );
                    if (matchedUser) {
                        huEmail = email;
                        break;
                    }
                }
            }

            if (!matchedUser) {
                // No verified HU email found in GitHub account
                return res.redirect(`${frontend}/login?error=no_verified_email`);
            }

            if (matchedUser.github_linked) {
                // This user account already has a GitHub account linked
                return res.redirect(`${frontend}/login?error=github_already_linked`);
            }

            // Link GitHub account to the verified user account
            await db.run(
                `UPDATE users SET 
                 github_id = ?, 
                 github_username = ?, 
                 github_email = ?, 
                 github_linked = TRUE,
                 last_login = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [githubId, githubUsername, githubEmails.find(e => e.primary)?.value || githubEmails[0]?.value, matchedUser.id]
            );

            // Clean up any pending registrations for this email
            await db.run(
                'DELETE FROM pending_registrations WHERE email = ?',
                [huEmail]
            );

            // Check if this is their first completed login (for study direction selection)
            if (!matchedUser.first_login_completed) {
                return res.redirect(`${frontend}/setup/study-direction?userId=${matchedUser.id}`);
            }

            // Successful GitHub linking and login
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

// Set study direction on first login
router.post('/setup/study-direction', async (req, res) => {
    try {
        const { userId, studyDirection } = req.body;
        
        if (!userId || !studyDirection) {
            return res.status(400).json({ error: 'User ID and study direction are required' });
        }

        // Validate study direction
        const validDirections = ['TI', 'CSC', 'SD', 'OPENICT', 'AI'];
        if (!validDirections.includes(studyDirection)) {
            return res.status(400).json({ 
                error: 'Invalid study direction. Must be one of: TI, CSC, SD, OPENICT, AI' 
            });
        }

        const db = req.app.locals.db;

        // Update user with study direction and mark first login as completed
        const result = await db.run(
            `UPDATE users SET 
             study_direction = ?, 
             first_login_completed = TRUE 
             WHERE id = ?`,
            [studyDirection, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log the study direction setup
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                userId,
                'study_direction_set',
                `Study direction set to: ${studyDirection}`,
                req.ip
            ]
        );

        res.json({ 
            success: true, 
            message: 'Study direction set successfully',
            studyDirection: studyDirection
        });

    } catch (error) {
        console.error('Study direction setup error:', error);
        res.status(500).json({ error: 'Failed to set study direction' });
    }
});

// Get current user info
router.get('/user', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const user = await db.get(
            `SELECT id, username, email, email_verified, github_id, github_username, 
                    github_linked, study_direction, is_admin, created_at, last_login,
                    first_login_completed
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

// Admin endpoint to clear pending registrations (for development/testing)
router.delete('/admin/clear-pending', async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.app.locals.db;

        if (email) {
            // Clear specific email
            const result = await db.run(
                'DELETE FROM pending_registrations WHERE email = ?',
                [email]
            );
            res.json({ 
                success: true, 
                message: `Cleared pending registration for ${email}`,
                deletedCount: result.changes 
            });
        } else {
            // Clear all pending registrations
            const result = await db.run('DELETE FROM pending_registrations');
            res.json({ 
                success: true, 
                message: 'Cleared all pending registrations',
                deletedCount: result.changes 
            });
        }
    } catch (error) {
        console.error('Clear pending registrations error:', error);
        res.status(500).json({ error: 'Failed to clear pending registrations' });
    }
});

module.exports = router;
