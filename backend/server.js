require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const db = require('./config/db');

const app = express();
app.set('trust proxy', 1); // Trust first proxy for correct client IP detection (Render, Vercel, Nginx)
const PORT = process.env.PORT || 5000;
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Setup Socket.io events
io.on('connection', (socket) => {
  console.log(`🔌 Socket client connected: ${socket.id}`);

  // Sync Kanban movement actions
  socket.on('task-moved', (data) => {
    socket.broadcast.emit('task-moved-update', data);
  });

  // Synced Collaborative Review Rooms
  socket.on('join-review-session', (data) => {
    const { versionId, userName } = data;
    socket.join(`review-session-${versionId}`);
    console.log(`👤 User "${userName}" joined review room: review-session-${versionId}`);
  });

  socket.on('cursor-move', (data) => {
    const { versionId } = data;
    socket.to(`review-session-${versionId}`).emit('cursor-move-update', {
      socketId: socket.id,
      ...data
    });
  });

  socket.on('draw-stroke', (data) => {
    const { versionId } = data;
    socket.to(`review-session-${versionId}`).emit('draw-stroke-update', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(cors({
  origin: true, // Dynamically reflect origin to support credentials
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ────────────────────── SECURITY MIDDLEWARE ──────────────────────
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeAllStrings } = require('./middleware/inputValidator');

// Set security HTTP headers (XSS protection, content-type sniffing, etc.)
app.use(helmet());

// Global API rate limiter: 100 requests per minute per IP
app.use('/api', apiLimiter);

// Global XSS sanitization for all string fields in request bodies
app.use(sanitizeAllStrings);

// Serve local uploads folder statically
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const feedbackRoutes = require('./routes/feedback');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const videoRoutes = require('./routes/videos');
const reviewRoutes = require('./routes/reviews');

// Apply routing endpoints
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/reviews', reviewRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database: db.getIsMySQL() ? 'MySQL' : 'SQLite fallback'
  });
});

// Start Server & DB
async function startServer() {
  try {
    await db.initDB();
    server.listen(PORT, () => {
      console.log(`🚀 AI Video Feedback Summarizer Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database or start backend:', err.message);
    process.exit(1);
  }
}

startServer();
