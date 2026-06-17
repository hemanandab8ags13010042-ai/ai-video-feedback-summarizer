require('dotenv').config();
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');

async function run() {
  const recipient = process.argv[2] || process.env.SMTP_USER || 'test@example.com';
  
  console.log('✉️ Starting SMTP Email Trigger test with PDF attachment...');
  console.log(`Configured SMTP Host: ${process.env.SMTP_HOST || 'None (Fallback to mock)'}`);
  console.log(`Configured SMTP User: ${process.env.SMTP_USER || 'None'}`);
  console.log(`Sending test email to: ${recipient}`);
  
  try {
    const sections = [
      { heading: 'AI Summary Overview', body: 'AI has analyzed client revision feedback. Key requests highlight fixing background color drift, updating titles, and sharpening main VFX tracking markers.' },
      { heading: 'Action Items Checklist', body: '1. Resolve background light leaks.\n2. Extend outro by 45 frames.\n3. Complete VFX paintout.' }
    ];

    const pdfBuffer = await pdfService.generatePDFBuffer(
      'Feedback Analysis Report: Test Project Alpha',
      'Automated Pipeline Directive Audit Log',
      sections
    );

    const attachments = [
      {
        filename: 'Feedback_Report_Test_Project_Alpha.pdf',
        content: pdfBuffer
      }
    ];

    const result = await emailService.sendNotificationEmail(
      recipient,
      '🧪 DigiQuest Studio: SMTP Professional Email & PDF Test',
      'Hello!\n\nThis is a real-time verification email sent from your DigiQuest Studio instance to confirm that professional HTML emails and PDF attachments are working correctly.\n\nPlease find the attached PDF report.',
      '',
      attachments
    );
    
    if (result && result.mockSent) {
      console.log('\nℹ️ TEST RESULT: SMTP credentials are not configured in your env file.');
      console.log('   The email and PDF attachment mock was simulated and logged in the console above.');
    } else {
      console.log('\n🎉 TEST RESULT: SUCCESS!');
      console.log(`   A professional HTML email with PDF attachment has been dispatched to ${recipient}. Please check your inbox and spam folder.`);
    }
  } catch (err) {
    console.error('\n❌ TEST RESULT: FAILED!');
    console.error('   SMTP / PDF connection error occurred:', err.message);
  }
  process.exit(0);
}

run();
