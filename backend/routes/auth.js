import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe, 
  verifyEmail, 
  forgotPassword, 
  resetPassword, 
  refreshAccessToken, 
  logoutUser 
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.get('/refresh', refreshAccessToken);
router.post('/logout', logoutUser);

export default router;
