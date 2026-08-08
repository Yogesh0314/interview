import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { setupInterview, chatInterview, finishInterview, getHistory, analyzeATS } from '../controllers/interviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Setup Multer with strict security limits (PDF only, max 10MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit to prevent DoS
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF resume files are allowed.'), false);
    }
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per 15 minutes
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

router.post('/ats-analyze', protect, apiLimiter, upload.single('resumePdf'), analyzeATS);
router.post('/setup', protect, apiLimiter, upload.single('resumePdf'), setupInterview);
router.post('/chat', protect, apiLimiter, chatInterview);
router.post('/finish', protect, apiLimiter, finishInterview);
router.get('/history', protect, getHistory);

export default router;
