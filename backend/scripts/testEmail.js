require('dotenv').config();
const emailService = require('../services/emailService');

async function run() {
  const recipient = process.argv[2] || process.env.SMTP_USER || 'test@example.com';
  
  console.log('✉️ Starting SMTP Email Trigger test...');
  console.log(`Configured SMTP Host: ${process.env.SMTP_HOST || 'None (Fallback to mock)'}`);
  console.log(`Configured SMTP User: ${process.env.SMTP_USER || 'None'}`);
  console.log(`Sending test email to: ${recipient}`);
  
  try {
    const result = await emailService.sendNotificationEmail(
      recipient,
      '🧪 DigiQuest Studio: SMTP Integration Test',
      'Hello!\n\nThis is a real-time verification email sent from your DigiQuest Studio instance to confirm that SMTP credentials are set up and working correctly.\n\nHave a great day!'
    );
    
    if (result && result.mockSent) {
      console.log('\nℹ️ TEST RESULT: SMTP credentials are not configured in your env file.');
      console.log('   The email was simulated and logged in the console above.');
    } else {
      console.log('\n🎉 TEST RESULT: SUCCESS!');
      console.log(`   A real email has been dispatched to ${recipient}. Please check your inbox and spam folder.`);
    }
  } catch (err) {
    console.error('\n❌ TEST RESULT: FAILED!');
    console.error('   SMTP connection error occurred:', err.message);
  }
  process.exit(0);
}

run();
