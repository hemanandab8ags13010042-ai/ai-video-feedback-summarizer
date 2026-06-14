const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// All project routes require authentication
router.use(authenticateToken);

// GET /api/projects - View projects
router.get('/', projectController.getProjects);

// GET /api/projects/:id - View specific project
router.get('/:id', projectController.getProjectById);

// POST /api/projects - Create project (PM/Admin only)
router.post('/', requireRole(['pm', 'admin']), projectController.createProject);

// PUT /api/projects/:id - Update project (PM/Admin only)
router.put('/:id', requireRole(['pm', 'admin']), projectController.updateProject);

module.exports = router;
