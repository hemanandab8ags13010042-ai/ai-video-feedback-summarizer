const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// GET /api/tasks - Retrieve task list (filtered by project or scope)
router.get('/', taskController.getTasks);

// POST /api/tasks - Create task manually (PM/Admin only)
router.post('/', requireRole(['pm', 'admin']), taskController.createTask);

// PUT /api/tasks/:id - Update task details, status, or notes
router.put('/:id', taskController.updateTask);

// GET /api/tasks/:id/history - Retrieve history log for audits
router.get('/:id/history', taskController.getTaskHistory);

module.exports = router;
