const db = require('../config/db');
const { uploadFile } = require('../config/cloudinary');
const notificationService = require('../services/notificationService');
const path = require('path');
const aiService = require('../services/aiService');

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

    // Fetch other sibling versions in the same project for comparison
    const siblingVersions = await db.query(
      `SELECT vv.id, vv.version_number, vv.status, vv.created_at, v.title as video_title 
       FROM video_versions vv 
       INNER JOIN videos v ON vv.video_id = v.id 
       WHERE v.project_id = ? 
       ORDER BY vv.created_at ASC`,
      [version.project_id]
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

/**
 * Export version timeline comments as Premiere CSV or DaVinci EDL markers
 * GET /api/videos/version/:version_id/export-markers
 */
async function exportVersionMarkers(req, res) {
  const versionId = req.params.version_id;
  const format = req.query.format || 'csv';

  try {
    const comments = await db.query(
      `SELECT c.*, u.name as commenter_name 
       FROM feedback_comments c
       INNER JOIN users u ON c.user_id = u.id
       WHERE c.version_id = ?
       ORDER BY c.timestamp_seconds ASC`,
      [versionId]
    );

    const markerExporter = require('../services/markerExporter');
    let fileContent = '';

    if (format === 'edl') {
      fileContent = markerExporter.exportToResolveEDL(comments);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=markers-version-${versionId}.edl`);
    } else {
      fileContent = markerExporter.exportToPremiereCSV(comments);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=markers-version-${versionId}.csv`);
    }

    res.send(fileContent);
  } catch (err) {
    console.error('Export Version Markers Error:', err.message);
    res.status(500).json({ error: 'Failed to export timeline markers.' });
  }
}

function formatTimecode(secondsDecimal, isVtt = false) {
  const totalMs = Math.round(secondsDecimal * 1000);
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const pad = (num, size) => num.toString().padStart(size, '0');
  const separator = isVtt ? '.' : ',';

  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)}${separator}${pad(ms, 3)}`;
}

function convertSubtitlesToSRT(subtitles) {
  return subtitles.map((sub, index) => {
    return `${index + 1}\n${formatTimecode(sub.start_time, false)} --> ${formatTimecode(sub.end_time, false)}\n${sub.text}\n`;
  }).join('\n');
}

function convertSubtitlesToVTT(subtitles) {
  const body = subtitles.map((sub, index) => {
    return `${index + 1}\n${formatTimecode(sub.start_time, true)} --> ${formatTimecode(sub.end_time, true)}\n${sub.text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${body}`;
}

async function generateSubtitles(req, res) {
  const versionId = req.params.version_id;

  try {
    // 1. Get video version
    const versions = await db.query('SELECT * FROM video_versions WHERE id = ?', [versionId]);
    if (versions.length === 0) {
      return res.status(404).json({ error: 'Video version not found.' });
    }
    const version = versions[0];

    // 2. Resolve local file path
    let localPath = null;
    if (version.file_url) {
      const uploadsIndex = version.file_url.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        const relativePath = version.file_url.substring(uploadsIndex);
        localPath = path.join(__dirname, '..', relativePath);
      } else if (version.file_url.startsWith('uploads/')) {
        localPath = path.join(__dirname, '..', version.file_url);
      } else {
        const filename = path.basename(version.file_url);
        localPath = path.join(__dirname, '..', 'uploads', filename);
      }
    }

    // 3. Generate subtitles using AI
    const subtitles = await aiService.generateSubtitlesAI(localPath);

    // 4. Save to db (clear old ones first)
    await db.query('DELETE FROM video_subtitles WHERE version_id = ?', [versionId]);
    for (const sub of subtitles) {
      await db.query(
        'INSERT INTO video_subtitles (version_id, start_time, end_time, text) VALUES (?, ?, ?, ?)',
        [versionId, sub.start_time, sub.end_time, sub.text]
      );
    }

    // 5. Query back all inserted subtitles
    const savedSubtitles = await db.query(
      'SELECT * FROM video_subtitles WHERE version_id = ? ORDER BY start_time ASC',
      [versionId]
    );

    res.status(201).json(savedSubtitles);
  } catch (err) {
    console.error('Generate Subtitles Error:', err);
    res.status(500).json({ error: 'Failed to generate subtitles.' });
  }
}

async function getSubtitles(req, res) {
  const versionId = req.params.version_id;

  try {
    const subtitles = await db.query(
      'SELECT * FROM video_subtitles WHERE version_id = ? ORDER BY start_time ASC',
      [versionId]
    );
    res.json(subtitles);
  } catch (err) {
    console.error('Get Subtitles Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve subtitles.' });
  }
}

async function updateSubtitle(req, res) {
  const { version_id, subtitle_id } = req.params;
  const { text } = req.body;

  if (text === undefined) {
    return res.status(400).json({ error: 'Subtitle text is required.' });
  }

  try {
    await db.query(
      'UPDATE video_subtitles SET text = ? WHERE id = ? AND version_id = ?',
      [text, subtitle_id, version_id]
    );
    res.json({ message: 'Subtitle updated successfully.' });
  } catch (err) {
    console.error('Update Subtitle Error:', err.message);
    res.status(500).json({ error: 'Failed to update subtitle.' });
  }
}

async function exportSubtitles(req, res) {
  const versionId = req.params.version_id;
  const format = req.query.format || 'srt';

  try {
    const subtitles = await db.query(
      'SELECT * FROM video_subtitles WHERE version_id = ? ORDER BY start_time ASC',
      [versionId]
    );

    let fileContent = '';
    if (format === 'vtt') {
      fileContent = convertSubtitlesToVTT(subtitles);
      res.setHeader('Content-Type', 'text/vtt');
      res.setHeader('Content-Disposition', `attachment; filename=subtitles-version-${versionId}.vtt`);
    } else {
      fileContent = convertSubtitlesToSRT(subtitles);
      res.setHeader('Content-Type', 'text/srt');
      res.setHeader('Content-Disposition', `attachment; filename=subtitles-version-${versionId}.srt`);
    }

    res.send(fileContent);
  } catch (err) {
    console.error('Export Subtitles Error:', err.message);
    res.status(500).json({ error: 'Failed to export subtitles.' });
  }
}

module.exports = {
  uploadVideo,
  uploadNewVersion,
  getVideosByProject,
  getVersionDetails,
  exportVersionMarkers,
  generateSubtitles,
  getSubtitles,
  updateSubtitle,
  exportSubtitles
};
