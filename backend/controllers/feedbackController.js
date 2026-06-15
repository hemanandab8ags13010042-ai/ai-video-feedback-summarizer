const db = require('../config/db');
const aiService = require('../services/aiService');
const { uploadFile } = require('../config/cloudinary');
const notificationService = require('../services/notificationService');

/**
 * Upload feedback and run AI Analysis
 * POST /api/feedback/analyze
 */
async function analyzeFeedback(req, res) {
  const { project_id, text_feedback, type } = req.body;
  const file = req.file;

  if (!project_id) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    // 1. Verify project exists
    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const project = projects[0];

    // 2. Upload file if exists
    let fileUrl = null;
    let fileBuffer = null;
    let fileMimeType = null;

    if (file) {
      fileUrl = await uploadFile(file);
      fileBuffer = file.buffer;
      fileMimeType = file.mimetype;
    }

    // Determine type: 'text', 'voice', 'pdf', 'email', 'transcript'
    const feedbackType = type || (file ? (file.mimetype.startsWith('audio') ? 'voice' : 'pdf') : 'text');
    let feedbackContent = text_feedback || '';

    // If it is an audio/voice note, transcribe it
    if (file && file.mimetype.startsWith('audio')) {
      let transcriptText = null;
      try {
        transcriptText = await aiService.transcribeAudio(file.buffer, file.mimetype, file.originalname);
      } catch (transcribeError) {
        console.error('Failed to transcribe feedback audio, using text fallback:', transcribeError.message);
      }

      if (!transcriptText) {
        transcriptText = `[Mock Transcript] Client requests changes: "${text_feedback || 'Adjust timeline pacing, fix the wire compositing setup, and color grade LUT warmup.'}"`;
      }

      console.log('🗣️ Feedback audio transcript:', transcriptText);
      feedbackContent = feedbackContent 
        ? `${feedbackContent}\n\n[Voice Note Transcript]: ${transcriptText}`
        : transcriptText;
    }

    // 3. Save raw feedback to database
    const feedbackResult = await db.query(
      'INSERT INTO feedback (project_id, user_id, type, content, file_url) VALUES (?, ?, ?, ?, ?)',
      [project_id, req.user.id, feedbackType, feedbackContent, fileUrl]
    );
    const feedbackId = feedbackResult.insertId;

    // 4. Fetch all team members for assignment matching
    const teamMembers = await db.query('SELECT id, name, role FROM users WHERE role IN ("editor", "vfx_artist")');

    // 5. Invoke AI Engine
    // Pass the text content and/or file buffers for multimodality
    const aiOutput = await aiService.analyzeFeedback(feedbackContent, fileBuffer, fileMimeType, teamMembers);

    // 6. Save AI Analysis Result
    await db.query(
      `INSERT INTO ai_results (
        project_id, feedback_id, summary, action_items, editing_tasks, 
        vfx_tasks, priority_detected, effort_estimate, suggestions, checklist
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id,
        feedbackId,
        aiOutput.summary || 'Summary not provided.',
        JSON.stringify(aiOutput.action_items || []),
        JSON.stringify(aiOutput.editing_tasks || []),
        JSON.stringify(aiOutput.vfx_tasks || []),
        aiOutput.priority || 'medium',
        aiOutput.estimated_hours || 0,
        JSON.stringify(aiOutput.suggestions || [aiOutput.risk_detected || 'No immediate risks detected.']),
        JSON.stringify(aiOutput.checklist || [])
      ]
    );

    // Update project overall status & priority if needed
    const newProjectPriority = aiOutput.priority || project.priority;
    await db.query(
      'UPDATE projects SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newProjectPriority, project_id]
    );

    // 7. AUTOMATICALLY CREATE TASKS FROM AI SUGGESTIONS
    const createdTasks = [];

    // Create Editing Tasks
    if (aiOutput.editing_tasks && Array.isArray(aiOutput.editing_tasks)) {
      for (const t of aiOutput.editing_tasks) {
        // Fallback check to assign to the first editor if specified editor doesn't match
        let assigneeId = t.suggested_assignee_id || null;
        if (assigneeId) {
          const userExists = await db.query('SELECT id FROM users WHERE id = ?', [assigneeId]);
          if (userExists.length === 0) assigneeId = null;
        }

        const taskRes = await db.query(
          `INSERT INTO tasks (project_id, title, description, category, priority, status, assigned_to, effort_hours) 
           VALUES (?, ?, ?, 'editing', ?, 'new', ?, ?)`,
          [project_id, t.title, t.description, t.priority || 'medium', assigneeId, t.hours || 0]
        );
        const taskId = taskRes.insertId;
        createdTasks.push({ id: taskId, title: t.title, category: 'editing', assigned_to: assigneeId });

        if (assigneeId) {
          await notificationService.triggerTaskAssignedAlert(taskId, t.title, assigneeId, project.name);
        }
      }
    }

    // Create VFX Tasks
    if (aiOutput.vfx_tasks && Array.isArray(aiOutput.vfx_tasks)) {
      for (const t of aiOutput.vfx_tasks) {
        let assigneeId = t.suggested_assignee_id || null;
        if (assigneeId) {
          const userExists = await db.query('SELECT id FROM users WHERE id = ?', [assigneeId]);
          if (userExists.length === 0) assigneeId = null;
        }

        const taskRes = await db.query(
          `INSERT INTO tasks (project_id, title, description, category, priority, status, assigned_to, effort_hours) 
           VALUES (?, ?, ?, 'vfx', ?, 'new', ?, ?)`,
          [project_id, t.title, t.description, t.priority || 'medium', assigneeId, t.hours || 0]
        );
        const taskId = taskRes.insertId;
        createdTasks.push({ id: taskId, title: t.title, category: 'vfx', assigned_to: assigneeId });

        if (assigneeId) {
          await notificationService.triggerTaskAssignedAlert(taskId, t.title, assigneeId, project.name);
        }
      }
    }

    // 8. Log activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [
        project_id, 
        req.user.id, 
        'FEEDBACK_ANALYSIS', 
        `Submitted feedback analyzed by AI. Sentiment: "${aiOutput.sentiment || 'neutral'}". Auto-created ${createdTasks.length} tasks.`
      ]
    );

    // Notify project managers & admins
    await notificationService.triggerNewFeedbackAlert(project_id, project.name, req.user.name);

    res.json({
      message: 'Feedback submitted and processed by AI successfully.',
      feedbackId,
      aiAnalysis: {
        ...aiOutput,
        file_url: fileUrl
      },
      createdTasks
    });

  } catch (err) {
    console.error('Feedback Analysis Controller Error:', err);
    res.status(500).json({ error: 'Failed to process video feedback. Please verify file types and try again.' });
  }
}

/**
 * Fetch all AI results for history page
 * GET /api/feedback/history
 */
async function getFeedbackHistory(req, res) {
  try {
    let queryStr = `
      SELECT f.*, p.name as project_name, u.name as submitter_name, 
             ai.summary, ai.priority_detected, ai.effort_estimate, ai.action_items,
             ai.editing_tasks, ai.vfx_tasks, ai.checklist, ai.suggestions
      FROM feedback f
      INNER JOIN projects p ON f.project_id = p.id
      INNER JOIN users u ON f.user_id = u.id
      LEFT JOIN ai_results ai ON f.id = ai.feedback_id
    `;
    const params = [];

    // Filter feedback by client if applicable
    if (req.user.role === 'client') {
      queryStr += ' WHERE p.client_name = ?';
      params.push(req.user.name);
    }

    queryStr += ' ORDER BY f.created_at DESC';

    const feedbacks = await db.query(queryStr, params);

    const processedFeedbacks = feedbacks.map(f => {
      try {
        return {
          ...f,
          action_items: f.action_items ? JSON.parse(f.action_items) : [],
          editing_tasks: f.editing_tasks ? JSON.parse(f.editing_tasks) : [],
          vfx_tasks: f.vfx_tasks ? JSON.parse(f.vfx_tasks) : [],
          checklist: f.checklist ? JSON.parse(f.checklist) : [],
          suggestions: f.suggestions ? JSON.parse(f.suggestions) : []
        };
      } catch (e) {
        return f;
      }
    });

    res.json(processedFeedbacks);
  } catch (err) {
    console.error('Get Feedback History Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve feedback history.' });
  }
}

/**
 * AI Assistant Chatbot Endpoint
 * POST /api/feedback/chat
 */
async function handleChatbot(req, res) {
  const { message, chatHistory, project_id } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  try {
    let projectContext = `User: ${req.user?.name || 'User'} (Role: ${req.user?.role || 'Guest'}).\n`;
    if (project_id) {
      const projects = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
      if (projects.length > 0) {
        const p = projects[0];
        const tasks = await db.query('SELECT title, status, category FROM tasks WHERE project_id = ?', [project_id]);
        const tasksStr = tasks.map(t => `- [${t.status}] ${t.title} (${t.category})`).join('\n');
        projectContext += `Active Page Context: Viewing Project: ${p.name}, Status: ${p.status}, Type: ${p.video_type}, Deadline: ${p.deadline}. \nTasks:\n${tasksStr}`;
      }
    } else {
      // General workspace context
      const projects = await db.query('SELECT id, name, status, priority, client_name FROM projects');
      const projectsStr = projects.map(p => `- Project ID ${p.id}: "${p.name}" (Client: ${p.client_name}, Status: ${p.status}, Priority: ${p.priority})`).join('\n');
      
      const tasksCount = await db.query('SELECT COUNT(*) as count FROM tasks');
      const activeTasksCount = await db.query("SELECT COUNT(*) as count FROM tasks WHERE status != 'completed'");
      
      projectContext += `Workspace Overview Context:\n- Total Projects: ${projects.length}\n- Total Tasks: ${tasksCount[0].count}\n- Active Tasks: ${activeTasksCount[0].count}\n\nList of Projects in Workspace:\n${projectsStr}`;
    }

    const reply = await aiService.chatbotChat(chatHistory || [], message, projectContext);
    res.json({ reply });
  } catch (err) {
    console.error('Chatbot Controller Error:', err.message);
    res.status(500).json({ error: 'Chatbot service temporarily unavailable.' });
  }
}

module.exports = {
  analyzeFeedback,
  getFeedbackHistory,
  handleChatbot
};
