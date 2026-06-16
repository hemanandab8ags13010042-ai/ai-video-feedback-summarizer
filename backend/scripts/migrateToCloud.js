require('dotenv').config();
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const sqliteDbPath = path.join(__dirname, '..', 'database.sqlite');
const uploadsDir = path.join(__dirname, '..', 'uploads');

async function migrate() {
  console.log('🏁 Starting local-to-cloud database and assets migration...');

  // 1. Check SQLite DB
  if (!fs.existsSync(sqliteDbPath)) {
    console.error('❌ SQLite database file not found at:', sqliteDbPath);
    process.exit(1);
  }

  const sqliteDb = new sqlite3.Database(sqliteDbPath);
  const sqliteQuery = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const sqliteRun = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // 2. Check Cloudinary Config
  const isCloudinaryConfigured = 
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET;

  if (isCloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured. Uploading local assets to the cloud...');
    
    // Upload video files in video_versions
    const versions = await sqliteQuery('SELECT id, file_url FROM video_versions');
    for (const v of versions) {
      if (v.file_url && v.file_url.startsWith('/uploads/')) {
        const localFileName = v.file_url.replace('/uploads/', '');
        const localFilePath = path.join(uploadsDir, localFileName);
        if (fs.existsSync(localFilePath)) {
          console.log(`Uploading video version ID ${v.id}: ${localFileName} to Cloudinary...`);
          try {
            const result = await cloudinary.uploader.upload(localFilePath, {
              resource_type: 'video',
              folder: 'ai_video_feedback'
            });
            await sqliteRun('UPDATE video_versions SET file_url = ?, review_link = ? WHERE id = ?', [
              result.secure_url,
              `http://localhost:5173/review/${v.id}`,
              v.id
            ]);
            console.log(`   Success: ${result.secure_url}`);
          } catch (err) {
            console.error(`   Error uploading ${localFileName}:`, err.message);
          }
        }
      }
    }

    // Upload voice feedback audio files
    const voiceNotes = await sqliteQuery('SELECT id, audio_url FROM voice_feedback');
    for (const vn of voiceNotes) {
      if (vn.audio_url && vn.audio_url.startsWith('/uploads/')) {
        const localFileName = vn.audio_url.replace('/uploads/', '');
        const localFilePath = path.join(uploadsDir, localFileName);
        if (fs.existsSync(localFilePath)) {
          console.log(`Uploading voice note ID ${vn.id}: ${localFileName} to Cloudinary...`);
          try {
            const result = await cloudinary.uploader.upload(localFilePath, {
              resource_type: 'raw',
              folder: 'ai_video_feedback'
            });
            await sqliteRun('UPDATE voice_feedback SET audio_url = ? WHERE id = ?', [result.secure_url, vn.id]);
            console.log(`   Success: ${result.secure_url}`);
          } catch (err) {
            console.error(`   Error uploading ${localFileName}:`, err.message);
          }
        }
      }
    }

    // Upload annotations screenshots if any
    const annotations = await sqliteQuery('SELECT id, screenshot_url FROM feedback_annotations');
    for (const a of annotations) {
      if (a.screenshot_url && a.screenshot_url.startsWith('/uploads/')) {
        const localFileName = a.screenshot_url.replace('/uploads/', '');
        const localFilePath = path.join(uploadsDir, localFileName);
        if (fs.existsSync(localFilePath)) {
          console.log(`Uploading screenshot ID ${a.id}: ${localFileName} to Cloudinary...`);
          try {
            const result = await cloudinary.uploader.upload(localFilePath, {
              resource_type: 'image',
              folder: 'ai_video_feedback'
            });
            await sqliteRun('UPDATE feedback_annotations SET screenshot_url = ? WHERE id = ?', [result.secure_url, a.id]);
            console.log(`   Success: ${result.secure_url}`);
          } catch (err) {
            console.error(`   Error uploading ${localFileName}:`, err.message);
          }
        }
      }
    }
  } else {
    console.log('ℹ️ Cloudinary credentials not configured in env. Local uploads URLs will be migrated as-is.');
  }

  // 3. Check MySQL Config
  const useMySQL = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;
  if (!useMySQL) {
    console.log('ℹ️ MySQL credentials are not configured in your env. Skipping MySQL rows copy.');
    sqliteDb.close();
    process.exit(0);
  }

  console.log('🔗 Connecting to remote MySQL database...');
  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
  });

  const mysqlQuery = async (sql, params = []) => {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  };

  // 4. Initialize Tables on MySQL first
  const dbConfig = require('../config/db');
  console.log('⚙️ Initializing MySQL database tables...');
  await dbConfig.initDB();

  // List of tables to migrate
  const tables = [
    'users',
    'projects',
    'videos',
    'video_versions',
    'feedback_comments',
    'feedback_annotations',
    'voice_feedback',
    'tasks',
    'task_history',
    'notifications',
    'activity_logs',
    'ai_summaries',
    'reports_history'
  ];

  for (const table of tables) {
    console.log(`📦 Migrating table "${table}"...`);
    
    // Check if table exists in SQLite
    const tableCheck = await sqliteQuery(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
    if (tableCheck.length === 0) {
      console.log(`   SQLite table "${table}" does not exist. Skipping.`);
      continue;
    }

    const sqliteRows = await sqliteQuery(`SELECT * FROM ${table}`);
    if (sqliteRows.length === 0) {
      console.log(`   No rows found in SQLite table "${table}". Skipping.`);
      continue;
    }

    // Clear target table in MySQL to prevent key collisions
    try {
      await mysqlQuery(`DELETE FROM ${table}`);
    } catch (err) {
      console.warn(`   Warning clearing MySQL table "${table}":`, err.message);
    }

    // Insert rows
    for (const row of sqliteRows) {
      const keys = Object.keys(row);
      const values = Object.values(row).map(val => {
        // SQLite stores boolean/JSON as strings sometimes, or we convert object/date formats if needed
        return val;
      });
      const placeholders = keys.map(() => '?').join(', ');
      
      const insertSql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      try {
        await mysqlPool.query(insertSql, values);
      } catch (err) {
        console.error(`   Error inserting into MySQL table "${table}":`, err.message);
      }
    }
    console.log(`   Successfully migrated ${sqliteRows.length} rows to MySQL.`);
  }

  console.log('🎉 Migration completed successfully!');
  sqliteDb.close();
  await mysqlPool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
