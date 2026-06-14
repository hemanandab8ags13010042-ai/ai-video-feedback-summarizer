const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// GET /api/dashboard - Retrieve analytical figures, stats, logs, and user notifications
router.get('/', dashboardController.getDashboardData);

// PUT /api/dashboard/notifications/read - Dismiss active unread notifications
router.put('/notifications/read', dashboardController.markNotificationsRead);

module.exports = router;
