const db = require('../config/db');
const { uploadFile } = require('../config/cloudinary');
const aiService = require('../services/aiService');
const notificationService = require('../services/notificationService');

/**
 * Client uploads a timestamped comment with drawing data and/or voice note
 * POST /api/reviews/comments
 */
async function addComment(req, res) {
  const { version_id, timestamp_seconds, comment, category, priority, draw_data } = req.body;
  const file = req.file; // Voice note upload

  if (!version_id || !comment) {
    return res.status(400).json({ error: 'Version ID and comment text are required.' });
  }

  try {
    // 1. Verify version exists
    const versions = await db.query(
      'SELECT vv.*, v.project_id FROM video_versions vv INNER JOIN videos v ON vv.video_id = v.id WHERE vv.id = ?',
      [version_id]
    );
    if (versions.length === 0) {
      return res.status(404).json({ error: 'Video version not found.' });
    }
    const version = versions[0];

    const timestampSec = parseFloat(timestamp_seconds) || 0;
    const cat = category || 'General';
    const prio = priority || 'medium';

    // 2. Insert into feedback_comments
    const commentRes = await db.query(
      `INSERT INTO feedback_comments (version_id, user_id, timestamp_seconds, comment, category, priority) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [version_id, req.user.id, timestampSec, comment, cat, prio]
    );
    const commentId = commentRes.insertId;

    // 3. Handle Canvas Drawing Annotations
    if (draw_data) {
      await db.query(
        'INSERT INTO feedback_annotations (comment_id, draw_data) VALUES (?, ?)',
        [commentId, draw_data]
      );
    }

    // 4. Handle Voice Recording Upload & Speech-to-Text Transcription
    if (file) {
      const audioUrl = await uploadFile(file);
      let transcript = 'Audio feedback uploaded.';

      // Attempt transcription via Gemini if API key is loaded
      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          
          const response = await model.generateContent([
            {
              inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype
              }
            },
            { text: "Transcribe the audio message. Return only the transcript text." }
          ]);
          transcript = response.response.text().trim();
        } catch (e) {
          console.error('Audio transcription error:', e.message);
          transcript = `[Mock Transcription] User requested changes: "${comment}"`;
        }
      } else {
        transcript = `[Mock Speech-To-Text] Transcription details: "${comment}"`;
      }

      await db.query(
        'INSERT INTO voice_feedback (comment_id, audio_url, transcript) VALUES (?, ?, ?)',
        [commentId, audioUrl, transcript]
      );
    }

    // 5. Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [
        version.project_id, 
        req.user.id, 
        'FEEDBACK_COMMENT', 
        `Added feedback comment at timestamp ${formatTime(timestampSec)}: "${comment}" (${cat}).`
      ]
    );

    res.status(201).json({
      message: 'Comment added successfully.',
      commentId,
      timestamp: timestampSec,
      comment
    });

  } catch (err) {
    console.error('Add Comment Error:', err);
    res.status(500).json({ error: 'Failed to record feedback comment.' });
  }
}

/**
 * Client submits approval or requests revisions
 * POST /api/reviews/approve
 */
async function submitApproval(req, res) {
  const { version_id, status, comments } = req.body;

  if (!version_id || !status) {
    return res.status(400).json({ error: 'Version ID and status (approved | revision_required) are required.' });
  }

  try {
    // 1. Verify version
    const versions = await db.query(
      `SELECT vv.*, v.title as video_title, v.project_id, p.name as project_name, p.client_name 
       FROM video_versions vv 
       INNER JOIN videos v ON vv.video_id = v.id 
       INNER JOIN projects p ON v.project_id = p.id
       WHERE vv.id = ?`,
      [version_id]
    );
    if (versions.length === 0) {
      return res.status(404).json({ error: 'Video version not found.' });
    }
    const version = versions[0];

    // 2. Save to approvals table
    await db.query(
      'INSERT INTO approvals (version_id, user_id, status, comments) VALUES (?, ?, ?, ?)',
      [version_id, req.user.id, status, comments || '']
    );

    // 3. Update video_versions status
    await db.query(
      'UPDATE video_versions SET status = ? WHERE id = ?',
      [status, version_id]
    );

    // 4. Update overall project status if applicable
    if (status === 'approved') {
      // If it is the final approved version, complete the project
      await db.query(
        'UPDATE projects SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [version.project_id]
      );
      
      // Notify PMs and staff of completion
      const pms = await db.query('SELECT id FROM users WHERE role IN ("pm", "admin")');
      for (const pm of pms) {
        await notificationService.sendNotification(
          pm.id,
          `🎉 Video Approved & Project Completed: ${version.project_name}`,
          `Client approved version "${version.version_number}" of video "${version.video_title}". Project marked complete.`,
          'whatsapp'
        );
      }
    } else {
      // Revision Required
      await db.query(
        'UPDATE projects SET status = "editing", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [version.project_id]
      );

      const staff = await db.query(`
        SELECT DISTINCT assigned_to as id FROM tasks WHERE project_id = ? AND assigned_to IS NOT NULL
        UNION
        SELECT id FROM users WHERE role IN ("pm", "admin")
      `, [version.project_id]);

      for (const st of staff) {
        if (st.id) {
          await notificationService.sendNotification(
            st.id,
            `🔄 Revisions Requested on: ${version.project_name}`,
            `Client requested revisions on version "${version.version_number}" of "${version.video_title}". Comments: "${comments || 'See timeline details'}"`,
            'email'
          );
        }
      }
    }

    // 5. Log activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [
        version.project_id, 
        req.user.id, 
        'APPROVAL_DECISION', 
        `Client set version "${version.version_number}" review status to "${status.toUpperCase()}". Comments: "${comments || 'None'}"`
      ]
    );

    res.json({
      message: `Approval decision logged as ${status}.`,
      status
    });

  } catch (err) {
    console.error('Submit Approval Error:', err);
    res.status(500).json({ error: 'Failed to record approval status.' });
  }
}

/**
 * AI compiles feedback comments, runs summaries, and creates task cards
 * POST /api/reviews/analyze-video
 */
async function analyzeVideoComments(req, res) {
  const { version_id } = req.body;

  if (!version_id) {
    return res.status(400).json({ error: 'Version ID is required.' });
  }

  try {
    // 1. Verify version and gather project details
    const versions = await db.query(
      `SELECT vv.*, v.title as video_title, v.project_id, p.name as project_name 
       FROM video_versions vv 
       INNER JOIN videos v ON vv.video_id = v.id 
       INNER JOIN projects p ON v.project_id = p.id
       WHERE vv.id = ?`,
      [version_id]
    );
    if (versions.length === 0) {
      return res.status(404).json({ error: 'Video version not found.' });
    }
    const version = versions[0];

    // 2. Fetch comments list
    const comments = await db.query(
      'SELECT c.*, u.name as commenter_name FROM feedback_comments c INNER JOIN users u ON c.user_id = u.id WHERE c.version_id = ? ORDER BY c.timestamp_seconds ASC',
      [version_id]
    );

    if (comments.length === 0) {
      return res.status(400).json({ error: 'No feedback comments found on this version. Submit comments first.' });
    }

    // 3. Compile prompt
    const commentsSummaryStr = comments.map(c => 
      `[${formatTime(c.timestamp_seconds)}] Category: ${c.category}, Priority: ${c.priority}, Commenter: ${c.commenter_name}. Feedback: "${c.comment}"`
    ).join('\n');

    const systemPrompt = `
You are an expert AI Video Editor and VFX director.
Analyze the following timestamped client feedback comments for the video "${version.video_title}" and compile a structured summary and task lists.

You must return a valid JSON object matching the schema:
{
  "summary": "Short paragraph summarizing the feedback theme...",
  "action_items": ["Action 1", "Action 2"],
  "editing_tasks": [
    { "title": "Trim intro timeline", "description": "At 00:15: Cut out scene transition.", "priority": "high", "hours": 2 }
  ],
  "vfx_tasks": [
    { "title": "Paint out wire reflection", "description": "At 01:20: Remove marker.", "priority": "medium", "hours": 4 }
  ],
  "audio_tasks": [
    { "title": "Equalize dialog volume", "description": "At 02:40: Boost levels.", "priority": "low", "hours": 1.5 }
  ],
  "subtitle_tasks": [
    { "title": "Fix typographic error", "description": "At 03:00: Correct spelling of name.", "priority": "medium", "hours": 0.5 }
  ],
  "priority_breakdown": { "high": 3, "medium": 5, "low": 2 },
  "estimated_hours": 8.0,
  "suggestions": ["Ensure warps match scene shadows", "Recalibrate volume levels"]
}

Return only raw JSON. Do not include markdown code fence formatting.
`;

    let aiOutput = null;

    // Call Gemini API if key is loaded
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const response = await model.generateContent(`${systemPrompt}\n\nFeedback Comments:\n${commentsSummaryStr}`);
        const resText = response.response.text();
        
        let cleaned = resText.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '');
        }
        aiOutput = JSON.parse(cleaned);
      } catch (err) {
        console.error('Gemini video analysis failed, falling back to mock:', err);
      }
    }

    // Fallback Mock compile if API key is absent or failed
    if (!aiOutput) {
      aiOutput = compileMockVideoAnalysis(comments);
    }

    // 4. Save to ai_summaries table
    await db.query(
      `INSERT INTO ai_summaries (
        version_id, summary, action_items, editing_tasks, vfx_tasks, 
        audio_tasks, subtitle_tasks, priority_breakdown, effort_estimate, suggestions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version_id,
        aiOutput.summary || 'Summary compiled.',
        JSON.stringify(aiOutput.action_items || []),
        JSON.stringify(aiOutput.editing_tasks || []),
        JSON.stringify(aiOutput.vfx_tasks || []),
        JSON.stringify(aiOutput.audio_tasks || []),
        JSON.stringify(aiOutput.subtitle_tasks || []),
        JSON.stringify(aiOutput.priority_breakdown || {}),
        aiOutput.estimated_hours || 0,
        JSON.stringify(aiOutput.suggestions || [])
      ]
    );

    // 5. AUTOMATICALLY CREATE TASK CARDS IN THE KANBAN DATABASE
    const allAITasks = [
      ...(aiOutput.editing_tasks || []).map(t => ({ ...t, category: 'editing' })),
      ...(aiOutput.vfx_tasks || []).map(t => ({ ...t, category: 'vfx' })),
      ...(aiOutput.audio_tasks || []).map(t => ({ ...t, category: 'editing' })), // Map audio to editing category
      ...(aiOutput.subtitle_tasks || []).map(t => ({ ...t, category: 'editing' }))
    ];

    // Seed into tasks table
    for (const t of allAITasks) {
      await db.query(
        `INSERT INTO tasks (project_id, title, description, category, priority, status, effort_hours) 
         VALUES (?, ?, ?, ?, 'new', ?)`,
        [version.project_id, t.title, t.description, t.category, t.priority || 'medium', t.hours || 0]
      );
    }

    // 6. Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [
        version.project_id, 
        req.user.id, 
        'VIDEO_FEEDBACK_ANALYSIS', 
        `AI compiled ${comments.length} comments for "${version.video_title}" (${version.version_number}). Auto-created ${allAITasks.length} task cards.`
      ]
    );

    res.json({
      message: 'AI video feedback analysis successfully compiled and tasks created.',
      aiAnalysis: aiOutput
    });

  } catch (err) {
    console.error('Analyze Video Comments Error:', err);
    res.status(500).json({ error: 'Failed to process AI summary.' });
  }
}

// Helpers
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function compileMockVideoAnalysis(comments) {
  let editCount = 0, vfxCount = 0, audioCount = 0, subtitleCount = 0;
  const editingTasks = [];
  const vfxTasks = [];
  const audioTasks = [];
  const subtitleTasks = [];
  const actionItems = [];

  comments.forEach(c => {
    const timeStr = formatTime(c.timestamp_seconds);
    const title = `${c.category} Fix at ${timeStr}`;
    const desc = `At ${timeStr}: ${c.comment}`;
    const taskItem = { title, description: desc, priority: c.priority, hours: c.priority === 'high' ? 3 : 1.5 };

    actionItems.push(`Resolve feedback comment at ${timeStr}: ${c.comment}`);

    const lowerCat = c.category.toLowerCase();
    if (lowerCat.includes('vfx') || lowerCat.includes('anim')) {
      vfxCount++;
      vfxTasks.push(taskItem);
    } else if (lowerCat.includes('audio') || lowerCat.includes('sound')) {
      audioCount++;
      audioTasks.push(taskItem);
    } else if (lowerCat.includes('sub') || lowerCat.includes('text')) {
      subtitleCount++;
      subtitleTasks.push(taskItem);
    } else {
      editCount++;
      editingTasks.push(taskItem);
    }
  });

  return {
    summary: `Client completed video review leaving ${comments.length} comments. Revisions focus on color setups, sound balances, and compositing fixes.`,
    action_items: actionItems,
    editing_tasks: editingTasks,
    vfx_tasks: vfxTasks,
    audio_tasks: audioTasks,
    subtitle_tasks: subtitleTasks,
    priority_breakdown: {
      high: comments.filter(c => c.priority === 'high').length,
      medium: comments.filter(c => c.priority === 'medium').length,
      low: comments.filter(c => c.priority === 'low').length
    },
    estimated_hours: comments.length * 2.0,
    suggestions: ['Perform video rendering checks', 'Re-export track stems']
  };
}

module.exports = {
  addComment,
  submitApproval,
  analyzeVideoComments
};
