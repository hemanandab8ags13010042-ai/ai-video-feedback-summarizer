const db = require('../config/db');

/**
 * Generate and download reports
 * GET /api/reports
 */
async function generateReport(req, res) {
  const { type, format } = req.query;

  if (!type) {
    return res.status(400).json({ error: 'Report type is required (productivity, revision_history, team_performance, project_completion).' });
  }

  const outputFormat = format || 'json';

  try {
    let reportData = [];
    let filename = `report_${type}_${Date.now()}`;

    // --- 1. Query appropriate data ---
    if (type === 'productivity') {
      reportData = await db.query(`
        SELECT u.name as staff_name, u.role as staff_role, 
               COUNT(t.id) as completed_tasks, 
               SUM(t.effort_hours) as total_hours_spent, 
               AVG(t.effort_hours) as avg_hours_per_task
        FROM users u
        INNER JOIN tasks t ON u.id = t.assigned_to
        WHERE t.status = 'completed'
        GROUP BY u.id, u.name, u.role
        ORDER BY completed_tasks DESC
      `);
    } 
    
    else if (type === 'revision_history') {
      reportData = await db.query(`
        SELECT p.name as project_name, f.type as feedback_type, 
               f.content as feedback_text, f.created_at as submitted_date,
               ai.priority_detected, ai.effort_estimate
        FROM feedback f
        INNER JOIN projects p ON f.project_id = p.id
        LEFT JOIN ai_results ai ON f.id = ai.feedback_id
        ORDER BY f.created_at DESC
      `);
    } 
    
    else if (type === 'team_performance') {
      reportData = await db.query(`
        SELECT u.name as staff_name, u.role as staff_role,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as tasks_completed,
               SUM(CASE WHEN t.status != 'completed' THEN 1 ELSE 0 END) as tasks_active,
               COUNT(t.id) as total_tasks,
               SUM(t.effort_hours) as total_hours_scheduled
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assigned_to
        WHERE u.role IN ('editor', 'vfx_artist')
        GROUP BY u.id, u.name, u.role
      `);
    } 
    
    else if (type === 'project_completion') {
      reportData = await db.query(`
        SELECT p.name as project_name, p.client_name, p.status as project_status, 
               p.deadline, p.priority,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
               COUNT(t.id) as total_tasks
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, p.name, p.client_name, p.status, p.deadline, p.priority
        ORDER BY p.deadline ASC
      `);
    } 
    
    else {
      return res.status(400).json({ error: 'Invalid report type requested.' });
    }

    // --- 2. Register report entry in DB ---
    await db.query(
      'INSERT INTO reports (title, type, file_url, created_by) VALUES (?, ?, ?, ?)',
      [
        `Report: ${type.toUpperCase()}`,
        outputFormat,
        `/api/reports?type=${type}&format=${outputFormat}`,
        req.user.id
      ]
    );

    // --- 3. Format output payload ---
    if (outputFormat === 'csv') {
      if (reportData.length === 0) {
        return res.status(404).send('No data available for this report.');
      }

      const headers = Object.keys(reportData[0]);
      const csvRows = [headers.join(',')];

      for (const row of reportData) {
        const values = headers.map(header => {
          const val = row[header];
          // Escape quotes and format strings
          if (typeof val === 'string') {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val === null || val === undefined ? '' : val;
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.status(200).send(csvContent);
    } 
    
    // Default JSON response
    res.json({
      type,
      generatedAt: new Date(),
      data: reportData
    });

  } catch (err) {
    console.error('Report Generation Error:', err.message);
    res.status(500).json({ error: 'Failed to generate requested report.' });
  }
}

/**
 * List all generated reports history
 * GET /api/reports/history
 */
async function getReportsHistory(req, res) {
  try {
    const history = await db.query(`
      SELECT r.*, u.name as creator_name 
      FROM reports r
      INNER JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(history);
  } catch (err) {
    console.error('Get Reports History Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve reports history.' });
  }
}

module.exports = {
  generateReport,
  getReportsHistory
};
