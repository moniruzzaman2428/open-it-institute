const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
connectDB();

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173/',
    // origin: process.env.CLIENT_URL || 'https://openitinstitute-c8d2d.web.app/',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Open IT Institute API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ======================
// API ROUTES
// ======================
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/teachers', require('./routes/teacherRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/admissions', require('./routes/admissionRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/notices', require('./routes/noticeRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/testimonials', require('./routes/testimonialRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// ✅ IMPORTANT: Dashboard route যোগ করুন
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// 404 handler
app.all('*', (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot find ${req.originalUrl} on this server`
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION 💥', err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;