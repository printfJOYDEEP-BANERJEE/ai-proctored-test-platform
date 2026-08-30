// Test routes — Section 9.2 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const {
  createTest, getTests, getTest, updateTest,
  updatePassingCriteria, updateMalpracticeThreshold,
  deleteTest, startTest, endTest,
} = require('../controllers/testController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, requireAdmin); // All test routes require admin auth

router.post('/tests', createTest);
router.get('/tests', getTests);
router.get('/tests/:testId', getTest);
router.patch('/tests/:testId', updateTest);
router.patch('/tests/:testId/passing-criteria', updatePassingCriteria);
router.patch('/tests/:testId/malpractice-threshold', updateMalpracticeThreshold);
router.delete('/tests/:testId', deleteTest);
router.post('/tests/:testId/start', startTest);
router.post('/tests/:testId/end', endTest);

module.exports = router;
