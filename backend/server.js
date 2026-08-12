import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';

// Import Routes
import authRoutes from './routes/auth.js';
import interviewRoutes from './routes/interview.js';
import paymentRoutes from './routes/payment.js';
import pdfRoutes from './routes/pdf.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const defaultOrigins = ['http://localhost', 'http://localhost:80', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1'];
const envOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Request logging with Morgan & Winston
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get(['/', '/health', '/api/health'], (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    const isHealthy = dbState === 1;
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'UP' : 'DOWN',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Database Connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/interview_ai';
console.log('Connecting to MongoDB at:', mongoUri);
mongoose.connect(mongoUri)
.then(() => console.log('✅ Connected to MongoDB successfully'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Start Server listening on 0.0.0.0
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false).then(() => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        }).catch((err) => {
            console.error('Error closing MongoDB connection:', err);
            process.exit(1);
        });
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

