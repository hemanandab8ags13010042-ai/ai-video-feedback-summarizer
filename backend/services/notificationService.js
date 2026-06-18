const db = require('../config/db');
const pdfService = require('./pdfService');

const DASHBOARD_URL = process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app';

// ─────────────────────────────────────────────────────────────────────────────
// Core dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persists a notification record and dispatches an email.
 *
 * @param {number} userId           Target user's database ID
 * @param {string} title            Short headline / email subject
 * @param {string} message          Full descriptive body text
 * @param {string} type             'in_app' | 'email' | 'whatsapp'
 * @param {Array}  attachments      Nodemailer attachment objects (e.g. PDF buffers)
 * @param {string} ctaLink          Optional call-to-action URL for the email button
 * @param {string} ctaText          Optional call-to-action button label
 * @param {string} badgeLabel       Optional status badge text shown above the headline
 * @param {string} badgeColor       Optional badge background colour (hex)
 */
async function sendNotification(
  userId,
  title,
  message,
  type = 'in_app',
  attachments = [],
  ctaLink = '',
  ctaText = '',
  badgeLabel = '',
  badgeColor = '#7c3aed'
) {
  try {
    // 1. Fetch recipient details
    const users = await db.query('SELECT name, email FROM users WHERE id = ?', [userId]);
    const user = users[0];
    const emailStr = user ? user.email : 'unknown@studio.com';
    const nameStr  = user ? user.name  : 'User';

    // 2. Persist in-app notification record
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type, read_status) VALUES (?, ?, ?, ?, 0)',
      [userId, title, message, type]
    );

    // 3. Console log
    console.log(`\n🔔 NOTIFICATION → [${nameStr}] | ${title}`);

    // 4. Dispatch branded email (non-blocking)
    const emailService = require('./emailService');
    emailService.sendNotificationEmail(
      emailStr,
      title,
      message,
      ctaLink,
      ctaText,
      badgeLabel,
      badgeColor,
      attachments
    ).catch(emailErr => {
      console.error(`❌ sendNotification email dispatch failed for ${emailStr}:`, emailErr.message);
    });

    console.log(`   📱 [WhatsApp] Alert queued for ${nameStr}`);
    console.log(`──────────────────────────────────────────\n`);

  } catch (err) {
    console.error('❌ sendNotification failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: New feedback submitted by client
// ─────────────────────────────────────────────────────────────────────────────
async function triggerNewFeedbackAlert(projectId, projectName, clientName) {
  // Build PDF attachment from latest AI results
  let attachments = [];
  try {
    const aiRows = await db.query(
      'SELECT * FROM ai_results WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    if (aiRows.length > 0) {
      const ai = aiRows[0];
      const sections = [];
      if (ai.summary)       sections.push({ heading: 'AI Summary',            body: ai.summary });
      if (ai.action_items)  sections.push({ heading: 'Key Action Items',       body: ai.action_items });
      if (ai.editing_tasks) sections.push({ heading: 'Editing Directives',     body: ai.editing_tasks });
      if (ai.vfx_tasks)     sections.push({ heading: 'VFX Directives',         body: ai.vfx_tasks });
      if (ai.suggestions)   sections.push({ heading: 'Creative Suggestions',   body: ai.suggestions });

      if (sections.length > 0) {
        const pdfBuffer = await pdfService.generatePDFBuffer(
          `Feedback Analysis Report — ${projectName}`,
          `Automated Pipeline Directive | Client: ${clientName}`,
          sections
        );
        attachments.push({
          filename: `Feedback_Report_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content: pdfBuffer
        });
      }
    }
  } catch (err) {
    console.error('PDF generation failed (feedback alert):', err.message);
  }

  const recipients = await db.query(
    `SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')`
  );

  const hasPDF = attachments.length > 0;
  const pdfNote = hasPDF
    ? '\n\n📎 **Attached:** AI Feedback Analysis Report (PDF) — review the directive breakdown for full task details.'
    : '';

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `📋 New Client Feedback — ${projectName}`,
      `**Client ${clientName}** has submitted new revision feedback for project **"${projectName}"**.\n\n` +
      `The AI analysis pipeline has compiled the comments into structured editing, VFX, audio and subtitle directives. ` +
      `Please review and assign tasks to your team accordingly.${pdfNote}`,
      'email',
      attachments,
      `${DASHBOARD_URL}/projects`,
      '📁 Open Projects',
      'NEW FEEDBACK',
      '#0ea5e9'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: Task assigned to a team member
// ─────────────────────────────────────────────────────────────────────────────
async function triggerTaskAssignedAlert(taskId, taskTitle, userId, projectName) {
  await sendNotification(
    userId,
    `📌 New Task Assigned — ${taskTitle}`,
    `You have been assigned a new task on the **"${projectName}"** project.\n\n` +
    `**Task:** ${taskTitle}\n\n` +
    `Please review the task requirements, update the Kanban board status as you progress, and ensure completion before the project deadline.`,
    'email',
    [],
    `${DASHBOARD_URL}/tasks`,
    '📋 View Task Board',
    'TASK ASSIGNED',
    '#7c3aed'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: Project deadline approaching
// ─────────────────────────────────────────────────────────────────────────────
async function triggerDeadlineNearAlert(projectId, projectName, daysLeft) {
  const urgency = daysLeft <= 1 ? '🚨 CRITICAL' : daysLeft <= 3 ? '⚠️ URGENT' : '⚠️ DEADLINE NEAR';
  const color   = daysLeft <= 1 ? '#ef4444' : daysLeft <= 3 ? '#f97316' : '#eab308';

  const team = await db.query(
    `SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')`
  );

  for (const member of team) {
    if (!member.id) continue;
    await sendNotification(
      member.id,
      `${urgency}: ${projectName} — ${daysLeft} Day${daysLeft !== 1 ? 's' : ''} Remaining`,
      `The project **"${projectName}"** is due in **${daysLeft} day${daysLeft !== 1 ? 's' : ''}**.\n\n` +
      `Please review all open tasks on the Kanban board and ensure they are progressing or completed before the deadline. ` +
      `Contact your Production Manager immediately if blockers exist.`,
      'email',
      [],
      `${DASHBOARD_URL}/projects`,
      '📁 Review Project',
      urgency.replace(/[🚨⚠️]/g, '').trim(),
      color
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: Project marked as completed
// ─────────────────────────────────────────────────────────────────────────────
async function triggerProjectCompletedAlert(projectId, projectName) {
  // Build completion PDF report
  let attachments = [];
  try {
    const tasks = await db.query(
      'SELECT title, category, priority, status, effort_hours FROM tasks WHERE project_id = ?',
      [projectId]
    );

    let taskBody = '';
    tasks.forEach(t => {
      taskBody += `• [${t.status.toUpperCase()}] ${t.title} (${t.category.toUpperCase()}) — Priority: ${t.priority}, Effort: ${t.effort_hours || 0} hrs\n`;
    });

    const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.effort_hours) || 0), 0);

    const sections = [
      {
        heading: 'Project Completion Summary',
        body: `All revision directives for project "${projectName}" have been successfully completed and approved by the client.\n\nTotal Tasks: ${tasks.length} | Total Effort: ${totalHours.toFixed(1)} hrs`
      },
      {
        heading: 'Task Delivery Checklist',
        body: taskBody || 'No tasks recorded.'
      }
    ];

    const pdfBuffer = await pdfService.generatePDFBuffer(
      `Project Completion Report — ${projectName}`,
      `Final Execution Audit Log · DigiQuest Studio`,
      sections
    );
    attachments.push({
      filename: `Completion_Report_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      content: pdfBuffer
    });
  } catch (err) {
    console.error('PDF generation failed (completion alert):', err.message);
  }

  const projects = await db.query('SELECT client_name FROM projects WHERE id = ?', [projectId]);
  const clientName = projects[0]?.client_name || '';

  const recipients = await db.query(`
    SELECT id, role FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
    UNION
    SELECT id, role FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'
  `, [clientName, clientName]);

  for (const r of recipients) {
    const isClient = r.role === 'client';
    const bodyMsg = isClient
      ? `Congratulations! Your project **"${projectName}"** has been fully completed and all revision tasks have been approved.\n\n` +
        `Our team has successfully delivered every directive to specification. Thank you for your collaboration and valuable feedback throughout this production.\n\n` +
        `📎 **Attached:** Full Project Completion Report (PDF) — for your records.`
      : `Project **"${projectName}"** has been marked as **COMPLETED** and all revision tasks have been signed off.\n\n` +
        `The client has given final approval. Great work team!\n\n` +
        `📎 **Attached:** Project Completion Report (PDF) — includes full task audit log.`;

    await sendNotification(
      r.id,
      `🎉 Project Completed — ${projectName}`,
      bodyMsg,
      'email',
      attachments,
      `${DASHBOARD_URL}/projects`,
      isClient ? '📁 View Your Projects' : '📁 Open Project Dashboard',
      'PROJECT COMPLETED',
      '#10b981'
    );
  }

  // Fallback: unregistered client (email address stored as client_name)
  if (clientName && clientName.includes('@')) {
    const registered = await db.query(
      `SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'`,
      [clientName, clientName]
    );
    if (registered.length === 0) {
      const emailService = require('./emailService');
      await emailService.sendNotificationEmail(
        clientName.trim(),
        `🎉 Project Completed — ${projectName}`,
        `Your project **"${projectName}"** has been fully completed and all revision tasks approved.\n\n` +
        `Our team has delivered every directive to specification. Thank you for your collaboration!\n\n` +
        `📎 **Attached:** Full Project Completion Report (PDF) — for your records.`,
        `${DASHBOARD_URL}`,
        '🎬 Visit DigiQuest Studio',
        'PROJECT COMPLETED',
        '#10b981',
        attachments
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: New comment added on a video version
// ─────────────────────────────────────────────────────────────────────────────
async function triggerNewCommentAlert(projectId, projectName, commenterName, commentText) {
  const projects = await db.query('SELECT client_name FROM projects WHERE id = ?', [projectId]);
  const clientName = projects[0]?.client_name || '';

  const recipients = await db.query(`
    SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
    UNION
    SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'
  `, [clientName, clientName]);

  const snippet = commentText.length > 120 ? commentText.substring(0, 120) + '…' : commentText;

  for (const r of recipients) {
    await sendNotification(
      r.id,
      `💬 New Comment — ${projectName}`,
      `**${commenterName}** has added a new timestamped comment on project **"${projectName}"**.\n\n` +
      `**Comment:** "${snippet}"\n\n` +
      `Log in to view the full comment thread, respond, and update task status if action is required.`,
      'in_app',
      [],
      `${DASHBOARD_URL}/projects`,
      '📁 View Project',
      'NEW COMMENT',
      '#06b6d4'
    );
  }

  // Fallback: unregistered client
  if (clientName && clientName.includes('@')) {
    const registered = await db.query(
      `SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'`,
      [clientName, clientName]
    );
    if (registered.length === 0) {
      const emailService = require('./emailService');
      await emailService.sendNotificationEmail(
        clientName.trim(),
        `💬 New Comment on Your Project — ${projectName}`,
        `**${commenterName}** has added a new comment on project **"${projectName}"**.\n\n` +
        `**Comment:** "${snippet}"\n\n` +
        `Register on DigiQuest Studio to view the full review session and respond directly.`,
        `${DASHBOARD_URL}`,
        '🎬 Visit DigiQuest Studio',
        'NEW COMMENT',
        '#06b6d4'
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: Project pipeline status changed
// ─────────────────────────────────────────────────────────────────────────────
async function triggerProjectStatusUpdatedAlert(projectId, projectName, oldStatus, newStatus) {
  if (oldStatus === newStatus) return;

  const projects = await db.query('SELECT client_name FROM projects WHERE id = ?', [projectId]);
  const clientName = projects[0]?.client_name || '';

  const recipients = await db.query(`
    SELECT id, role FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist')
    UNION
    SELECT id, role FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'
  `, [clientName, clientName]);

  // Pick badge colour based on new status
  const statusColors = {
    draft:          '#64748b',
    in_review:      '#0ea5e9',
    editing:        '#f97316',
    vfx:            '#8b5cf6',
    audio_mix:      '#06b6d4',
    pending_review: '#eab308',
    completed:      '#10b981'
  };
  const badgeColor = statusColors[newStatus] || '#7c3aed';

  // Status label formatting
  const fmtStatus = s => s.replace(/_/g, ' ').toUpperCase();

  for (const r of recipients) {
    const isClient = r.role === 'client';
    const bodyMsg = isClient
      ? `The production pipeline for your project **"${projectName}"** has moved to a new stage.\n\n` +
        `**Previous Status:** ${fmtStatus(oldStatus)}\n` +
        `**Current Status: ${fmtStatus(newStatus)}**\n\n` +
        `Our team is actively working on your project. You will receive further updates as each milestone is reached. ` +
        `Log in to your dashboard to track progress in real time.`
      : `The pipeline status for project **"${projectName}"** has been updated.\n\n` +
        `**Previous Status:** ${fmtStatus(oldStatus)}\n` +
        `**New Status: ${fmtStatus(newStatus)}**\n\n` +
        `Please review open tasks and ensure your team's workload is aligned with the new stage requirements.`;

    await sendNotification(
      r.id,
      `🔄 Status Update — ${projectName} → ${fmtStatus(newStatus)}`,
      bodyMsg,
      'email',
      [],
      `${DASHBOARD_URL}/projects`,
      '📁 View Project Pipeline',
      `STATUS: ${fmtStatus(newStatus)}`,
      badgeColor
    );
  }

  // Fallback: unregistered client
  if (clientName && clientName.includes('@')) {
    const registered = await db.query(
      `SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'`,
      [clientName, clientName]
    );
    if (registered.length === 0) {
      const emailService = require('./emailService');
      await emailService.sendNotificationEmail(
        clientName.trim(),
        `🔄 Project Status Update — ${projectName}`,
        `The production pipeline for your project **"${projectName}"** has moved to a new stage.\n\n` +
        `**Previous Status:** ${fmtStatus(oldStatus)}\n` +
        `**Current Status: ${fmtStatus(newStatus)}**\n\n` +
        `Our team is actively working on your project. Register on DigiQuest Studio to track progress in real time.`,
        `${DASHBOARD_URL}`,
        '🎬 Visit DigiQuest Studio',
        `STATUS: ${fmtStatus(newStatus)}`,
        badgeColor
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  sendNotification,
  triggerNewFeedbackAlert,
  triggerTaskAssignedAlert,
  triggerDeadlineNearAlert,
  triggerProjectCompletedAlert,
  triggerNewCommentAlert,
  triggerProjectStatusUpdatedAlert
};
