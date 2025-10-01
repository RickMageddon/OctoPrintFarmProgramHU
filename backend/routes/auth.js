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
    console.log('🔐 Auth check:', {
        isAuthenticated: req.isAuthenticated(),
        hasSessionUser: !!req.session.user,
        passportUser: req.user ? req.user.email : 'none',
        sessionUser: req.session.user ? req.session.user.email : 'none'
    });
    
    // Check both Passport authentication and session user
    if (req.isAuthenticated() || req.session.user) {
        // Ensure req.user is set for consistency
        if (!req.user && req.session.user) {
            req.user = req.session.user;
        }
        return next();
    }
    
    console.log('❌ Authentication failed');
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
        console.log('🚀 Starting GitHub Device Flow');
        console.log('Session ID:', req.sessionID);
        
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
        console.log('GitHub device flow response:', data);
        
        if (data.error) {
            console.log('❌ GitHub device flow error:', data.error);
            return res.status(400).json({ error: data.error_description || 'Failed to get device code' });
        }

        // Store device_code in session for polling
        req.session.device_code = data.device_code;
        req.session.device_code_expires = Date.now() + (data.expires_in * 1000);
        
        console.log('✅ Device code stored in session');
        console.log('Device code expires at:', new Date(req.session.device_code_expires));

        res.json({
            user_code: data.user_code,
            verification_uri: data.verification_uri,
            expires_in: data.expires_in,
            interval: data.interval || 5
        });
    } catch (error) {
        console.error('❌ Device flow initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate device flow' });
    }
});

// GitHub Device Flow - Step 2: Poll for authorization
router.post('/github/device/poll', async (req, res) => {
    try {
        console.log('🔄 Device flow polling started');
        console.log('Session ID:', req.sessionID);
        
        const device_code = req.session.device_code;
        const expires_at = req.session.device_code_expires;

        console.log('Device code exists:', !!device_code);
        console.log('Expires at:', expires_at ? new Date(expires_at) : 'none');
        console.log('Current time:', new Date());

        if (!device_code) {
            console.log('❌ No device code found in session');
            return res.status(400).json({ error: 'No device code found. Please restart the flow.' });
        }

        if (Date.now() > expires_at) {
            console.log('❌ Device code expired');
            delete req.session.device_code;
            delete req.session.device_code_expires;
            return res.status(400).json({ error: 'Device code expired. Please restart the flow.' });
        }

        console.log('🔄 Polling GitHub for access token...');
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
        console.log('GitHub response:', data);

        if (data.error) {
            console.log('GitHub error:', data.error);
            if (data.error === 'authorization_pending') {
                console.log('⏳ Authorization still pending');
                return res.json({ status: 'pending' });
            } else if (data.error === 'slow_down') {
                console.log('⏳ Rate limited, slowing down');
                return res.json({ status: 'slow_down' });
            } else if (data.error === 'expired_token') {
                console.log('❌ Token expired');
                delete req.session.device_code;
                delete req.session.device_code_expires;
                return res.status(400).json({ error: 'Device code expired. Please restart the flow.' });
            } else {
                console.log('❌ Authorization failed:', data.error);
                return res.status(400).json({ error: data.error_description || 'Authorization failed' });
            }
        }

        // Success! We have an access token
        console.log('✅ Got access token from GitHub');
        const access_token = data.access_token;
        
        // Get user info from GitHub
        console.log('🔄 Fetching user info from GitHub...');
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

        console.log('GitHub user:', githubUser.login);
        console.log('GitHub emails:', githubEmails.map(e => e.email));

        // Process the GitHub authentication (same logic as callback)
        console.log('🔄 Processing GitHub authentication...');
        await processGitHubAuth(req, res, githubUser, githubEmails);

    } catch (error) {
        console.error('Device flow polling error:', error);
        res.status(500).json({ error: 'Failed to poll authorization status' });
    }
});

// Helper function for GitHub authentication processing
async function processGitHubAuth(req, res, githubUser, githubEmails) {
    try {
        console.log('🔄 Processing GitHub auth for user:', githubUser.login);
        const db = req.app.locals.db;
        
        const githubId = githubUser.id;
        const githubUsername = githubUser.login;
        
        // Check if this GitHub account is already linked to another user
        console.log('🔍 Checking if GitHub account is already linked...');
        const existingGithubUser = await db.get(
            'SELECT * FROM users WHERE github_id = ?',
            [githubId]
        );
        console.log('Existing GitHub user found:', !!existingGithubUser);
        
        if (existingGithubUser) {
            console.log('✅ GitHub account already linked, logging in existing user');
            
            // Auto-complete first login if user already has study direction
            let updateQuery = 'UPDATE users SET last_login = CURRENT_TIMESTAMP';
            let updateParams = [existingGithubUser.id];
            
            if (existingGithubUser.study_direction && !existingGithubUser.first_login_completed) {
                console.log('🔧 Auto-completing first login for user with existing study direction');
                updateQuery += ', first_login_completed = 1';
            }
            
            updateQuery += ' WHERE id = ?';
            await db.run(updateQuery, updateParams);
            
            // Get updated user data
            const updatedExistingUser = await db.get('SELECT * FROM users WHERE id = ?', [existingGithubUser.id]);
            
            // Store user in session
            req.session.user = updatedExistingUser;
            
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            // Check if this is their first completed login
            // Always redirect to dashboard, but indicate if study direction is missing
            const needsStudyDirection = !updatedExistingUser.study_direction;
            const redirectPath = '/dashboard';
            
            console.log('🚀 Sending success response with redirect:', redirectPath);
            return res.json({ 
                status: 'success', 
                user: updatedExistingUser,
                redirect: redirectPath,
                needsStudyDirection: needsStudyDirection
            });
        }

        // Find HU email in GitHub emails and match with verified user account
        console.log('🔍 Searching for HU email in GitHub emails...');
        let matchedUser = null;
        let huEmail = null;

        for (const emailObj of githubEmails) {
            const email = emailObj.email;
            console.log('Checking email:', email);
            if (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) {
                console.log('Found HU email:', email);
                // Check if this HU email has a verified user account
                matchedUser = await db.get(
                    'SELECT * FROM users WHERE email = ? AND email_verified = TRUE',
                    [email]
                );
                if (matchedUser) {
                    console.log('✅ Found matching verified user:', matchedUser.email);
                    huEmail = email;
                    break;
                } else {
                    console.log('❌ No verified user found for email:', email);
                }
            }
        }

        if (!matchedUser) {
            console.log('❌ No verified HU email found in GitHub account');
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            return res.status(400).json({ 
                error: 'no_verified_email',
                message: 'No verified HU email found in your GitHub account. Please register first with your HU email.'
            });
        }

        if (matchedUser.github_linked) {
            console.log('❌ User account already has GitHub linked');
            // Clean up device flow session
            delete req.session.device_code;
            delete req.session.device_code_expires;
            
            return res.status(400).json({ 
                error: 'github_already_linked',
                message: 'This user account already has a GitHub account linked.'
            });
        }

        // Link GitHub account to the verified user account
        console.log('🔗 Linking GitHub account to user:', matchedUser.email);
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
        console.log('Updated user:', updatedUser.email, 'github_linked:', updatedUser.github_linked);
        
        // Store user in session
        req.session.user = updatedUser;
        console.log('User stored in session');

        // Clean up any pending registrations for this email
        await db.run(
            'DELETE FROM pending_registrations WHERE email = ?',
            [huEmail]
        );

        // Clean up device flow session
        delete req.session.device_code;
        delete req.session.device_code_expires;

        // Check if this is their first completed login
        // Always redirect to dashboard, but indicate if study direction is missing
        const needsStudyDirection = !matchedUser.study_direction;
        const redirectPath = '/dashboard';

        console.log('🚀 Sending success response with redirect:', redirectPath);
        res.json({ 
            status: 'success', 
            user: updatedUser,
            redirect: redirectPath,
            needsStudyDirection: needsStudyDirection
        });

    } catch (error) {
        console.error('❌ GitHub auth processing error:', error);
        res.status(500).json({ error: 'Failed to process GitHub authentication' });
    }
}

// GitHub OAuth login - Direct login for existing users
router.get('/github', (req, res, next) => {
    try {
        console.log('🚀 Starting GitHub OAuth login');
        console.log('Session ID:', req.sessionID);
        console.log('Session data:', JSON.stringify(req.session, null, 2));
        
        // Check if required environment variables exist
        if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
            console.error('❌ GitHub OAuth credentials missing');
            return res.status(500).json({ 
                error: 'GitHub OAuth not configured properly' 
            });
        }
        
        // Check if passport strategy exists
        if (!passport._strategies.github) {
            console.error('❌ GitHub strategy not found');
            return res.status(500).json({ 
                error: 'GitHub authentication strategy not initialized' 
            });
        }
        
        console.log('✅ Starting GitHub OAuth authentication');
        passport.authenticate('github', { 
            scope: ['user:email', 'read:org'] 
        })(req, res, next);
        
    } catch (error) {
        console.error('❌ Error in GitHub OAuth route:', error);
        res.status(500).json({ 
            error: 'Failed to start GitHub authentication',
            message: error.message 
        });
    }
});

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
            
            // SCENARIO 1: Check if this GitHub account is already linked to a user (DIRECT LOGIN)
            const existingGithubUser = await db.get(
                'SELECT * FROM users WHERE github_id = ?',
                [githubId]
            );
            
            if (existingGithubUser) {
                console.log('✅ DIRECT LOGIN: GitHub account found, logging in user:', existingGithubUser.email);
                
                // Auto-complete first login if user already has study direction
                let updateQuery = 'UPDATE users SET last_login = CURRENT_TIMESTAMP';
                let updateParams = [existingGithubUser.id];
                
                if (existingGithubUser.study_direction && !existingGithubUser.first_login_completed) {
                    console.log('🔧 Auto-completing first login for user with existing study direction');
                    updateQuery += ', first_login_completed = 1';
                }
                
                updateQuery += ' WHERE id = ?';
                await db.run(updateQuery, updateParams);
                
                // Get updated user data
                const updatedExistingUser = await db.get('SELECT * FROM users WHERE id = ?', [existingGithubUser.id]);
                
                // Store user in session for login
                req.session.user = updatedExistingUser;
                console.log('User stored in session for direct login');
                
                // Check if this is their first completed login (for study direction selection)
                // Always redirect to dashboard, notification will be shown if needed
                const needsStudyDirection = !updatedExistingUser.study_direction;
                
                return res.redirect(`${frontend}/dashboard`);
            }

            // SCENARIO 2: GitHub account not linked yet - try to link to existing verified HU email user

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
                console.log('❌ REGISTRATION REQUIRED: No verified HU email found in GitHub account');
                console.log('GitHub emails found:', githubEmails.map(e => e.value));
                return res.redirect(`${frontend}/register?error=no_verified_email&message=Geen geverifieerd HU email gevonden. Registreer eerst met je HU email.`);
            }

            if (matchedUser.github_linked) {
                // This user account already has a GitHub account linked
                console.log('❌ CONFLICT: User account already has GitHub linked');
                return res.redirect(`${frontend}/login?error=github_already_linked&message=Dit HU email is al gekoppeld aan een ander GitHub account.`);
            }

            // SCENARIO 3: Link GitHub account to existing verified HU email user (FIRST TIME LINKING)
            console.log('🔗 FIRST TIME LINKING: GitHub account to user:', matchedUser.email);
            console.log('GitHub ID:', githubId, 'Username:', githubUsername);
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

            // Get the updated user with the linked GitHub info
            const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [matchedUser.id]);
            
            // Store user in session for login
            req.session.user = updatedUser;

            // Clean up any pending registrations for this email
            await db.run(
                'DELETE FROM pending_registrations WHERE email = ?',
                [huEmail]
            );

            // Check if this is their first completed login (for study direction selection)
            // Always redirect to dashboard, notification will be shown if needed
            const needsStudyDirection = !updatedUser.study_direction;

            // Successful GitHub linking and login
            res.redirect(`${frontend}/dashboard`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontend}/login?error=server_error`);
        }
    }
);

// DEBUG: Get all users (remove in production)
router.get('/debug/users', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const users = await db.all(`
            SELECT id, username, email, email_verified, github_id, github_username, 
                   github_linked, study_direction, created_at, last_login 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        console.log('📊 Current users in database:', users.length);
        users.forEach(user => {
            console.log(`- ${user.email} | GitHub: ${user.github_linked ? '✅' : '❌'} (ID: ${user.github_id || 'none'})`);
        });
        
        res.json({
            count: users.length,
            users: users.map(user => ({
                id: user.id,
                email: user.email,
                email_verified: !!user.email_verified,
                github_linked: !!user.github_linked,
                github_username: user.github_username,
                study_direction: user.study_direction,
                last_login: user.last_login
            }))
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

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
        console.log('📚 Study direction setup request:', req.body);
        const { userId, studyDirection } = req.body;
        
        if (!userId || !studyDirection) {
            console.error('❌ Missing userId or studyDirection:', { userId, studyDirection });
            return res.status(400).json({ error: 'User ID and study direction are required' });
        }

        // Validate study direction
        const validDirections = ['TI', 'CSC', 'SD', 'OPENICT', 'AI', 'BIM'];
        if (!validDirections.includes(studyDirection)) {
            console.error('❌ Invalid study direction:', studyDirection);
            return res.status(400).json({ 
                error: 'Invalid study direction. Must be one of: TI, CSC, SD, OPENICT, AI, BIM' 
            });
        }

        console.log('✅ Valid study direction setup request:', { userId, studyDirection });
        const db = req.app.locals.db;

        // Update user with study direction and mark first login as completed
        console.log('📝 Updating user with study direction...');
        const result = await db.run(
            `UPDATE users SET 
             study_direction = ?, 
             first_login_completed = 1 
             WHERE id = ?`,
            [studyDirection, userId]
        );

        console.log('📊 Update result:', result);
        if (result.changes === 0) {
            console.error('❌ User not found with ID:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('✅ User updated successfully');

        // Log the study direction setup (skip if session_logs table doesn't exist)
        try {
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
            console.log('✅ Session log created');
        } catch (logError) {
            console.warn('⚠️ Could not create session log (table may not exist):', logError.message);
            // Continue anyway - this is not critical
        }

        console.log('🎉 Study direction setup completed successfully');
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

// Test endpoint for study direction
router.get('/study-direction/test', (req, res) => {
    console.log('🧪 Study direction test endpoint called');
    res.json({ 
        success: true, 
        message: 'Study direction endpoint is reachable',
        authenticated: !!req.user,
        user: req.user || null
    });
});

// Set study direction for current authenticated user (simpler endpoint)
router.post('/study-direction', requireAuth, async (req, res) => {
    try {
        console.log('📚 Study direction update request for current user:', req.body);
        const { studyDirection } = req.body;
        
        if (!studyDirection) {
            console.error('❌ Missing studyDirection:', studyDirection);
            return res.status(400).json({ error: 'Study direction is required' });
        }

        // Validate study direction
        const validDirections = ['TI', 'CSC', 'SD', 'OPENICT', 'AI', 'BIM'];
        if (!validDirections.includes(studyDirection)) {
            console.error('❌ Invalid study direction:', studyDirection);
            return res.status(400).json({ 
                error: 'Invalid study direction. Must be one of: TI, CSC, SD, OPENICT, AI, BIM' 
            });
        }

        console.log('✅ Valid study direction update request:', { userId: req.user.id, studyDirection });
        const db = req.app.locals.db;

        // Update user with study direction and mark first login as completed
        console.log('📝 Updating current user with study direction...');
        const result = await db.run(
            `UPDATE users SET 
             study_direction = ?, 
             first_login_completed = 1 
             WHERE id = ?`,
            [studyDirection, req.user.id]
        );

        console.log('📊 Update result:', result);
        if (result.changes === 0) {
            console.error('❌ User not found with ID:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('✅ Current user updated successfully');

        // Log the study direction setup (skip if session_logs table doesn't exist)
        try {
            await db.run(
                `INSERT INTO session_logs (user_id, action, details, ip_address) 
                 VALUES (?, ?, ?, ?)`,
                [
                    req.user.id,
                    'study_direction_updated',
                    `Study direction updated to: ${studyDirection}`,
                    req.ip
                ]
            );
            console.log('✅ Session log created');
        } catch (logError) {
            console.warn('⚠️ Could not create session log (table may not exist):', logError.message);
            // Continue anyway - this is not critical
        }

        // Update session user data
        req.session.user.study_direction = studyDirection;
        req.session.user.first_login_completed = true;

        console.log('🎉 Study direction update completed successfully');
        res.json({ 
            success: true, 
            message: 'Study direction updated successfully',
            studyDirection: studyDirection
        });

    } catch (error) {
        console.error('Study direction update error:', error);
        res.status(500).json({ error: 'Failed to update study direction' });
    }
});

// Get current user info
router.get('/user', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const user = await db.get(
            `SELECT id, username, email, email_verified, github_id, github_username, 
                    github_linked, study_direction, is_admin, created_at, last_login,
                    first_login_completed, avatar_url
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
    console.log('🔍 Auth status check:', {
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        hasSession: !!req.session,
        sessionUser: req.session?.user ? req.session.user.email : 'none',
        userEmail: req.user ? req.user.email : 'none',
        sessionId: req.sessionID,
        cookies: req.headers.cookie ? 'present' : 'missing'
    });
    
    res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            email_verified: req.user.email_verified,
            is_admin: req.user.is_admin,
            study_direction: req.user.study_direction,
            avatar_url: req.user.avatar_url,
            created_at: req.user.created_at,
            last_login: req.user.last_login
        } : null
    });
});

// Fix users with study direction but not first_login_completed
router.post('/admin/fix-completed-logins', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        // Update users who have study_direction but first_login_completed is still false/null
        const result = await db.run(`
            UPDATE users 
            SET first_login_completed = 1 
            WHERE study_direction IS NOT NULL 
            AND study_direction != '' 
            AND (first_login_completed IS NULL OR first_login_completed = FALSE)
        `);
        
        console.log(`Fixed ${result.changes} users with completed logins`);
        
        res.json({
            success: true,
            message: `Fixed ${result.changes} users who already had study directions`,
            fixedCount: result.changes
        });
    } catch (error) {
        console.error('Error fixing completed logins:', error);
        res.status(500).json({ error: 'Failed to fix completed logins' });
    }
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

// Simple health check endpoint
router.get('/debug/health', (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        message: 'Backend is healthy'
    });
});

// Debug endpoint to check GitHub OAuth configuration
router.get('/debug/github-config', (req, res) => {
    try {
        console.log('🔍 GitHub config debug requested');
        
        const config = {
            github_client_id: process.env.GITHUB_CLIENT_ID ? 'SET' : 'NOT SET',
            github_client_secret: process.env.GITHUB_CLIENT_SECRET ? 'SET' : 'NOT SET',
            callback_url: `http://3dprinters:3001/api/auth/github/callback`,
            frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
            session_secret: process.env.SESSION_SECRET ? 'SET' : 'NOT SET'
        };
        
        console.log('✅ GitHub config debug successful');
        
        res.json({
            success: true,
            config: config,
            passport_strategies: Object.keys(passport._strategies || {}),
            timestamp: new Date().toISOString(),
            message: 'GitHub OAuth configuration status'
        });
    } catch (error) {
        console.error('❌ GitHub config debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to test email service
router.get('/debug/email-test', async (req, res) => {
    try {
        console.log('🧪 Testing email service...');
        
        // Check if email service is initialized
        if (!req.app.locals.emailService) {
            return res.json({ 
                success: false, 
                error: 'Email service not initialized',
                env_vars: {
                    EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
                    EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
                }
            });
        }
        
        // Test email service connection
        const connectionTest = await req.app.locals.emailService.testConnection();
        
        if (!connectionTest) {
            return res.json({ 
                success: false, 
                error: 'Email service connection failed',
                env_vars: {
                    EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
                    EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
                }
            });
        }
        
        // Try to send a test email
        await req.app.locals.emailService.sendVerificationEmail(
            'test@student.hu.nl', 
            '123456'
        );
        
        res.json({ 
            success: true, 
            message: 'Email service test successful',
            env_vars: {
                EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
                EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
            }
        });
        
    } catch (error) {
        console.error('Email test error:', error);
        res.json({ 
            success: false, 
            error: error.message,
            stack: error.stack,
            env_vars: {
                EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
                EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
            }
        });
    }
});

// Debug database info (admin only)
router.get('/debug/database', requireAuth, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const db = req.app.locals.db;
        
        // Get table info
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
        
        // Get user count
        const userCount = await db.get("SELECT COUNT(*) as count FROM users");
        
        // Get queue count
        const queueCount = await db.get("SELECT COUNT(*) as count FROM print_queue");
        
        // Get favorites count
        const favoritesCount = await db.get("SELECT COUNT(*) as count FROM user_favorites");
        
        res.json({
            database_path: process.env.DATABASE_PATH,
            tables: tables.map(t => t.name),
            counts: {
                users: userCount.count,
                queue_items: queueCount.count,
                favorites: favoritesCount.count
            }
        });
    } catch (error) {
        console.error('Database debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
