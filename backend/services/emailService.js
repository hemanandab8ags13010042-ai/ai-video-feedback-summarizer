const nodemailer = require('nodemailer');
const https = require('https');

let transporter = null;

// Initialize the SMTP email transporter
async function initTransporter() {
  const useSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (useSMTP) {
    try {
      const isGmail = (process.env.SMTP_HOST || '').toLowerCase().includes('gmail');
      const defaultPort = isGmail ? 465 : 587;
      const defaultSecure = isGmail ? true : false;

      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || defaultPort,
        secure: process.env.SMTP_PORT ? (process.env.SMTP_SECURE === 'true') : defaultSecure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        family: 4, // Force IPv4 to prevent IPv6 timeout issues on Render
        connectionTimeout: 15000, // 15s timeout
        greetingTimeout: 15000,   // 15s greeting timeout
        socketTimeout: 20000     // 20s socket timeout
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
 * Generates a premium, responsive HTML email template for DigiQuest Studio notifications.
 * @param {string} title            Email headline shown inside the card
 * @param {string} message          Body text (supports \n line breaks)
 * @param {string} callToActionLink CTA button href
 * @param {string} callToActionText CTA button label
 * @param {string} badgeLabel       Optional coloured status badge (e.g. "PROJECT COMPLETED")
 * @param {string} badgeColor       Optional hex colour for the badge (#10b981, #7c3aed …)
 */
function getBrandedTemplate(
  title,
  message,
  callToActionLink = '',
  callToActionText = '',
  badgeLabel = '',
  badgeColor = '#7c3aed'
) {
  const currentYear = new Date().getFullYear();
  const dashboardUrl = process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app';

  // Convert plain newlines → HTML line breaks, and **bold** → <strong>
  const htmlMessage = message
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const badgeHtml = badgeLabel
    ? `<div style="display:inline-block;background-color:${badgeColor};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;padding:4px 12px;border-radius:999px;text-transform:uppercase;margin-bottom:20px;">${badgeLabel}</div>`
    : '';

  const ctaHtml = callToActionLink
    ? `
      <div style="margin-top:32px;">
        <a href="${callToActionLink}"
           target="_blank"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;font-weight:700;border-radius:8px;letter-spacing:0.025em;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
          ${callToActionText || 'Open Dashboard'}
        </a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);padding:28px 40px;border-bottom:3px solid #7c3aed;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1;">
                      DigiQuest <span style="color:#a78bfa;">Studio</span>
                    </div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:4px;letter-spacing:0.05em;text-transform:uppercase;">
                      Automated Notification System
                    </div>
                  </td>
                  <td align="right">
                    <div style="font-size:28px;">🎬</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Accent stripe ── -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#7c3aed,#06b6d4,#10b981);"></td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${badgeHtml}
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${title}
              </h1>
              <div style="font-size:15px;line-height:1.75;color:#475569;">
                ${htmlMessage}
              </div>
              ${ctaHtml}
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- ── Quick Links ── -->
          <tr>
            <td style="padding:20px 40px;background-color:#f8fafc;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">
                    Quick Links
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <a href="https://ai-video-feedback-summarizer.vercel.app/dashboard" target="_blank"
                       style="font-size:13px;color:#7c3aed;text-decoration:none;margin-right:20px;">
                      📊 Dashboard
                    </a>
                    <a href="https://ai-video-feedback-summarizer.vercel.app/dashboard" target="_blank"
                       style="font-size:13px;color:#7c3aed;text-decoration:none;margin-right:20px;">
                      📁 Projects
                    </a>
                    <a href="https://ai-video-feedback-summarizer.vercel.app/kanban" target="_blank"
                       style="font-size:13px;color:#7c3aed;text-decoration:none;">
                      ✅ Tasks
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:24px 40px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                This is an automated notification from <strong style="color:#64748b;">DigiQuest Studio</strong>.<br>
                Please do not reply directly to this email address.<br>
                © ${currentYear} DigiQuest Studio · All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Sends a professional branded notification email.
 * @param {string} toEmail           Recipient email address
 * @param {string} subject           Email subject line
 * @param {string} textContent       Plain-text fallback body
 * @param {string} callToActionLink  Optional CTA button URL
 * @param {string} callToActionText  Optional CTA button label
 * @param {string} badgeLabel        Optional coloured status badge text
 * @param {string} badgeColor        Optional badge background colour
 * @param {Array}  attachments       Nodemailer attachments array (for PDFs etc.)
 */
async function sendResendEmail(apiKey, { to, subject, html, text, attachments = [] }) {
  return new Promise((resolve, reject) => {
    const fromAddress = process.env.RESEND_FROM || 'DigiQuest Studio <onboarding@resend.dev>';

    const resendAttachments = attachments.map(att => {
      let contentBase64 = '';
      if (att.content) {
        contentBase64 = Buffer.isBuffer(att.content) 
          ? att.content.toString('base64') 
          : Buffer.from(att.content).toString('base64');
      }
      return {
        filename: att.filename,
        content: contentBase64 || undefined,
        path: att.path || undefined
      };
    }).filter(att => att.content || att.path);

    const payload = {
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
      text: text
    };

    if (resendAttachments.length > 0) {
      payload.attachments = resendAttachments;
    }

    const data = JSON.stringify(payload);

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ id: body });
          }
        } else {
          reject(new Error(`Resend API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

async function sendBrevoEmail(apiKey, { to, subject, html, text, attachments = [] }) {
  return new Promise((resolve, reject) => {
    const fromStr = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"DigiQuest Studio" <${process.env.SMTP_USER}>` : '"DigiQuest Studio Alerts" <alerts@digiquest.studio>');
    
    let senderObj = { name: 'DigiQuest Studio', email: 'alerts@digiquest.studio' };
    if (fromStr) {
      const match = fromStr.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)$/);
      if (match) {
        senderObj = { name: match[1]?.trim() || 'DigiQuest Studio', email: match[2]?.trim() };
      } else if (fromStr.includes('@')) {
        senderObj = { name: 'DigiQuest Studio', email: fromStr.trim() };
      }
    }

    const brevoAttachments = attachments.map(att => {
      let contentBase64 = '';
      if (att.content) {
        contentBase64 = Buffer.isBuffer(att.content) 
          ? att.content.toString('base64') 
          : Buffer.from(att.content).toString('base64');
      }
      return {
        name: att.filename,
        content: contentBase64 || undefined,
        url: att.path || undefined
      };
    }).filter(att => att.content || att.url);

    const payload = {
      sender: senderObj,
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
      textContent: text
    };

    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }

    const data = JSON.stringify(payload);

    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ id: body });
          }
        } else {
          reject(new Error(`Brevo API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function getActiveProvider() {
  if (process.env.RESEND_API_KEY) {
    return 'resend';
  } else if (process.env.BREVO_API_KEY) {
    return 'brevo';
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return 'smtp';
  }
  return 'mock';
}

async function sendNotificationEmail(
  toEmail,
  subject,
  textContent,
  callToActionLink = '',
  callToActionText = '',
  badgeLabel = '',
  badgeColor = '#7c3aed',
  attachments = []
) {
  const htmlContent = getBrandedTemplate(
    subject,
    textContent,
    callToActionLink,
    callToActionText,
    badgeLabel,
    badgeColor
  );

  const provider = getActiveProvider();

  if (provider === 'resend') {
    try {
      const info = await sendResendEmail(process.env.RESEND_API_KEY, {
        to: toEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
        attachments: attachments
      });
      console.log(`✉️ Email dispatched to ${toEmail} successfully via Resend API (ID: ${info.id || 'N/A'})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send email to ${toEmail} via Resend API:`, err.message);
    }
  } else if (provider === 'brevo') {
    try {
      const info = await sendBrevoEmail(process.env.BREVO_API_KEY, {
        to: toEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
        attachments: attachments
      });
      console.log(`✉️ Email dispatched to ${toEmail} successfully via Brevo API (Message ID: ${info.messageId || 'N/A'})`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send email to ${toEmail} via Brevo API:`, err.message);
    }
  } else if (provider === 'smtp') {
    if (transporter === null) {
      await initTransporter();
    }
    if (transporter) {
      const defaultFrom = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"DigiQuest Studio" <${process.env.SMTP_USER}>` : '"DigiQuest Studio Alerts" <alerts@digiquest.studio>');
      const mailOptions = {
        from: defaultFrom,
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
        attachments: attachments
      };
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️  Email dispatched to ${toEmail} successfully via SMTP (Message ID: ${info.messageId})`);
        return info;
      } catch (err) {
        console.error(`❌ Failed to send email to ${toEmail} via SMTP:`, err.message);
      }
    }
  }

  // Fallback to mock log if disabled or failed
  console.log('\n=================== ✉️ MOCK EMAIL DISPATCH ===================');
  console.log(`To:      ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${textContent}`);
  if (attachments && attachments.length > 0) {
    console.log(`Attachments: [${attachments.map(a => a.filename).join(', ')}]`);
  }
  console.log('===============================================================\n');
  return { mockSent: true };
}

module.exports = {
  sendNotificationEmail,
  getBrandedTemplate,
  getActiveProvider,
  sendResendEmail,
  sendBrevoEmail
};
