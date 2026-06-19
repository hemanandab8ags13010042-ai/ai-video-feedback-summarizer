const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const videoUpload = require('../middleware/videoUploadMiddleware');

// Authenticate all routes
router.use(authenticateToken);

// Admin / PM upload routes
router.post('/', requireRole(['pm', 'admin']), videoUpload.single('file'), videoController.uploadVideo);
router.post('/:id/versions', requireRole(['pm', 'admin']), videoUpload.single('file'), videoController.uploadNewVersion);

// General viewing routes
router.get('/project/:project_id', videoController.getVideosByProject);
router.get('/version/:version_id', videoController.getVersionDetails);
router.get('/version/:version_id/export-markers', videoController.exportVersionMarkers);
router.get('/version/:version_id/search', videoController.searchVideoContent);

// Subtitles routes
router.post('/version/:version_id/subtitles', videoController.generateSubtitles);
router.get('/version/:version_id/subtitles', videoController.getSubtitles);
router.put('/version/:version_id/subtitles/:subtitle_id', videoController.updateSubtitle);
router.get('/version/:version_id/export-subtitles', videoController.exportSubtitles);

module.exports = router;
