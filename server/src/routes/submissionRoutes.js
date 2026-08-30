// Submission routes — Section 9.5 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const {
  joinRoom, startAttempt, getQuestion,
  runCode, saveCode, submitCode, submitAll,
} = require('../controllers/submissionController');
const { verifyToken, requireCandidate } = require('../middleware/authMiddleware');

// All submission routes require candidate auth
router.use(verifyToken, requireCandidate);

router.post('/rooms/join', joinRoom);
router.post('/tests/:testId/start-attempt', startAttempt);
router.get('/tests/:testId/questions/:questionId', getQuestion);
router.post('/submissions/:questionId/run', runCode);
router.post('/submissions/:questionId/save', saveCode);
router.post('/submissions/:questionId/submit', submitCode);
router.post('/tests/:testId/submit-all', submitAll);

module.exports = router;
