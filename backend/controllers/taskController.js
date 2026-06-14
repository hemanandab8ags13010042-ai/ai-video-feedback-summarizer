const db = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Create a new task manually (PM/Admin only)
 * POST /api/tasks
 */
async function createTask(req, res) {
  const { project_id, title, description, category, priority, status, assigned_to, effort_hours } = req.body;

  if (!project_id || !title || !category) {
    return res.status(400).json({ error: 'Project ID, title, and category are required.' });
  }

  try {
    const taskPriority = priority || 'medium';
    const taskStatus = status || 'new';
    const hours = effort_hours || 0;
    const assignee = assigned_to || null;

    const result = await db.query(
      `INSERT INTO tasks (project_id, title, description, category, priority, status, assigned_to, effort_hours) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, title, description, category, taskPriority, taskStatus, assignee, hours]
    );

    const taskId = result.insertId;

    // Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [project_id, req.user.id, 'TASK_CREATION', `Task "${title}" created manually.`]
    );

    // Notify assignee
    if (assignee) {
      const projects = await db.query('SELECT name FROM projects WHERE id = ?', [project_id]);
      const projectName = projects[0]?.name || 'Project';
      await notificationService.triggerTaskAssignedAlert(taskId, title, assignee, projectName);
    }

    res.status(201).json({
      message: 'Task created successfully',
      task: { id: taskId, project_id, title, description, category, priority: taskPriority, status: taskStatus, assigned_to: assignee, effort_hours: hours }
    });

  } catch (err) {
    console.error('Create Task Error:', err.message);
    res.status(500).json({ error: 'Failed to create task.' });
  }
}

/**
 * Fetch all tasks (can filter by project_id, assignee, or category)
 * GET /api/tasks
 */
async function getTasks(req, res) {
  const { project_id, assigned_to, category } = req.query;

  try {
    let queryStr = `
      SELECT t.*, p.name as project_name, u.name as assignee_name 
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
    `;
    const params = [];
    const conditions = [];

    // Filter by project
    if (project_id) {
      conditions.push('t.project_id = ?');
      params.push(project_id);
    }

    // Role-based scoping
    if (req.user.role === 'client') {
      conditions.push('p.client_name = ?');
      params.push(req.user.name);
    } else if (req.user.role === 'editor' || req.user.role === 'vfx_artist') {
      // Editors & VFX Artists can see tasks assigned to them, or general tasks
      conditions.push('(t.assigned_to = ? OR t.assigned_to IS NULL)');
      params.push(req.user.id);
    }

    // Query filters
    if (assigned_to) {
      conditions.push('t.assigned_to = ?');
      params.push(assigned_to);
    }
    if (category) {
      conditions.push('t.category = ?');
      params.push(category);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY t.created_at DESC';

    const tasks = await db.query(queryStr, params);
    res.json(tasks);
  } catch (err) {
    console.error('Get Tasks Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
}

/**
 * Update a task (status, assignee, priority, description, etc.)
 * PUT /api/tasks/:id
 */
async function updateTask(req, res) {
  const taskId = req.params.id;
  const { title, description, category, priority, status, assigned_to, effort_hours, comment } = req.body;

  try {
    // 1. Fetch current task details
    const tasks = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    const currentTask = tasks[0];

    const updatedTitle = title || currentTask.title;
    const updatedDesc = description !== undefined ? description : currentTask.description;
    const updatedCat = category || currentTask.category;
    const updatedPriority = priority || currentTask.priority;
    const updatedStatus = status || currentTask.status;
    const updatedAssignee = assigned_to !== undefined ? assigned_to : currentTask.assigned_to;
    const updatedHours = effort_hours !== undefined ? effort_hours : currentTask.effort_hours;

    // 2. Perform updates
    await db.query(
      `UPDATE tasks SET 
        title = ?, description = ?, category = ?, priority = ?, 
        status = ?, assigned_to = ?, effort_hours = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedCat, updatedPriority, updatedStatus, updatedAssignee, updatedHours, taskId]
    );

    // 3. Log Status Changes in TaskHistory
    if (currentTask.status !== updatedStatus) {
      await db.query(
        'INSERT INTO task_history (task_id, changed_by, old_status, new_status, comment) VALUES (?, ?, ?, ?, ?)',
        [taskId, req.user.id, currentTask.status, updatedStatus, comment || `Status updated to "${updatedStatus}".`]
      );

      // Notify PMs/Managers on task updates (especially if completed)
      const projects = await db.query('SELECT name FROM projects WHERE id = ?', [currentTask.project_id]);
      const projectName = projects[0]?.name || 'Project';
      
      const managers = await db.query('SELECT id FROM users WHERE role IN ("pm", "admin")');
      for (const mgr of managers) {
        await notificationService.sendNotification(
          mgr.id,
          `Task Status Updated: ${updatedTitle}`,
          `Task "${updatedTitle}" on project "${projectName}" was moved from "${currentTask.status}" to "${updatedStatus}" by ${req.user.name}.`,
          'in_app'
        );
      }
    }

    // 4. Handle Assignee Change Notifications
    if (updatedAssignee !== currentTask.assigned_to && updatedAssignee) {
      const projects = await db.query('SELECT name FROM projects WHERE id = ?', [currentTask.project_id]);
      const projectName = projects[0]?.name || 'Project';
      await notificationService.triggerTaskAssignedAlert(taskId, updatedTitle, updatedAssignee, projectName);
    }

    // 5. Log Activity
    await db.query(
      'INSERT INTO activity_logs (project_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
      [currentTask.project_id, req.user.id, 'TASK_UPDATE', `Task "${updatedTitle}" status changed to "${updatedStatus}".`]
    );

    res.json({
      message: 'Task updated successfully',
      task: { id: taskId, title: updatedTitle, status: updatedStatus, assigned_to: updatedAssignee }
    });

  } catch (err) {
    console.error('Update Task Error:', err.message);
    res.status(500).json({ error: 'Failed to update task.' });
  }
}

/**
 * Fetch task history logs for a specific task
 * GET /api/tasks/:id/history
 */
async function getTaskHistory(req, res) {
  const taskId = req.params.id;

  try {
    const history = await db.query(
      `SELECT h.*, u.name as user_name, u.role as user_role 
       FROM task_history h
       INNER JOIN users u ON h.changed_by = u.id
       WHERE h.task_id = ?
       ORDER BY h.created_at DESC`,
      [taskId]
    );
    res.json(history);
  } catch (err) {
    console.error('Get Task History Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve task history logs.' });
  }
}

module.exports = {
  createTask,
  getTasks,
  updateTask,
  getTaskHistory
};
