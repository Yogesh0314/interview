import express from 'express';
import { downloadPDFReport } from '../controllers/pdfController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/download/:id', protect, downloadPDFReport);

export default router;
