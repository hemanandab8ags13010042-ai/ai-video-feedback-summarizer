const db = require('../config/db');
const PDFDocument = require('pdfkit');

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
    if (outputFormat === 'pdf') {
      if (reportData.length === 0) {
        return res.status(404).send('No data available for this report.');
      }

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      
      // Stream PDF directly to response
      doc.pipe(res);

      // --- Header Design ---
      // Branded logo background accent
      doc.rect(0, 0, 612, 100).fill('#161D30');
      doc.fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .fontSize(20)
         .text('DIGIQUEST STUDIO', 50, 30);
      doc.fontSize(10)
         .font('Helvetica')
         .text('Enterprise Video Feedback & Pipeline Analytics', 50, 55);

      // Report metadata in header right
      doc.fillColor('#A78BFA')
         .fontSize(10)
         .text(`REPORT: ${type.toUpperCase().replace('_', ' ')}`, 380, 30, { align: 'right', width: 165 })
         .fillColor('#94A3B8')
         .text(`Generated: ${new Date().toLocaleDateString()}`, 380, 45, { align: 'right', width: 165 })
         .text(`By: ${req.user.name}`, 380, 60, { align: 'right', width: 165 });

      // Move cursor below header
      doc.y = 130;
      doc.fillColor('#1E293B');

      // --- Body ---
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#7C3AED')
         .text(`${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} Overview`, 50, doc.y);
      
      doc.moveDown(1);

      // Define table headers and keys based on report type
      let headers = [];
      let keys = [];
      let colWidths = [];

      if (type === 'productivity') {
        headers = ['Staff Name', 'Role', 'Completed Tasks', 'Total Hours', 'Avg Hours/Task'];
        keys = ['staff_name', 'staff_role', 'completed_tasks', 'total_hours_spent', 'avg_hours_per_task'];
        colWidths = [120, 100, 100, 80, 95];
      } else if (type === 'revision_history') {
        headers = ['Project Name', 'Type', 'Feedback', 'Priority', 'Effort'];
        keys = ['project_name', 'feedback_type', 'feedback_text', 'priority_detected', 'effort_estimate'];
        colWidths = [110, 80, 185, 65, 55];
      } else if (type === 'team_performance') {
        headers = ['Staff Name', 'Role', 'Completed', 'Active', 'Total', 'Hours Scheduled'];
        keys = ['staff_name', 'staff_role', 'tasks_completed', 'tasks_active', 'total_tasks', 'total_hours_scheduled'];
        colWidths = [120, 95, 70, 55, 50, 105];
      } else if (type === 'project_completion') {
        headers = ['Project Name', 'Client', 'Status', 'Deadline', 'Tasks Completed'];
        keys = ['project_name', 'client_name', 'project_status', 'deadline', 'completed_tasks'];
        colWidths = [120, 110, 95, 95, 75];
      }

      // Draw table header row
      const startY = doc.y;
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor('#475569');

      let currentX = 50;
      headers.forEach((header, index) => {
        doc.text(header, currentX, startY, { width: colWidths[index], truncate: true });
        currentX += colWidths[index];
      });

      // Draw horizontal line under headers
      doc.moveTo(50, startY + 15)
         .lineTo(545, startY + 15)
         .strokeColor('#CBD5E1')
         .lineWidth(1)
         .stroke();

      doc.y = startY + 25;
      
      // Draw table rows
      doc.font('Helvetica')
         .fontSize(8.5)
         .fillColor('#334155');

      reportData.forEach((row, rowIndex) => {
        // Page break safety check
        if (doc.y > 750) {
          doc.addPage();
          // Redraw headers on new page
          const newPageY = 50;
          doc.font('Helvetica-Bold')
             .fontSize(9)
             .fillColor('#475569');

          let tempX = 50;
          headers.forEach((header, index) => {
            doc.text(header, tempX, newPageY, { width: colWidths[index], truncate: true });
            tempX += colWidths[index];
          });

          doc.moveTo(50, newPageY + 15)
             .lineTo(545, newPageY + 15)
             .strokeColor('#CBD5E1')
             .stroke();

          doc.y = newPageY + 25;
          doc.font('Helvetica')
             .fontSize(8.5)
             .fillColor('#334155');
        }

        const rowY = doc.y;
        let rowX = 50;

        keys.forEach((key, colIndex) => {
          let val = row[key];

          // Special formatting for columns
          if (key === 'completed_tasks' && type === 'project_completion') {
            val = `${row['completed_tasks'] || 0} / ${row['total_tasks'] || 0}`;
          } else if (key === 'deadline' && val) {
            val = new Date(val).toLocaleDateString();
          } else if (key === 'avg_hours_per_task' || key === 'effort_estimate' || key === 'total_hours_spent' || key === 'total_hours_scheduled') {
            val = val !== null && val !== undefined ? parseFloat(val).toFixed(1) + ' hrs' : '0.0 hrs';
          } else if (val === null || val === undefined) {
            val = 'N/A';
          } else {
            val = String(val);
          }

          doc.text(val, rowX, rowY, { width: colWidths[colIndex], height: 35, ellipsis: true });
          rowX += colWidths[colIndex];
        });

        // Alternate row background coloring (subtle stripe)
        if (rowIndex % 2 === 1) {
          doc.save()
             .rect(50, rowY - 4, 495, 20)
             .fillColor('#F8FAFC')
             .fillOpacity(0.4)
             .restore();
        }

        doc.y = rowY + 20;
      });

      // Footer signature
      doc.y = Math.max(doc.y + 30, 750);
      doc.moveTo(50, doc.y - 10)
         .lineTo(545, doc.y - 10)
         .strokeColor('#E2E8F0')
         .stroke();
         
      doc.fontSize(8)
         .fillColor('#94A3B8')
         .text('DigiQuest Studio Workflow Analytics — Generated securely under user session.', 50, doc.y, { align: 'center', width: 495 });

      // Close and finish PDF document
      doc.end();
      return;
    }

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
