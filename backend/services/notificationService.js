const db = require('../config/db');
const pdfService = require('./pdfService');

/**
 * Creates and logs notifications (In-app, Email, WhatsApp)
 * @param {number} userId Target user ID
 * @param {string} title Notification header
 * @param {string} message Detailed content
 * @param {string} type 'in_app' | 'email' | 'whatsapp'
 * @param {Array} attachments Attachments payload for nodemailer
 */
async function sendNotification(userId, title, message, type = 'in_app', attachments = []) {
  try {
    // 1. Fetch user detail
    const users = await db.query('SELECT name, email FROM users WHERE id = ?', [userId]);
    const user = users[0];
    const emailStr = user ? user.email : 'unknown@studio.com';
    const nameStr = user ? user.name : 'User';

    // 2. Insert into notifications table
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type, read_status) VALUES (?, ?, ?, ?, 0)',
      [userId, title, message, type]
    );

    // 3. Mock External Delivery Integrations
    console.log(`\n🔔 NOTIFICATION TRIGGERED [Role: System, Target: ${nameStr}]`);
    console.log(`   Title:   ${title}`);
    console.log(`   Message: ${message}`);
    
    // Dispatch actual email
    const emailService = require('./emailService');
    await emailService.sendNotificationEmail(emailStr, title, message, '', attachments);
    
    // Simulate WhatsApp Delivery
    console.log(`   📱 [WhatsApp API Integration] Alerts dispatched to registered number for ${nameStr}`);
    console.log(`---------------------------------------------------\n`);

  } catch (err) {
    console.error('Failed to register notification:', err.message);
  }
}

async function triggerNewFeedbackAlert(projectId, projectName, clientName) {
  // Notify all studio staff members (PMs, Admins, Editors, and VFX Artists)
  const recipients = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
  `);

  // 1. Fetch AI Results to attach PDF if available
  let attachments = [];
  try {
    const aiRows = await db.query(
      'SELECT * FROM ai_results WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    if (aiRows.length > 0) {
      const aiResult = aiRows[0];
      const sections = [];
      if (aiResult.summary) sections.push({ heading: 'AI Summary', body: aiResult.summary });
      if (aiResult.action_items) sections.push({ heading: 'Key Action Items', body: aiResult.action_items });
      if (aiResult.editing_tasks) sections.push({ heading: 'Editing Directives', body: aiResult.editing_tasks });
      if (aiResult.vfx_tasks) sections.push({ heading: 'VFX Directives', body: aiResult.vfx_tasks });
      if (aiResult.suggestions) sections.push({ heading: 'Creative Suggestions', body: aiResult.suggestions });

      if (sections.length > 0) {
        const pdfBuffer = await pdfService.generatePDFBuffer(
          `Feedback Analysis Report: ${projectName}`,
          `Automated Pipeline Directive for Client ${clientName}`,
          sections
        );
        attachments.push({
          filename: `Feedback_Report_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content: pdfBuffer
        });
      }
    }
  } catch (err) {
    console.error('Failed to generate PDF attachment for new feedback:', err.message);
  }

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `New Feedback on ${projectName}`,
      `Client ${clientName} submitted new feedback for project "${projectName}". AI analysis is ready for review.`,
      'in_app',
      attachments
    );
  }
}

async function triggerTaskAssignedAlert(taskId, taskTitle, userId, projectName) {
  await sendNotification(
    userId,
    `New Task Assigned: ${taskTitle}`,
    `You have been assigned the task "${taskTitle}" for project "${projectName}".`,
    'in_app'
  );
}

async function triggerDeadlineNearAlert(projectId, projectName, daysLeft) {
  // Notify all studio staff members
  const team = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
  `);

  for (const member of team) {
    if (member.id) {
      await sendNotification(
        member.id,
        `⚠️ Deadline Approaching: ${projectName}`,
        `Project "${projectName}" is due in ${daysLeft} days. Please update status of remaining tasks.`,
        'email'
      );
    }
  }
}

async function triggerProjectCompletedAlert(projectId, projectName) {
  // Generate Project Completion Report PDF
  let attachments = [];
  try {
    const tasks = await db.query(
      "SELECT title, category, priority, status, effort_hours FROM tasks WHERE project_id = ?",
      [projectId]
    );

    let taskBody = '';
    tasks.forEach(t => {
      taskBody += `• [${t.status.toUpperCase()}] ${t.title} (${t.category.toUpperCase()}) - Priority: ${t.priority}, Effort: ${t.effort_hours} hrs\n`;
    });

    const sections = [
      { heading: 'Project Status Summary', body: `All revision directives have been successfully completed and approved.\nTotal task count: ${tasks.length}` },
      { heading: 'Task Checklist Details', body: taskBody || 'No tasks registered.' }
    ];

    const pdfBuffer = await pdfService.generatePDFBuffer(
      `Project Completion Report: ${projectName}`,
      `Final Execution Audit Log`,
      sections
    );
    attachments.push({
      filename: `Project_Completion_Report_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      content: pdfBuffer
    });
  } catch (err) {
    console.error('Failed to generate completion report PDF:', err.message);
  }

  // Notify Clients and Managers
  const projects = await db.query('SELECT client_name FROM projects WHERE id = ?', [projectId]);
  const clientName = projects[0]?.client_name || '';

  const recipients = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
    UNION
    SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'
  `, [clientName, clientName]);

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `🎉 Project Completed: ${projectName}`,
      `All revision tasks for project "${projectName}" have been marked complete and approved.`,
      'whatsapp',
      attachments
    );
  }
}

async function triggerNewCommentAlert(projectId, projectName, commenterName, commentText) {
  // Notify all managers, staff, and the project's client
  const projects = await db.query('SELECT client_name FROM projects WHERE id = ?', [projectId]);
  const clientName = projects[0]?.client_name || '';

  const recipients = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
    UNION
    SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'
  `, [clientName, clientName]);

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `New Comment on ${projectName}`,
      `User ${commenterName} added a comment on project "${projectName}": "${commentText}"`,
      'in_app'
    );
  }
}

module.exports = {
  sendNotification,
  triggerNewFeedbackAlert,
  triggerTaskAssignedAlert,
  triggerDeadlineNearAlert,
  triggerProjectCompletedAlert,
  triggerNewCommentAlert
};
