// Malpractice routes — PATCH /malpractice-logs/:logId/review (Section 9.8)
const express = require('express');
const router = express.Router();
const {
  reviewMalpractice,
  getCandidateMalpracticeLogs,
  getTestMalpracticeLogs,
} = require('../controllers/proctoringController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const adminAuth = [verifyToken, requireAdmin];

// Admin-only: review and act on malpractice logs
router.patch('/malpractice-logs/:logId/review', adminAuth, reviewMalpractice);

// Admin-only: fetch malpractice logs with proof screenshots
router.get('/tests/:testId/candidates/:candidateId/malpractice-logs', adminAuth, getCandidateMalpracticeLogs);
router.get('/tests/:testId/malpractice-logs', adminAuth, getTestMalpracticeLogs);

module.exports = router;
