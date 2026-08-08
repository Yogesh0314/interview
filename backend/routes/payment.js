import express from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: { message: 'Too many payment requests, please try again later.' }
});

router.post('/create-order', protect, paymentLimiter, createOrder);
router.post('/verify', protect, verifyPayment);

export default router;
