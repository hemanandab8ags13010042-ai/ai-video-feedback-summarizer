require('dotenv').config();
const db = require('../config/db');

async function updateEmails() {
  console.log('🔄 Starting database update for demo user emails...');
  
  await db.initDB();

  const updates = [
    { role: 'admin', oldEmail: 'admin@studio.com', newEmail: 'hemanandab8ags13010042@gmail.com' },
    { role: 'client', oldEmail: 'client@studio.com', newEmail: 'hemu29799@gmail.com' },
    { role: 'editor', oldEmail: 'editor@studio.com', newEmail: 'hemu36586@gmail.com' },
    { role: 'vfx_artist', oldEmail: 'vfx@studio.com', newEmail: 'jaswanthben87@gmail.com' },
    { role: 'pm', oldEmail: 'pm@studio.com', newEmail: 'boreddymaheswarareddy999@gmail.com' }
  ];

  for (const update of updates) {
    try {
      const result = await db.query(
        'UPDATE users SET email = ? WHERE role = ? AND email = ?',
        [update.newEmail, update.role, update.oldEmail]
      );
      console.log(`✅ Updated ${update.role} role email from ${update.oldEmail} to ${update.newEmail}`);
    } catch (err) {
      console.error(`❌ Failed to update ${update.role} role email:`, err.message);
    }
  }

  console.log('🎉 Database update completed successfully!');
  process.exit(0);
}

updateEmails().catch(err => {
  console.error('❌ Update failed:', err);
  process.exit(1);
});
