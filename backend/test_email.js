require('dotenv').config();
const db = require('./config/db');

db.initDB().then(async () => {
  console.log('Testing full notification flow for Hemu...');
  
  const notificationService = require('./services/notificationService');
  
  // Test 1: Send direct notification to Hemu (user id=11)
  console.log('\n--- Test 1: Send notification to Hemu (id=11) ---');
  await notificationService.sendNotification(
    11,
    '🔔 Test Alert for Hemu',
    'This is a test email notification to verify the system is working for client Hemu (hemu82249@gmail.com).',
    'email'
  );

  // Test 2: Trigger project status update (simulates project status change)
  console.log('\n--- Test 2: Trigger project status update for project 4 (Hemu) ---');
  await notificationService.triggerProjectStatusUpdatedAlert(4, 'Toxic', 'draft', 'in_review');
  
  console.log('\n✅ Tests completed. Check hemu82249@gmail.com inbox.');
  process.exit(0);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
