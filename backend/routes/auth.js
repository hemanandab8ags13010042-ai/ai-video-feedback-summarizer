const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/inputValidator');

// Public routes — protected by strict rate limiting + input validation
// Auth limiter: 10 attempts per 15 minutes per IP
router.post('/register', authLimiter, validateRegister, authController.register);
router.post('/login', authLimiter, validateLogin, authController.login);
router.get('/smtp-diagnostics', authController.testSMTPConnection);


// Protected routes
router.get('/me', authenticateToken, authController.getMe);
router.get('/users', authenticateToken, authController.getAllUsers);
router.put('/users/:id', authenticateToken, authController.updateUser);
router.delete('/users/:id', authenticateToken, authController.deleteUser);

module.exports = router;
