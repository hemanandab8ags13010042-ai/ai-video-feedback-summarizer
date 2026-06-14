const db = require('../config/db');

/**
 * Fetch stats, charts, and feed data for the dashboard
 * GET /api/dashboard
 */
async function getDashboardData(req, res) {
  try {
    const isClient = req.user.role === 'client';
    const clientName = req.user.name;

    // --- 1. Stats Cards queries ---
    let projectsCountQuery = 'SELECT COUNT(*) as count FROM projects';
    let reviewProjectsQuery = "SELECT COUNT(*) as count FROM projects WHERE status = 'review'";
    let activeTasksQuery = "SELECT COUNT(*) as count FROM tasks t INNER JOIN projects p ON t.project_id = p.id WHERE t.status != 'completed'";
    let completedTasksQuery = "SELECT COUNT(*) as count FROM tasks t INNER JOIN projects p ON t.project_id = p.id WHERE t.status = 'completed'";
    let overdueProjectsQuery = "SELECT COUNT(*) as count FROM projects WHERE status != 'completed' AND deadline < DATE('now')";

    const params = [];
    const projectParams = [];

    if (isClient) {
      projectsCountQuery += ' WHERE client_name = ?';
      reviewProjectsQuery += ' AND client_name = ?';
      activeTasksQuery += ' AND p.client_name = ?';
      completedTasksQuery += ' AND p.client_name = ?';
      overdueProjectsQuery += ' AND client_name = ?';

      params.push(clientName);
      projectParams.push(clientName);
    }

    const projectsCountRes = await db.query(projectsCountQuery, projectParams);
    const reviewCountRes = await db.query(reviewProjectsQuery, projectParams);
    const activeTasksRes = await db.query(activeTasksQuery, projectParams);
    const completedTasksRes = await db.query(completedTasksQuery, projectParams);
    
    // Fallback date-check comparison to work identically on MySQL/SQLite
    let overdueCount = 0;
    try {
      const overdueRes = await db.query(
        isClient 
          ? "SELECT COUNT(*) as count FROM projects WHERE client_name = ? AND status != 'completed' AND deadline < CURRENT_DATE"
          : "SELECT COUNT(*) as count FROM projects WHERE status != 'completed' AND deadline < CURRENT_DATE",
        projectParams
      );
      overdueCount = overdueRes[0]?.count || 0;
    } catch (e) {
      // If CURRENT_DATE / DATE('now') failed on MySQL, query all and filter in JS
      const deadlines = await db.query(
        isClient 
          ? "SELECT deadline FROM projects WHERE client_name = ? AND status != 'completed'"
          : "SELECT deadline FROM projects WHERE status != 'completed'",
        projectParams
      );
      const today = new Date();
      overdueCount = deadlines.filter(d => d.deadline && new Date(d.deadline) < today).length;
    }

    const stats = {
      totalProjects: projectsCountRes[0]?.count || 0,
      pendingReviews: reviewCountRes[0]?.count || 0,
      activeTasks: activeTasksRes[0]?.count || 0,
      completedTasks: completedTasksRes[0]?.count || 0,
      overdueTasks: overdueCount
    };

    // --- 2. Chart Data: Feedback Sources ---
    let feedbackSourcesQuery = 'SELECT f.type, COUNT(*) as count FROM feedback f';
    if (isClient) {
      feedbackSourcesQuery += ' INNER JOIN projects p ON f.project_id = p.id WHERE p.client_name = ?';
    }
    feedbackSourcesQuery += ' GROUP BY f.type';
    const feedbackSources = await db.query(feedbackSourcesQuery, projectParams);

    // --- 3. Chart Data: Team Productivity (Completed tasks per member) ---
    let productivityQuery = `
      SELECT u.name, COUNT(t.id) as completed_count 
      FROM tasks t 
      INNER JOIN users u ON t.assigned_to = u.id 
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.status = 'completed'
    `;
    if (isClient) {
      productivityQuery += ' AND p.client_name = ?';
    }
    productivityQuery += ' GROUP BY u.name';
    const productivity = await db.query(productivityQuery, projectParams);

    // --- 4. Chart Data: Task Category Breakdown (Editing vs VFX) ---
    let categoryQuery = `
      SELECT t.category, COUNT(*) as count 
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
    `;
    if (isClient) {
      categoryQuery += ' WHERE p.client_name = ?';
    }
    categoryQuery += ' GROUP BY t.category';
    const categoryBreakdown = await db.query(categoryQuery, projectParams);

    // --- 5. Activity Feed ---
    let activityQuery = `
      SELECT l.*, u.name as user_name, p.name as project_name 
      FROM activity_logs l 
      INNER JOIN users u ON l.user_id = u.id 
      INNER JOIN projects p ON l.project_id = p.id
    `;
    if (isClient) {
      activityQuery += ' WHERE p.client_name = ?';
    }
    activityQuery += ' ORDER BY l.created_at DESC LIMIT 10';
    const activityFeed = await db.query(activityQuery, projectParams);

    // --- 6. In-App Notifications ---
    const notifications = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 8',
      [req.user.id]
    );

    // --- 7. Team Workload (Active tasks per staff) ---
    const workload = await db.query(`
      SELECT u.name, u.role, COUNT(t.id) as active_tasks 
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to AND t.status != 'completed'
      WHERE u.role IN ('editor', 'vfx_artist')
      GROUP BY u.name, u.role
    `);

    res.json({
      stats,
      charts: {
        feedbackSources,
        productivity,
        categoryBreakdown
      },
      activityFeed,
      notifications,
      teamWorkload: workload
    });

  } catch (err) {
    console.error('Get Dashboard Data Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve dashboard analysis.' });
  }
}

/**
 * Mark notifications as read
 * PUT /api/dashboard/notifications/read
 */
async function markNotificationsRead(req, res) {
  try {
    await db.query('UPDATE notifications SET read_status = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    console.error('Mark Notifications Read Error:', err.message);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
}

module.exports = {
  getDashboardData,
  markNotificationsRead
};
