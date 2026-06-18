require('dotenv').config();
const db = require('./config/db');

db.initDB().then(async () => {
  const notificationService = require('./services/notificationService');

  console.log('\n--- Test: Welcome email (client) ---');
  await notificationService.sendNotification(
    11, // Hemu
    '👋 Welcome to DigiQuest Studio, Hemu!',
    'Hi **Hemu**,\n\nWelcome to **DigiQuest Studio** — your dedicated portal for seamless video production collaboration.\n\nYour account has been created as a **Client**. Here is what you can expect:\n\n• **Video Review Sessions** — Watch your video cuts and leave timestamped feedback with drawings and voice notes\n• **Project Tracking** — Monitor the live status of your production pipeline\n• **Automated Alerts** — Receive email notifications at every key milestone\n• **Approval Workflow** — Approve final cuts or request revisions directly in the platform\n\nLog in now to view your projects and get started.',
    'email',
    [],
    'http://localhost:5173',
    '🎬 Go to Dashboard',
    'ACCOUNT CREATED',
    '#7c3aed'
  );

  console.log('\n--- Test: Project status update (client & staff) ---');
  await notificationService.triggerProjectStatusUpdatedAlert(4, 'Toxic', 'draft', 'in_review');

  console.log('\n--- Test: Project completed (with PDF) ---');
  await notificationService.triggerProjectCompletedAlert(4, 'Toxic');

  console.log('\n✅ All professional email tests dispatched. Check inboxes!');
  process.exit(0);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
