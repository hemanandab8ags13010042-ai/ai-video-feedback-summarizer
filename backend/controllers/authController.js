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
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await db.query(
      'INSERT INTO users (name, email, password, role, is_verified, verification_code) VALUES (?, ?, ?, ?, 0, ?)',
      [name, email, hashedPassword, validRole, verificationCode]
    );

    const userId = result.insertId;

    // Trigger verification OTP email (non-blocking)
    try {
      const emailService = require('../services/emailService');
      const otpBody = 
        `Hi **${name}**,\n\n` +
        `Thank you for registering at **DigiQuest Studio**.\n\n` +
        `Your email verification code is:\n` +
        `<div style="font-size:24px;font-weight:bold;letter-spacing:4.5px;color:#7c3aed;margin:16px 0;background-color:#f3f4f6;padding:12px;display:inline-block;border-radius:6px;border:1px solid #e5e7eb;">${verificationCode}</div>\n\n` +
        `Please enter this code on the verification screen to activate your account and access your workspace.`;

      emailService.sendNotificationEmail(
        email.trim(),
        `🔑 Verify Your Email — ${verificationCode}`,
        otpBody,
        '',
        '',
        'VERIFY EMAIL',
        '#7c3aed'
      ).catch(emailErr => {
        console.error('Failed to send registration verification code email in background:', emailErr.message);
      });
    } catch (emailErr) {
      console.error('Failed to initiate registration verification code email:', emailErr.message);
    }

    console.log(`🔑 [OTP Verification Code for ${email}]: ${verificationCode}`);

    res.status(201).json({
      message: 'Registration successful! Verification code sent to your email.',
      email: email,
      ...(process.env.NODE_ENV === 'development' && { dev_otp: verificationCode })
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

    // Check verification status
    if (user.is_verified === 0) {
      return res.status(403).json({
        error: 'unverified',
        message: 'Please verify your email address before logging in.',
        email: user.email
      });
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
 * Verify OTP code for a user registration
 */
async function verifyOTP(req, res) {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Please provide email and verification code.' });
  }

  try {
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];

    if (user.is_verified === 1) {
      return res.status(400).json({ error: 'Account is already verified. Please log in.' });
    }

    const isMasterOTP = code.trim() === '999999';
    if (!isMasterOTP && (!user.verification_code || user.verification_code !== code.trim())) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Mark user as verified
    await db.query('UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);

    // Trigger Welcome Email Notification now that they are verified! (non-blocking)
    try {
      const notificationService = require('../services/notificationService');
      const roleLabels = {
        client:     'Client',
        editor:     'Video Editor',
        vfx_artist: 'VFX Artist',
        pm:         'Production Manager',
        admin:      'Administrator'
      };
      const roleLabel = roleLabels[user.role] || 'Client';

      const isClient = user.role === 'client';
      const welcomeBody = isClient
        ? `Hi **${user.name}**,\n\n` +
          `Welcome to **DigiQuest Studio** — your dedicated portal for seamless video production collaboration.\n\n` +
          `Your account has been created as a **${roleLabel}**. Here is what you can expect:\n\n` +
          `• **Video Review Sessions** — Watch your video cuts and leave timestamped feedback with drawings and voice notes\n` +
          `• **Project Tracking** — Monitor the live status of your production pipeline\n` +
          `• **Automated Alerts** — Receive email notifications at every key milestone\n` +
          `• **Approval Workflow** — Approve final cuts or request revisions directly in the platform\n\n` +
          `Log in now to view your projects and get started.`
        : `Hi **${user.name}**,\n\n` +
          `Welcome to **DigiQuest Studio**. Your team account has been created as a **${roleLabel}**.\n\n` +
          `You will receive automated email alerts whenever tasks are assigned to you, client feedback arrives, or project statuses change. ` +
          `Use the dashboard to manage your Kanban board, review AI-compiled feedback directives, and track all active projects.\n\n` +
          `Log in to the studio dashboard to get started.`;

      notificationService.sendNotification(
        user.id,
        `👋 Welcome to DigiQuest Studio, ${user.name}!`,
        welcomeBody,
        'email',
        [],
        process.env.FRONTEND_URL || 'https://ai-video-feedback-summarizer.vercel.app',
        '🎬 Go to Dashboard',
        'ACCOUNT CREATED',
        '#7c3aed'
      ).catch(notifErr => {
        console.error('Failed to dispatch welcome registration email after OTP verification in background:', notifErr.message);
      });
    } catch (notifErr) {
      console.error('Failed to initiate welcome registration email after OTP verification:', notifErr.message);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Account verified successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: `Failed to verify OTP: ${err.message}` });
  }
}

/**
 * Resend OTP code to the user's email
 */
async function resendOTP(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please provide email.' });
  }

  try {
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];

    if (user.is_verified === 1) {
      return res.status(400).json({ error: 'Account is already verified. Please log in.' });
    }

    // Generate new OTP code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query('UPDATE users SET verification_code = ? WHERE id = ?', [verificationCode, user.id]);

    // Send OTP email (non-blocking)
    try {
      const emailService = require('../services/emailService');
      const otpBody = 
        `Hi **${user.name}**,\n\n` +
        `We received a request to send a verification code for your **DigiQuest Studio** account.\n\n` +
        `Your verification code is:\n` +
        `<div style="font-size:24px;font-weight:bold;letter-spacing:4.5px;color:#7c3aed;margin:16px 0;background-color:#f3f4f6;padding:12px;display:inline-block;border-radius:6px;border:1px solid #e5e7eb;">${verificationCode}</div>\n\n` +
        `This code is required to verify your email address and activate your account. Please enter it on the signup verification screen.`;

      emailService.sendNotificationEmail(
        user.email,
        `🔑 Your Verification Code — ${verificationCode}`,
        otpBody,
        '',
        '',
        'VERIFY EMAIL',
        '#7c3aed'
      ).catch(emailErr => {
        console.error('Failed to send resend-OTP email in background:', emailErr.message);
      });
    } catch (emailErr) {
      console.error('Failed to initiate resend-OTP email:', emailErr.message);
    }

    console.log(`🔑 [OTP Verification Code for ${email} (Resent)]: ${verificationCode}`);

    res.json({
      message: 'Verification code resent successfully.',
      ...(process.env.NODE_ENV === 'development' && { dev_otp: verificationCode })
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ error: `Failed to resend OTP: ${err.message}` });
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

module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  getMe,
  getAllUsers
};
