const db = require('../config/db');

/**
 * Create a new project
 */
async function createProject(req, res) {
  const { name, client_name, video_type, deadline, priority, status } = req.body;

  if (!name || !client_name || !video_type || !deadline) {
    return res.status(400).json({ error: 'Missing required project fields.' });
  }

  try {
    const projPriority = priority || 'medium';
    const projStatus = status || 'draft';

    const result = await db.query(
      'INSERT INTO projects (name, client_name, video_type, deadline, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, client_name, video_type, deadline, projPriority, projStatus]
    );

    const projectId = result.insertId;

    // Trigger Notification for project creation
    try {
      const notificationService = require('../services/notificationService');
      const clients = await db.query(
        "SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'",
        [client_name, client_name]
      );

      const projectBody =
        `A new video production project has been set up for you on DigiQuest Studio.\n\n` +
        `**Project Name:** ${name}\n` +
        `**Video Type:** ${video_type || 'To be confirmed'}\n` +
        `**Deadline:** ${deadline}\n\n` +
        `Our production team is preparing your project pipeline. You will receive email notifications at each key milestone — including when your video cut is ready for review, when revisions are completed, and when the project is signed off.\n\n` +
        `Log in to your dashboard to monitor progress and access the review session when it becomes available.`;

      if (clients.length > 0) {
        const client = clients[0];
        await notificationService.sendNotification(
          client.id,
          `📁 New Project Created — ${name}`,
          projectBody,
          'email',
          [],
          `${process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app'}/projects`,
          '📁 View Your Projects',
          'PROJECT CREATED',
          '#7c3aed'
        );
      } else if (client_name && client_name.includes('@')) {
        const emailService = require('../services/emailService');
        await emailService.sendNotificationEmail(
          client_name.trim(),
          `📁 New Project Created — ${name}`,
          projectBody +
          `\n\nRegister on DigiQuest Studio using this email address to access your project dashboard and participate in the review pipeline.`,
          `${process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app'}`,
          '🎬 Visit DigiQuest Studio',
          'PROJECT CREATED',
          '#7c3aed'
        );
      }
    } catch (notifErr) {
      console.error('Failed to notify client on project creation:', notifErr.message);
    }

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [projectId, req.user.id, 'PROJECT_CREATION', `Project "${name}" was created.`]
    );

    res.status(201).json({
      message: 'Project created successfully',
      project: { id: projectId, name, client_name, video_type, deadline, priority: projPriority, status: projStatus }
    });
  } catch (err) {
    console.error('Create Project Error:', err.message);
    res.status(500).json({ error: 'Failed to create project.' });
  }
}

/**
 * Fetch all projects (Scoped by user role)
 */
async function getProjects(req, res) {
  try {
    let projects;
    // Clients only see their own projects
    if (req.user.role === 'client') {
      // Find projects where the client_name matches the client's user name or email
      projects = await db.query('SELECT * FROM projects WHERE LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?) ORDER BY deadline ASC', [req.user.name, req.user.email]);
    } else {
      // Studio staff see all projects
      projects = await db.query('SELECT * FROM projects ORDER BY deadline ASC');
    }
    res.json(projects);
  } catch (err) {
    console.error('Get Projects Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
}

/**
 * Fetch a single project by ID with all related feedback, tasks, history, and activity logs
 */
async function getProjectById(req, res) {
  const projectId = req.params.id;

  try {
    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projects[0];

    // Security check: Clients can only access their own project (matched by name or email)
    if (req.user.role === 'client' && 
        project.client_name?.toLowerCase() !== req.user.name?.toLowerCase() && 
        project.client_name?.toLowerCase() !== req.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied to this project.' });
    }

    // Get feedback list
    const feedback = await db.query(
      'SELECT f.*, u.name as submitter_name FROM feedback f INNER JOIN users u ON f.user_id = u.id WHERE f.project_id = ? ORDER BY f.created_at DESC',
      [projectId]
    );

    // Get tasks list (with assignee name)
    const tasks = await db.query(
      'SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC',
      [projectId]
    );

    // Get AI Results
    const aiResults = await db.query(
      'SELECT * FROM ai_results WHERE project_id = ? ORDER BY created_at DESC',
      [projectId]
    );

    // Get Activity Logs
    const activityLogs = await db.query(
      'SELECT l.*, u.name as user_name FROM activity_logs l INNER JOIN users u ON l.user_id = u.id WHERE l.project_id = ? ORDER BY l.created_at DESC',
      [projectId]
    );

    // Parse JSON lists in AI Results for UI convenience
    const processedAiResults = aiResults.map(ai => {
      try {
        return {
          ...ai,
          action_items: ai.action_items ? JSON.parse(ai.action_items) : [],
          editing_tasks: ai.editing_tasks ? JSON.parse(ai.editing_tasks) : [],
          vfx_tasks: ai.vfx_tasks ? JSON.parse(ai.vfx_tasks) : [],
          checklist: ai.checklist ? JSON.parse(ai.checklist) : [],
          suggestions: ai.suggestions ? JSON.parse(ai.suggestions) : []
        };
      } catch (e) {
        return ai;
      }
    });

    res.json({
      project,
      feedback,
      tasks,
      aiResults: processedAiResults,
      activityLogs
    });

  } catch (err) {
    console.error('Get Project Details Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
}

/**
 * Update project status or details (PM/Admin only)
 */
async function updateProject(req, res) {
  const projectId = req.params.id;
  const { name, client_name, video_type, deadline, priority, status } = req.body;

  try {
    const existing = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const current = existing[0];
    const newName = name || current.name;
    const newClient = client_name || current.client_name;
    const newType = video_type || current.video_type;
    const newDeadline = deadline || current.deadline;
    const newPriority = priority || current.priority;
    const newStatus = status || current.status;

    await db.query(
      'UPDATE projects SET name = ?, client_name = ?, video_type = ?, deadline = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newName, newClient, newType, newDeadline, newPriority, newStatus, projectId]
    );

    // Trigger Notification for completion or status changes
    if (current.status !== newStatus) {
      const { triggerProjectStatusUpdatedAlert, triggerProjectCompletedAlert } = require('../services/notificationService');
      if (newStatus === 'completed') {
        await triggerProjectCompletedAlert(projectId, newName);
      } else {
        await triggerProjectStatusUpdatedAlert(projectId, newName, current.status, newStatus);
      }
    }

    // Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [projectId, req.user.id, 'PROJECT_UPDATE', `Project details updated. Status: "${newStatus}".`]
    );

    res.json({
      message: 'Project updated successfully',
      project: { id: projectId, name: newName, client_name: newClient, video_type: newType, deadline: newDeadline, priority: newPriority, status: newStatus }
    });

  } catch (err) {
    console.error('Update Project Error:', err.message);
    res.status(500).json({ error: 'Failed to update project.' });
  }
}

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject
};
