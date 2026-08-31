require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const testRoutes = require('./routes/testRoutes');
const roomRoutes = require('./routes/roomRoutes');
const questionRoutes = require('./routes/questionRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const aiTestRoutes = require('./routes/aiTestRoutes');
const proctoringRoutes = require('./routes/proctoringRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const malpracticeRoutes = require('./routes/malpracticeRoutes');

const { registerSocketHandlers } = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// ── Socket.io setup (Section 10) ──────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io instance to app so controllers can access it
app.set('io', io);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' })); // larger limit for base64 screenshots
app.use(express.urlencoded({ extended: true }));

// ── Routes (Section 9) ────────────────────────────────────────────────────────
// Base URL: /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', testRoutes);
app.use('/api/v1', roomRoutes);
app.use('/api/v1', questionRoutes);
app.use('/api/v1', submissionRoutes);
app.use('/api/v1', aiTestRoutes);
app.use('/api/v1/proctoring', proctoringRoutes);
app.use('/api/v1', evaluationRoutes);
app.use('/api/v1', malpracticeRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── MongoDB connection ────────────────────────────────────────────────────────
const { seedSuperAdmin } = require('./seed');

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(async () => {
    console.log('[MongoDB] Connected successfully');
    // Ensure Super Admin exists in database
    await seedSuperAdmin();

    // Register Socket.io handlers after DB is ready
    registerSocketHandlers(io);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} | ENV: ${process.env.NODE_ENV}`);
    });
  })
  .catch((err) => {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, server };
