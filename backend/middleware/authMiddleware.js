const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../config/jwtConfig');

/**
 * Main auth middleware to verify JWT token
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Expecting: "Bearer <token>" or fallback to query parameter for browser downloads (e.g. CSV reports)
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please authenticate.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user details from database to ensure user still exists and role is valid
    const users = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      return res.status(403).json({ error: 'User account no longer exists.' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired access token.' });
  }
}

/**
 * Role-Based Access Control middleware
 * @param {Array<string>} allowedRoles Roles authorized to access this resource
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Role '${req.user.role}' is not authorized. Required: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
