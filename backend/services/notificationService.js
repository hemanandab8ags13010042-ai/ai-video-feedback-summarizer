const db = require('../config/db');

/**
 * Creates and logs notifications (In-app, Email, WhatsApp)
 * @param {number} userId Target user ID
 * @param {string} title Notification header
 * @param {string} message Detailed content
 * @param {string} type 'in_app' | 'email' | 'whatsapp'
 */
async function sendNotification(userId, title, message, type = 'in_app') {
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
    
    // Simulate Email Delivery
    console.log(`   ✉️ [Email Delivery] Sent message to ${emailStr}`);
    
    // Simulate WhatsApp Delivery
    console.log(`   📱 [WhatsApp API Integration] Alerts dispatched to registered number for ${nameStr}`);
    console.log(`---------------------------------------------------\n`);

  } catch (err) {
    console.error('Failed to register notification:', err.message);
  }
}

/**
 * Trigger alerts for specific events
 */
async function triggerNewFeedbackAlert(projectId, projectName, clientName) {
  // Notify PMs and Admins
  const managers = await db.query("SELECT id FROM users WHERE role IN ('pm', 'admin')");
  for (const mgr of managers) {
    await sendNotification(
      mgr.id,
      `New Feedback on ${projectName}`,
      `Client ${clientName} submitted new feedback for project "${projectName}". AI analysis is ready for review.`,
      'in_app'
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
  const team = await db.query(`
    SELECT DISTINCT assigned_to as id FROM tasks WHERE project_id = ? AND assigned_to IS NOT NULL
    UNION
    SELECT DISTINCT id FROM users WHERE role IN ('pm', 'admin')
  `, [projectId]);

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
  // Notify Clients and Managers
  const recipients = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin')
    UNION
    SELECT DISTINCT u.id FROM users u 
    INNER JOIN feedback f ON u.id = f.user_id 
    WHERE f.project_id = ? AND u.role = 'client'
  `, [projectId]);

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `🎉 Project Completed: ${projectName}`,
      `All revision tasks for project "${projectName}" have been marked complete and approved.`,
      'whatsapp'
    );
  }
}

module.exports = {
  sendNotification,
  triggerNewFeedbackAlert,
  triggerTaskAssignedAlert,
  triggerDeadlineNearAlert,
  triggerProjectCompletedAlert
};
