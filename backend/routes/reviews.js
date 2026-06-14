const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// POST /api/reviews/comments - Client submits comment at timestamp (supports voice upload)
router.post('/comments', upload.single('voice'), reviewController.addComment);

// POST /api/reviews/approve - Client approves final cut or requests revision
router.post('/approve', reviewController.submitApproval);

// POST /api/reviews/analyze-video - Compiles AI summary and auto-creates Kanban tasks
router.post('/analyze-video', reviewController.analyzeVideoComments);

module.exports = router;
