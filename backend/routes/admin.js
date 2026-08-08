import express from 'express';
import {
  getPlatformStats,
  getAllUsers,
  updateUserCredits,
  updateUserRole,
  getAllInterviews,
  deleteUser
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Protect all admin routes with JWT auth + admin role verification
router.get('/stats', protect, admin, getPlatformStats);
router.get('/users', protect, admin, getAllUsers);
router.put('/users/:userId/credits', protect, admin, updateUserCredits);
router.put('/users/:userId/role', protect, admin, updateUserRole);
router.delete('/users/:userId', protect, admin, deleteUser);
router.get('/interviews', protect, admin, getAllInterviews);

export default router;