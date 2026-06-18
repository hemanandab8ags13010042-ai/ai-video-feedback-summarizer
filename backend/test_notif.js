require('dotenv').config();
const db = require('./config/db');

db.initDB().then(async () => {
  console.log('Using MySQL?', db.getIsMySQL());
  
  // Test queries for Hemu
  const r1 = await db.query(
    "SELECT id, name, email FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'",
    ['Hemu', 'Hemu']
  );
  console.log('Query for Hemu:', JSON.stringify(r1));

  // Test queries for Jaswanth
  const r2 = await db.query(
    "SELECT id, name, email FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'",
    ['Jaswanth', 'Jaswanth']
  );
  console.log('Query for Jaswanth:', JSON.stringify(r2));

  // Test project status update trigger
  const r3 = await db.query(
    "SELECT id FROM users WHERE role IN ('pm', 'admin', 'editor', 'vfx_artist') UNION SELECT id FROM users WHERE (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)) AND role = 'client'",
    ['Hemu', 'Hemu']
  );
  console.log('Recipients for Hemu project:', JSON.stringify(r3));

  // Test sendNotification for user id=11 (Hemu)
  const userRow = await db.query('SELECT name, email FROM users WHERE id = ?', [11]);
  console.log('User id=11 lookup:', JSON.stringify(userRow));

  process.exit(0);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
