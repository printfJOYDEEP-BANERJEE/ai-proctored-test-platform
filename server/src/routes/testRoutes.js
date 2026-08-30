// Test routes — Section 9.2 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const {
  createTest, getTests, getTest, updateTest,
  updatePassingCriteria, updateMalpracticeThreshold,
  deleteTest, startTest, endTest,
} = require('../controllers/testController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const adminAuth = [verifyToken, requireAdmin];

router.post('/tests', adminAuth, createTest);
router.get('/tests', adminAuth, getTests);
router.get('/tests/:testId', adminAuth, getTest);
router.patch('/tests/:testId', adminAuth, updateTest);
router.patch('/tests/:testId/passing-criteria', adminAuth, updatePassingCriteria);
router.patch('/tests/:testId/malpractice-threshold', adminAuth, updateMalpracticeThreshold);
router.delete('/tests/:testId', adminAuth, deleteTest);
router.post('/tests/:testId/start', adminAuth, startTest);
router.post('/tests/:testId/end', adminAuth, endTest);

module.exports = router;
