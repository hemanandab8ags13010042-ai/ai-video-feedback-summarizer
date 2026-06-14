const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// Restrict report generation to PMs and Admins
router.get('/', requireRole(['pm', 'admin']), reportController.generateReport);

// GET /api/reports/history - View log of generated exports
router.get('/history', requireRole(['pm', 'admin']), reportController.getReportsHistory);

module.exports = router;
