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
 * Sends a notification email
 * @param {string} toEmail Recipient address
 * @param {string} subject Message header
 * @param {string} textContent Raw text fallback
 * @param {string} htmlContent Formatted message body
 */
async function sendNotificationEmail(toEmail, subject, textContent, htmlContent = '') {
  // Ensure transporter is checked/loaded
  if (transporter === null) {
    await initTransporter();
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"DigiQuest Studio Alerts" <alerts@digiquest.studio>',
    to: toEmail,
    subject: subject,
    text: textContent,
    html: htmlContent || `<p>${textContent.replace(/\n/g, '<br>')}</p>`,
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
    console.log('===============================================================\n');
    return { mockSent: true };
  }
}

module.exports = {
  sendNotificationEmail
};
