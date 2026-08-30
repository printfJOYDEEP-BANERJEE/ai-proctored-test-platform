// Malpractice routes — PATCH /malpractice-logs/:logId/review (Section 9.8)
const express = require('express');
const router = express.Router();
const { reviewMalpractice } = require('../controllers/proctoringController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Admin-only: review and act on malpractice logs
router.patch('/malpractice-logs/:logId/review', verifyToken, requireAdmin, reviewMalpractice);

module.exports = router;
