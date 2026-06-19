const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwtConfig');

/**
 * Handle user registration
 */
async function register(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const validRole = role || 'client'; // default role is client

    const result = await db.query(
      'INSERT INTO users (name, email, password, role, is_verified, verification_code) VALUES (?, ?, ?, ?, 1, NULL)',
      [name, email, hashedPassword, validRole]
    );

    const userId = result.insertId;

    // Trigger Welcome Email Notification (non-blocking)
    try {
      const notificationService = require('../services/notificationService');
      const roleLabels = {
        client:     'Client',
        editor:     'Video Editor',
        vfx_artist: 'VFX Artist',
        pm:         'Production Manager',
        admin:      'Administrator'
      };
      const roleLabel = roleLabels[validRole] || 'Client';

      const isClient = validRole === 'client';
      const welcomeBody = isClient
        ? `Hi **${name}**,\n\n` +
          `Welcome to **DigiQuest Studio** — your dedicated portal for seamless video production collaboration.\n\n` +
          `Your account has been created as a **${roleLabel}**. Here is what you can expect:\n\n` +
          `• **Video Review Sessions** — Watch your video cuts and leave timestamped feedback with drawings and voice notes\n` +
          `• **Project Tracking** — Monitor the live status of your production pipeline\n` +
          `• **Automated Alerts** — Receive email notifications at every key milestone\n` +
          `• **Approval Workflow** — Approve final cuts or request revisions directly in the platform\n\n` +
          `Log in now to view your projects and get started.`
        : `Hi **${name}**,\n\n` +
          `Welcome to **DigiQuest Studio**. Your team account has been created as a **${roleLabel}**.\n\n` +
          `You will receive automated email alerts whenever tasks are assigned to you, client feedback arrives, or project statuses change. ` +
          `Use the dashboard to manage your Kanban board, review AI-compiled feedback directives, and track all active projects.\n\n` +
          `Log in to the studio dashboard to get started.`;

      notificationService.sendNotification(
        userId,
        `👋 Welcome to DigiQuest Studio, ${name}!`,
        welcomeBody,
        'email',
        [],
        process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app',
        '🎬 Go to Dashboard',
        'ACCOUNT CREATED',
        '#7c3aed'
      ).catch(notifErr => {
        console.error('Failed to dispatch welcome registration email in background:', notifErr.message);
      });
    } catch (notifErr) {
      console.error('Failed to initiate welcome registration email:', notifErr.message);
    }

    // Generate JWT
    const token = jwt.sign({ id: userId, role: validRole }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: userId, name, email, role: validRole }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: `Failed to register user: ${err.message}` });
  }
}

/**
 * Handle user login
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    // Fetch user
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: `Internal server login error: ${err.message}` });
  }
}

/**
 * Get details of currently logged-in user
 */
async function getMe(req, res) {
  res.json({ user: req.user });
}

/**
 * Fetch all users (convenient for PM assignments/role settings)
 */
async function getAllUsers(req, res) {
  try {
    const users = await db.query('SELECT id, name, email, role FROM users');
    res.json(users);
  } catch (err) {
    console.error('Fetch Users Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
}

/**
 * Update details of a user
 */
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, role } = req.body;

  // Authorization check: Only admin or pm can edit
  if (req.user.role !== 'admin' && req.user.role !== 'pm') {
    return res.status(403).json({ error: 'Permission denied. Only Admins and Production Managers can update users.' });
  }

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required.' });
  }

  try {
    // Check if the user exists
    const users = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if new email is already taken by someone else
    const emailCheck = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email is already registered to another account.' });
    }

    await db.query(
      'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
      [name, email, role, id]
    );

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ error: `Failed to update user: ${err.message}` });
  }
}

/**
 * Delete a user
 */
async function deleteUser(req, res) {
  const { id } = req.params;

  // Authorization check: Only admin or pm can delete
  if (req.user.role !== 'admin' && req.user.role !== 'pm') {
    return res.status(403).json({ error: 'Permission denied. Only Admins and Production Managers can delete users.' });
  }

  // Prevent users from deleting themselves
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    // Check if user exists
    const users = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Clean up notifications first
    await db.query('DELETE FROM notifications WHERE user_id = ?', [id]);

    // Delete the user
    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: `Failed to delete user: ${err.message}` });
  }
}

/**
 * Diagnostics endpoint to verify SMTP credentials and connect.
 */
async function testSMTPConnection(req, res) {
  const nodemailer = require('nodemailer');
  
  const host = req.query.host || process.env.SMTP_HOST;
  const port = req.query.port || process.env.SMTP_PORT;
  const secure = req.query.secure || process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const targetRecipient = req.query.to || user;
  const targetSender = req.query.from || process.env.SMTP_FROM || '"DigiQuest Studio Alerts" <alerts@digiquest.studio>';

  const diagnostics = {
    smtp_configured: !!(host && user && pass),
    host: host || 'MISSING',
    port: port || 'MISSING',
    secure: secure || 'MISSING',
    user: user || 'MISSING',
    target_recipient: targetRecipient,
    target_sender: targetSender,
    pass_length: pass ? pass.length : 0,
    pass_masked: pass ? (pass.length > 4 ? pass.substring(0, 2) + '****' + pass.substring(pass.length - 2) : 'PRESENT_BUT_SHORT') : 'MISSING',
    connection_verified: false,
    email_dispatched: false,
    error: null
  };

  if (!diagnostics.smtp_configured) {
    return res.status(400).json({ 
      error: 'SMTP credentials missing from environment variables.', 
      diagnostics 
    });
  }

  const config = {
    host,
    port: parseInt(port) || 587,
    secure: secure === 'true',
    auth: {
      user,
      pass
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000
  };

  try {
    const testTransporter = nodemailer.createTransport(config);
    
    // 1. Verify connection
    await testTransporter.verify();
    diagnostics.connection_verified = true;

    // 2. Try sending test email
    const mailOptions = {
      from: targetSender,
      to: targetRecipient,
      subject: '🎬 DigiQuest Studio SMTP Diagnostics Test',
      text: `SMTP Connection diagnostics check. Sender: ${targetSender}, Recipient: ${targetRecipient}`
    };

    const info = await testTransporter.sendMail(mailOptions);
    diagnostics.email_dispatched = true;
    diagnostics.messageId = info.messageId;

    res.json({ 
      message: 'SMTP Diagnostics Completed Successfully! Connection verified and test email sent.', 
      diagnostics 
    });
  } catch (err) {
    console.error('SMTP Diagnostics Failure:', err);
    diagnostics.error = err.message;
    diagnostics.error_stack = err.stack;
    res.status(500).json({ 
      error: `SMTP Diagnostics Failed: ${err.message}`, 
      diagnostics 
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
  getAllUsers,
  updateUser,
  deleteUser,
  testSMTPConnection
};

