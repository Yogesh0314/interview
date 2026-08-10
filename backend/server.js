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

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
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

// Basic health route
app.get('/', (req, res) => {
    res.send('Interview AI Backend API Running');
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
