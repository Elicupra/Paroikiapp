const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const pool = require('./models/db');
const { ensureAdvancedSchema } = require('./models/advancedSchema');
const { startDocumentRetentionJob } = require('./models/documentRetention');

// Import routes
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const registerRoutes = require('./routes/register');
const monitorRoutes = require('./routes/monitor');
const adminRoutes = require('./routes/admin');
const documentRoutes = require('./routes/documents');

// Import middleware
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiters');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Simulate-User'],
}));

// Rate limiting general
app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/register', registerRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documentos', documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler
app.use(errorHandler);

// Database connection test
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✓ Database connected at', res.rows[0].now);
  }
});

ensureAdvancedSchema().then(() => {
  console.log('✓ Advanced schema ready');
  startDocumentRetentionJob();
}).catch((err) => {
  console.error('Advanced schema error:', err.message);
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
