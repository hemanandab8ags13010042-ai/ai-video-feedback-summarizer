const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// Admin / PM upload routes
router.post('/', requireRole(['pm', 'admin']), upload.single('file'), videoController.uploadVideo);
router.post('/:id/versions', requireRole(['pm', 'admin']), upload.single('file'), videoController.uploadNewVersion);

// General viewing routes
router.get('/project/:project_id', videoController.getVideosByProject);
router.get('/version/:version_id', videoController.getVersionDetails);

module.exports = router;
