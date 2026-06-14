const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// POST /api/feedback/analyze - Submit feedback and run AI analyzer (handles text and file upload)
router.post('/analyze', upload.single('file'), feedbackController.analyzeFeedback);

// GET /api/feedback/history - Retrieve all historical submissions (filtered by role)
router.get('/history', feedbackController.getFeedbackHistory);

// POST /api/feedback/chat - Interact with AI Project Assistant Chatbot
router.post('/chat', feedbackController.handleChatbot);

module.exports = router;
