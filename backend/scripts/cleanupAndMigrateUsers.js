require('dotenv').config();
const db = require('../config/db');

async function clean() {
  console.log('🔄 Cleaning up and migrating user records...');
  await db.initDB();

  // 1. Delete manual registrations with conflicting emails to avoid unique key constraints
  const conflicts = [
    { email: 'hemanandab8ags13010042@gmail.com', seedName: 'Admin User' },
    { email: 'boreddymaheswarareddy999@gmail.com', seedName: 'Production Manager User' },
    { email: 'hemu29799@gmail.com', seedName: 'Client User' },
    { email: 'hemu36586@gmail.com', seedName: 'Editor User' },
    { email: 'jaswanthben87@gmail.com', seedName: 'VFX Artist User' }
  ];

  for (const conflict of conflicts) {
    try {
      const res = await db.query(
        "DELETE FROM users WHERE email = ? AND name != ?",
        [conflict.email, conflict.seedName]
      );
      const affected = res?.affectedRows || 0;
      if (affected > 0) {
        console.log(`✅ Cleared ${affected} conflicting manual registration(s) for ${conflict.email}`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to clear conflicts for ${conflict.email}:`, err.message);
    }
  }

  // 2. Now update the seeded role users by matching their exact seeded name
  const updates = [
    { name: 'Admin User', newEmail: 'hemanandab8ags13010042@gmail.com' },
    { name: 'Production Manager User', newEmail: 'boreddymaheswarareddy999@gmail.com' },
    { name: 'Client User', newEmail: 'hemu29799@gmail.com' },
    { name: 'Editor User', newEmail: 'hemu36586@gmail.com' },
    { name: 'VFX Artist User', newEmail: 'jaswanthben87@gmail.com' }
  ];

  for (const update of updates) {
    try {
      await db.query(
        'UPDATE users SET email = ? WHERE name = ?',
        [update.newEmail, update.name]
      );
      console.log(`✅ Updated seeded '${update.name}' email to ${update.newEmail}`);
    } catch (err) {
      console.error(`❌ Failed to update seeded '${update.name}':`, err.message);
    }
  }

  console.log('🎉 Clean migration complete!');
  process.exit(0);
}

clean().catch(err => {
  console.error(err);
  process.exit(1);
});
