const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let mysqlPool = null;
let sqliteDb = null;
let isMySQL = false;

// Initialize connection
async function initDB() {
  const useMySQL = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (useMySQL) {
    try {
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: {
          rejectUnauthorized: false
        },
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
      // Test the pool
      const conn = await mysqlPool.getConnection();
      conn.release();
      isMySQL = true;
      console.log('✅ Connected to MySQL Database successfully.');
    } catch (err) {
      console.warn('⚠️ MySQL connection failed. Falling back to SQLite. Error:', err.message);
      setupSQLite();
    }
  } else {
    console.log('ℹ️ MySQL credentials missing. Using SQLite database.');
    setupSQLite();
  }

  await createTables();
}

function setupSQLite() {
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Failed to open SQLite database:', err.message);
    } else {
      console.log('✅ SQLite database initialized at:', dbPath);
    }
  });
  isMySQL = false;
}

// Unified query function
async function query(sql, params = []) {
  if (isMySQL) {
    try {
      const [result] = await mysqlPool.execute(sql, params);
      if (result && typeof result.insertId !== 'undefined') {
        return { rows: [], insertId: result.insertId, affectedRows: result.affectedRows };
      }
      return result; // Typically returns array of rows
    } catch (err) {
      console.error('MySQL Query Error:', err.message, 'SQL:', sql);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      const trimmedSql = sql.trim().toLowerCase();
      const isSelect = trimmedSql.startsWith('select') || trimmedSql.startsWith('with') || trimmedSql.startsWith('show');
      
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) {
            console.error('SQLite Query Error:', err.message, 'SQL:', sql);
            return reject(err);
          }
          resolve(rows || []);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) {
            console.error('SQLite Exec Error:', err.message, 'SQL:', sql);
            return reject(err);
          }
          resolve({ rows: [], insertId: this.lastID, affectedRows: this.changes });
        });
      }
    });
  }
}

// Helper to check if MySQL is active
function getIsMySQL() {
  return isMySQL;
}

// Table generation helper
async function createTables() {
  const idType = isMySQL ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = isMySQL ? 'LONGTEXT' : 'TEXT';
  const datetimeDefault = isMySQL ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';

  // 1. Users Table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id ${idType},
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'client',
      is_verified TINYINT DEFAULT 0,
      verification_code VARCHAR(50) NULL,
      created_at ${datetimeDefault}
    )
  `);

  // Migration for existing databases: Add column is_verified and verification_code if missing
  try {
    if (isMySQL) {
      const columns = await query("SHOW COLUMNS FROM users LIKE 'is_verified'");
      if (columns.length === 0) {
        await query("ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0");
        await query("ALTER TABLE users ADD COLUMN verification_code VARCHAR(50) NULL");
        console.log("🛠️ MySQL database migrated: Added verification columns to users.");
      }
    } else {
      const pragma = await query("PRAGMA table_info(users)");
      const hasVerified = pragma.some(col => col.name === 'is_verified');
      if (!hasVerified) {
        await query("ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0");
        await query("ALTER TABLE users ADD COLUMN verification_code VARCHAR(50) NULL");
        console.log("🛠️ SQLite database migrated: Added verification columns to users.");
      }
    }
  } catch (err) {
    console.warn("⚠️ Migration warning:", err.message);
  }

  // 2. Projects Table
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id ${idType},
      name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      video_type VARCHAR(100),
      deadline DATE,
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'draft',
      created_at ${datetimeDefault},
      updated_at ${datetimeDefault}
    )
  `);

  // 3. Feedback Table
  await query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id ${idType},
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      content ${textType},
      file_url VARCHAR(500),
      created_at ${datetimeDefault}
    )
  `);

  // 4. Tasks Table
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id ${idType},
      project_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description ${textType},
      category VARCHAR(100) NOT NULL,
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'new',
      assigned_to INT,
      effort_hours DECIMAL(5, 2) DEFAULT 0,
      created_at ${datetimeDefault},
      updated_at ${datetimeDefault}
    )
  `);

  // 5. TaskHistory Table
  await query(`
    CREATE TABLE IF NOT EXISTS task_history (
      id ${idType},
      task_id INT NOT NULL,
      changed_by INT NOT NULL,
      old_status VARCHAR(50),
      new_status VARCHAR(50),
      comment ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 6. Notifications Table
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id ${idType},
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message ${textType} NOT NULL,
      type VARCHAR(50) DEFAULT 'in_app',
      read_status TINYINT DEFAULT 0,
      created_at ${datetimeDefault}
    )
  `);

  // 7. Reports Table
  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id ${idType},
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      file_url VARCHAR(500),
      created_by INT NOT NULL,
      created_at ${datetimeDefault}
    )
  `);

  // 8. AIResults Table
  await query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id ${idType},
      project_id INT NOT NULL,
      feedback_id INT NOT NULL,
      summary ${textType},
      action_items ${textType},
      editing_tasks ${textType},
      vfx_tasks ${textType},
      priority_detected VARCHAR(50),
      effort_estimate DECIMAL(5, 2) DEFAULT 0,
      suggestions ${textType},
      checklist ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 9. ActivityLogs Table
  await query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id ${idType},
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      activity_type VARCHAR(100),
      description ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 10. Videos Table
  await query(`
    CREATE TABLE IF NOT EXISTS videos (
      id ${idType},
      project_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 11. VideoVersions Table
  await query(`
    CREATE TABLE IF NOT EXISTS video_versions (
      id ${idType},
      video_id INT NOT NULL,
      version_number VARCHAR(50) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      review_link VARCHAR(500),
      status VARCHAR(50) DEFAULT 'pending_review',
      created_at ${datetimeDefault}
    )
  `);

  // 12. FeedbackComments Table
  await query(`
    CREATE TABLE IF NOT EXISTS feedback_comments (
      id ${idType},
      version_id INT NOT NULL,
      user_id INT NOT NULL,
      timestamp_seconds DECIMAL(8, 2) DEFAULT 0,
      comment ${textType} NOT NULL,
      category VARCHAR(100) DEFAULT 'General',
      priority VARCHAR(50) DEFAULT 'medium',
      created_at ${datetimeDefault}
    )
  `);

  // 13. FeedbackAnnotations Table
  await query(`
    CREATE TABLE IF NOT EXISTS feedback_annotations (
      id ${idType},
      comment_id INT NOT NULL,
      draw_data ${textType},
      screenshot_url VARCHAR(500),
      created_at ${datetimeDefault}
    )
  `);

  // 14. VoiceFeedback Table
  await query(`
    CREATE TABLE IF NOT EXISTS voice_feedback (
      id ${idType},
      comment_id INT NOT NULL,
      audio_url VARCHAR(500) NOT NULL,
      transcript ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 15. Approvals Table
  await query(`
    CREATE TABLE IF NOT EXISTS approvals (
      id ${idType},
      version_id INT NOT NULL,
      user_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      comments ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 16. AISummaries Table
  await query(`
    CREATE TABLE IF NOT EXISTS ai_summaries (
      id ${idType},
      version_id INT NOT NULL,
      summary ${textType},
      action_items ${textType},
      editing_tasks ${textType},
      vfx_tasks ${textType},
      audio_tasks ${textType},
      subtitle_tasks ${textType},
      priority_breakdown ${textType},
      effort_estimate DECIMAL(5, 2) DEFAULT 0,
      suggestions ${textType},
      created_at ${datetimeDefault}
    )
  `);

  // 17. VideoSubtitles Table
  await query(`
    CREATE TABLE IF NOT EXISTS video_subtitles (
      id ${idType},
      version_id INT NOT NULL,
      start_time DECIMAL(8, 2) NOT NULL,
      end_time DECIMAL(8, 2) NOT NULL,
      text ${textType} NOT NULL,
      created_at ${datetimeDefault}
    )
  `);

  console.log('✅ All database tables verified and loaded successfully.');

  // Create default admin/user accounts for development convenience if table is empty
  const users = await query('SELECT COUNT(*) as count FROM users');
  const count = users[0]?.count || 0;
  if (count === 0) {
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const clientPassword = await bcrypt.hash('client123', 10);
    const editorPassword = await bcrypt.hash('editor123', 10);
    const vfxPassword = await bcrypt.hash('vfx123', 10);
    const pmPassword = await bcrypt.hash('pm123', 10);

    await query('INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)', ['Admin User', 'hemanandab8ags13010042@gmail.com', adminPassword, 'admin']);
    await query('INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)', ['Client User', 'hemu29799@gmail.com', clientPassword, 'client']);
    await query('INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)', ['Editor User', 'hemu36586@gmail.com', editorPassword, 'editor']);
    await query('INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)', ['VFX Artist User', 'jaswanthben87@gmail.com', vfxPassword, 'vfx_artist']);
    await query('INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)', ['Production Manager User', 'boreddymaheswarareddy999@gmail.com', pmPassword, 'pm']);

    console.log('👤 Standard developer accounts seeded (e.g., admin: hemanandab8ags13010042@gmail.com / admin123).');
  }
}

module.exports = {
  initDB,
  query,
  getIsMySQL
};
