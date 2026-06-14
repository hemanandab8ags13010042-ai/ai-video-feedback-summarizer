const db = require('../config/db');
const { uploadFile } = require('../config/cloudinary');
const notificationService = require('../services/notificationService');

/**
 * Admin uploads a new video (with initial version e.g. V1)
 * POST /api/videos
 */
async function uploadVideo(req, res) {
  const { project_id, title, description, version_number } = req.body;
  const file = req.file;

  if (!project_id || !title || !file) {
    return res.status(400).json({ error: 'Project ID, video title, and video file are required.' });
  }

  try {
    // 1. Verify project exists
    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const project = projects[0];

    // 2. Upload video file (Cloudinary or local directory fallback)
    const fileUrl = await uploadFile(file);

    // 3. Save to videos table
    const videoResult = await db.query(
      'INSERT INTO videos (project_id, title, description) VALUES (?, ?, ?)',
      [project_id, title, description || '']
    );
    const videoId = videoResult.insertId;

    // 4. Save to video_versions table (initial version)
    const verNumber = version_number || 'V1';
    const versionResult = await db.query(
      'INSERT INTO video_versions (video_id, version_number, file_url, status) VALUES (?, ?, ?, ?)',
      [videoId, verNumber, fileUrl, 'pending_review']
    );
    const versionId = versionResult.insertId;

    // 5. Generate secure review link (mapped to frontend route)
    const frontendHost = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reviewLink = `${frontendHost}/review/${versionId}`;
    
    await db.query(
      'UPDATE video_versions SET review_link = ? WHERE id = ?',
      [reviewLink, versionId]
    );

    // 6. Trigger Client Notification (Email & WhatsApp simulation)
    // Find client ID or name matching the project's client_name
    const clients = await db.query('SELECT id, email FROM users WHERE name = ? AND role = "client"', [project.client_name]);
    
    if (clients.length > 0) {
      const client = clients[0];
      const alertMsg = `Your video "${title}" (${verNumber}) is ready for review. Click here to watch and provide timestamp feedback: ${reviewLink}`;
      await notificationService.sendNotification(
        client.id,
        `🎬 Video Ready for Review: ${title} (${verNumber})`,
        alertMsg,
        'email'
      );
    }

    // 7. Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [project_id, req.user.id, 'VIDEO_UPLOAD', `Uploaded video "${title}" version "${verNumber}". review link: ${reviewLink}`]
    );

    res.status(201).json({
      message: 'Video and initial version uploaded successfully.',
      videoId,
      versionId,
      reviewLink,
      fileUrl
    });

  } catch (err) {
    console.error('Upload Video Error:', err);
    res.status(500).json({ error: 'Failed to upload video assets. Please try again.' });
  }
}

/**
 * Admin uploads a new version for an existing video (e.g. V2, V3)
 * POST /api/videos/:id/versions
 */
async function uploadNewVersion(req, res) {
  const videoId = req.params.id;
  const { version_number } = req.body;
  const file = req.file;

  if (!version_number || !file) {
    return res.status(400).json({ error: 'Version number and video file are required.' });
  }

  try {
    // 1. Verify video exists
    const videos = await db.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video record not found.' });
    }
    const video = videos[0];

    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [video.project_id]);
    const project = projects[0];

    // 2. Upload video file
    const fileUrl = await uploadFile(file);

    // 3. Save to video_versions
    const versionResult = await db.query(
      'INSERT INTO video_versions (video_id, version_number, file_url, status) VALUES (?, ?, ?, ?)',
      [videoId, version_number, fileUrl, 'pending_review']
    );
    const versionId = versionResult.insertId;

    // 4. Generate review link
    const frontendHost = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reviewLink = `${frontendHost}/review/${versionId}`;
    
    await db.query(
      'UPDATE video_versions SET review_link = ? WHERE id = ?',
      [reviewLink, versionId]
    );

    // 5. Notify Client
    const clients = await db.query('SELECT id FROM users WHERE name = ? AND role = "client"', [project.client_name]);
    if (clients.length > 0) {
      const client = clients[0];
      await notificationService.sendNotification(
        client.id,
        `🔄 New Revision Uploaded: ${video.title} (${version_number})`,
        `A new version (${version_number}) is ready for review. Click here to watch: ${reviewLink}`,
        'whatsapp'
      );
    }

    // 6. Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [video.project_id, req.user.id, 'VIDEO_VERSION_UPLOAD', `Uploaded new version "${version_number}" for video "${video.title}".`]
    );

    res.status(201).json({
      message: `Version ${version_number} uploaded successfully.`,
      versionId,
      reviewLink,
      fileUrl
    });

  } catch (err) {
    console.error('Upload Version Error:', err);
    res.status(500).json({ error: 'Failed to upload new revision version.' });
  }
}

/**
 * Retrieve all videos and version catalogs for a specific project
 * GET /api/videos/project/:project_id
 */
async function getVideosByProject(req, res) {
  const projectId = req.params.project_id;

  try {
    const videos = await db.query('SELECT * FROM videos WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
    
    // Stitch version histories
    const result = [];
    for (const video of videos) {
      const versions = await db.query(
        'SELECT * FROM video_versions WHERE video_id = ? ORDER BY created_at DESC',
        [video.id]
      );
      result.push({
        ...video,
        versions
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Get Project Videos Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve project videos list.' });
  }
}

/**
 * Retrieve specific video version details with comments, annotations, and approvals
 * GET /api/videos/version/:version_id
 */
async function getVersionDetails(req, res) {
  const versionId = req.params.version_id;

  try {
    const versions = await db.query(
      `SELECT vv.*, v.title as video_title, v.description as video_description, v.project_id, p.name as project_name, p.client_name 
       FROM video_versions vv
       INNER JOIN videos v ON vv.video_id = v.id
       INNER JOIN projects p ON v.project_id = p.id
       WHERE vv.id = ?`,
      [versionId]
    );

    if (versions.length === 0) {
      return res.status(404).json({ error: 'Video version not found.' });
    }

    const version = versions[0];

    // Fetch all comments and drawings for this version
    const comments = await db.query(
      `SELECT c.*, u.name as commenter_name, u.role as commenter_role,
              a.draw_data, a.screenshot_url,
              vf.audio_url as voice_audio_url, vf.transcript as voice_transcript
       FROM feedback_comments c
       INNER JOIN users u ON c.user_id = u.id
       LEFT JOIN feedback_annotations a ON c.id = a.comment_id
       LEFT JOIN voice_feedback vf ON c.id = vf.comment_id
       WHERE c.version_id = ?
       ORDER BY c.timestamp_seconds ASC`,
      [versionId]
    );

    // Fetch AI Summary
    const aiSummaries = await db.query(
      'SELECT * FROM ai_summaries WHERE version_id = ? ORDER BY created_at DESC LIMIT 1',
      [versionId]
    );
    let aiSummary = aiSummaries[0] || null;

    if (aiSummary) {
      try {
        aiSummary = {
          ...aiSummary,
          action_items: JSON.parse(aiSummary.action_items || '[]'),
          editing_tasks: JSON.parse(aiSummary.editing_tasks || '[]'),
          vfx_tasks: JSON.parse(aiSummary.vfx_tasks || '[]'),
          audio_tasks: JSON.parse(aiSummary.audio_tasks || '[]'),
          subtitle_tasks: JSON.parse(aiSummary.subtitle_tasks || '[]'),
          priority_breakdown: JSON.parse(aiSummary.priority_breakdown || '{}'),
          suggestions: JSON.parse(aiSummary.suggestions || '[]')
        };
      } catch (e) {
        // use raw
      }
    }

    // Fetch approvals status
    const approvals = await db.query(
      'SELECT a.*, u.name as user_name FROM approvals a INNER JOIN users u ON a.user_id = u.id WHERE a.version_id = ?',
      [versionId]
    );

    // Fetch other sibling versions for comparison tabs
    const siblingVersions = await db.query(
      'SELECT id, version_number, status, created_at FROM video_versions WHERE video_id = ? ORDER BY created_at ASC',
      [version.video_id]
    );

    res.json({
      version,
      comments: comments.map(c => ({
        ...c,
        draw_data: c.draw_data ? JSON.parse(c.draw_data) : null
      })),
      aiSummary,
      approvals,
      siblingVersions
    });

  } catch (err) {
    console.error('Get Version Details Error:', err);
    res.status(500).json({ error: 'Failed to retrieve review session details.' });
  }
}

module.exports = {
  uploadVideo,
  uploadNewVersion,
  getVideosByProject,
  getVersionDetails
};
