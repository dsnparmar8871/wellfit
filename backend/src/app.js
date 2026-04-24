require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { buildCategoryStructureFromDB } = require('./utils/categories');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const measurementRoutes = require('./routes/measurements');
const couponRoutes =require('./routes/coupons');
const reviewRoutes = require('./routes/reviews');
const tailorRoutes = require('./routes/tailor');
const analyticsRoutes = require('./routes/analytics');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(',').map((o) => o.trim()).filter(Boolean),
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter(Boolean);

const isLocalDevOrigin = (origin = '') => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
const isForwardedDevOrigin = (origin = '') => {
  try {
    const { protocol, hostname } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) return false;

    return (
      hostname.endsWith('.devtunnels.ms') ||
      hostname.endsWith('.github.dev') ||
      hostname.endsWith('.app.github.dev') ||
      hostname.endsWith('.preview.app.github.dev') ||
      hostname.endsWith('.vscode.dev')
    );
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl/postman) and configured browser origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isForwardedDevOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.use(globalLimiter);

// ── Body Parsing ──────────────────────────────────────────────────────────────
// Webhook route needs raw body – mount BEFORE json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const sanitizeMiddleware = require('./middleware/sanitize');
app.use(sanitizeMiddleware);

// ── HTTP Logging ──────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/health',
  })
);

// ── Static Files (local uploads fallback) ────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  // Allow image embedding from local frontend origins (e.g. Vite on another port).
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register-admin', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/tailor', tailorRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── 404 & Error Handler ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// Establish MongoDB connection before serving API traffic.
connectDB();

// Initialize category structure from database
(async () => {
  try {
    const Category = require('./models/Category');
    const allCategories = await Category.find({ isActive: true }).populate('parentCategory', '_id name').lean();
    buildCategoryStructureFromDB(allCategories);
    logger.info(`Category structure initialized with ${allCategories.length} categories`);
  } catch (err) {
    logger.warn('Failed to initialize category structure:', err.message);
  }
})();

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  logger.info(`Wellfit Backend running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;

// Catch any unhandled errors
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
