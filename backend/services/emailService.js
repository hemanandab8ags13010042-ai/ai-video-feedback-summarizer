const nodemailer = require('nodemailer');

let transporter = null;

// Initialize the SMTP email transporter
async function initTransporter() {
  const useSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (useSMTP) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('✉️ SMTP Email Transporter initialized successfully.');
    } catch (err) {
      console.warn('⚠️ SMTP Transporter init failed. Falling back to mock console logs. Error:', err.message);
      transporter = null;
    }
  } else {
    console.log('ℹ️ SMTP credentials missing in env. Fallback mock email logging will be used.');
    transporter = null;
  }
}

/**
 * Generates a professional, responsive HTML email template for system notifications.
 */
function getBrandedTemplate(title, message, callToActionLink = '', callToActionText = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #0f172a;
      padding: 32px;
      text-align: left;
      border-bottom: 3px solid #7c3aed;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.025em;
    }
    .logo-accent {
      color: #a78bfa;
    }
    .content {
      padding: 40px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.25;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .button-container {
      margin-top: 32px;
      margin-bottom: 16px;
    }
    .button {
      background-color: #7c3aed;
      color: #ffffff !important;
      padding: 12px 24px;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px 40px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">DigiQuest <span class="logo-accent">Studio</span></div>
    </div>
    <div class="content">
      <h1 class="title">${title}</h1>
      <div class="message">${message.replace(/\n/g, '<br>')}</div>
      ${callToActionLink ? `
      <div class="button-container">
        <a href="${callToActionLink}" class="button" target="_blank">${callToActionText || 'Open Dashboard'}</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      This is an automated notification from DigiQuest Studio.<br>
      Please do not reply directly to this email.<br>
      © 2026 DigiQuest Studio. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends a notification email
 * @param {string} toEmail Recipient address
 * @param {string} subject Message header
 * @param {string} textContent Raw text fallback
 * @param {string} htmlContent Formatted message body
 * @param {Array} attachments Attachments payload for nodemailer
 */
async function sendNotificationEmail(toEmail, subject, textContent, htmlContent = '', attachments = []) {
  // Ensure transporter is checked/loaded
  if (transporter === null) {
    await initTransporter();
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"DigiQuest Studio Alerts" <alerts@digiquest.studio>',
    to: toEmail,
    subject: subject,
    text: textContent,
    html: htmlContent || getBrandedTemplate(subject, textContent),
    attachments: attachments
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email dispatched to ${toEmail} successfully (Message ID: ${info.messageId})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send email to ${toEmail}:`, err.message);
    }
  } else {
    // Development Mock Logger
    console.log('\n=================== ✉️ MOCK EMAIL DISPATCH ===================');
    console.log(`To:      ${toEmail}`);
    console.log(`From:    ${mailOptions.from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    ${textContent}`);
    if (attachments && attachments.length > 0) {
      console.log(`Attachments: [${attachments.map(a => a.filename).join(', ')}] (PDF Buffer Included)`);
    }
    console.log('===============================================================\n');
    return { mockSent: true };
  }
}

module.exports = {
  sendNotificationEmail
};
