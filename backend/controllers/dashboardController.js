const db = require('../config/db');

function analyzeTextSentiment(text) {
  if (!text) return 50; // Neutral
  const lowerText = text.toLowerCase();
  
  // Real emotional sentiment keywords - excluding standard editing jargon like "fix", "trim", "adjust"
  const positiveWords = ['great', 'love', 'awesome', 'good', 'thanks', 'perfect', 'approved', 'nice', 'excellent', 'happy', 'pleased', 'superb', 'fine', 'working', 'fantastic', 'amazing', 'brilliant', 'wonderful'];
  const negativeWords = ['bad', 'hate', 'terrible', 'broken', 'fail', 'poor', 'difficult', 'dislike', 'frustrated', 'disappointed', 'annoyed', 'angry', 'unhappy', 'useless', 'wasted', 'delay', 'late'];
  
  let hasPositive = positiveWords.some(w => lowerText.includes(w));
  let hasNegative = negativeWords.some(w => lowerText.includes(w));
  
  if (hasNegative) return 0;   // Negative tone
  if (hasPositive) return 100; // Positive tone
  return 50;                  // Neutral tone
}

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
      projectsCountQuery += ' WHERE (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?))';
      reviewProjectsQuery += ' AND (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?))';
      activeTasksQuery += ' AND (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
      completedTasksQuery += ' AND (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
      overdueProjectsQuery += ' AND (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?))';

      params.push(clientName, req.user.email);
      projectParams.push(clientName, req.user.email);
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
          ? "SELECT COUNT(*) as count FROM projects WHERE (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?)) AND status != 'completed' AND deadline < CURRENT_DATE"
          : "SELECT COUNT(*) as count FROM projects WHERE status != 'completed' AND deadline < CURRENT_DATE",
        projectParams
      );
      overdueCount = overdueRes[0]?.count || 0;
    } catch (e) {
      // If CURRENT_DATE / DATE('now') failed on MySQL, query all and filter in JS
      const deadlines = await db.query(
        isClient 
          ? "SELECT deadline FROM projects WHERE (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?)) AND status != 'completed'"
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
      feedbackSourcesQuery += ' INNER JOIN projects p ON f.project_id = p.id WHERE (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
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
      productivityQuery += ' AND (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
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
      categoryQuery += ' WHERE (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
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
      activityQuery += ' WHERE (LOWER(p.client_name) = LOWER(?) OR LOWER(p.client_name) = LOWER(?))';
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

    // --- 8. Client Sentiment & Project Health Radar ---
    let projectsQuery = 'SELECT id, name, client_name, deadline, status FROM projects';
    if (isClient) {
      projectsQuery += ' WHERE (LOWER(client_name) = LOWER(?) OR LOWER(client_name) = LOWER(?))';
    }
    const projects = await db.query(projectsQuery, projectParams);

    const projectHealthList = [];
    let overallScoreSum = 0;
    
    for (const proj of projects) {
      const feedbacks = await db.query('SELECT content FROM feedback WHERE project_id = ?', [proj.id]);
      const comments = await db.query(
        `SELECT c.comment 
         FROM feedback_comments c
         INNER JOIN video_versions vv ON c.version_id = vv.id
         INNER JOIN videos v ON vv.video_id = v.id
         WHERE v.project_id = ?`,
        [proj.id]
      );
      
      const allTexts = [
        ...feedbacks.map(f => f.content),
        ...comments.map(c => c.comment)
      ].filter(t => t && t.trim().length > 0);
      
      // Sentiment Breakdown Ratios based on client comment logs
      let positiveCount = 0;
      let neutralCount = 0;
      let negativeCount = 0;
      
      if (allTexts.length > 0) {
        allTexts.forEach(txt => {
          const s = analyzeTextSentiment(txt);
          if (s === 100) positiveCount++;
          else if (s === 0) negativeCount++;
          else neutralCount++;
        });
      }

      // Calculate project health score based on actual status, deadlines, active tasks, and client sentiments
      let projectScore = 100; // Perfect health base
      
      if (proj.status !== 'completed') {
        // 1. Overdue penalty of 30 points if current date is past deadline
        const today = new Date();
        if (proj.deadline && new Date(proj.deadline) < today) {
          projectScore -= 30;
        }
        
        // 2. Unresolved task penalties
        const activeTasks = await db.query(
          "SELECT priority FROM tasks WHERE project_id = ? AND status != 'completed'",
          [proj.id]
        );
        
        activeTasks.forEach(task => {
          if (task.priority === 'high') projectScore -= 8;
          else if (task.priority === 'medium') projectScore -= 4;
          else projectScore -= 2;
        });
        
        // Bind boundary limits to [10, 100]
        projectScore = Math.max(10, Math.min(100, projectScore));

        // 3. Incorporate Client Sentiment Score (50% weight)
        let sentimentScore = 100;
        if (allTexts.length > 0) {
          sentimentScore = (positiveCount * 100 + neutralCount * 50 + negativeCount * 0) / allTexts.length;
        }

        // Combined score: 50% task/deadline health + 50% client sentiment
        projectScore = Math.round(projectScore * 0.5 + sentimentScore * 0.5);
      }
      
      let status = 'Healthy';
      if (projectScore < 35) status = 'Critical';
      else if (projectScore < 70) status = 'At Risk';
      
      projectHealthList.push({
        projectId: proj.id,
        projectName: proj.name,
        clientName: proj.client_name,
        healthScore: projectScore,
        status,
        positiveCount,
        neutralCount,
        negativeCount,
        totalFeedbackCount: allTexts.length
      });
      
      overallScoreSum += projectScore;
    }
    
    const overallScore = projects.length > 0 ? Math.round(overallScoreSum / projects.length) : 100;

    res.json({
      stats,
      charts: {
        feedbackSources,
        productivity,
        categoryBreakdown
      },
      activityFeed,
      notifications,
      teamWorkload: workload,
      projectHealth: {
        overallScore,
        overallStatus: overallScore >= 70 ? 'Healthy' : overallScore >= 35 ? 'At Risk' : 'Critical',
        projects: projectHealthList
      }
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
