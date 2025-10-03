// backend/middleware/auth.js

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// Middleware to check verified email
function requireVerifiedEmail(req, res, next) {
  if (req.user && req.user.email_verified) {
    return next();
  }
  return res.status(403).json({ error: 'HU email verification required' });
}

// Middleware to check admin privileges
function requireAdmin(req, res, next) {
  if (req.user && req.user.is_admin) {
    return next();
  }
  return res.status(403).json({ error: 'Admin privileges required' });
}

module.exports = {
  requireAuth,
  requireVerifiedEmail,
  requireAdmin
};
