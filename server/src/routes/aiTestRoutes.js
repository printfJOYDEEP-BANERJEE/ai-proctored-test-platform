// AI Test routes — Section 9.6 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const { aiChat, saveFiles, submitAiTest, getPreview } = require('../controllers/aiTestController');
const { verifyToken, requireCandidate } = require('../middleware/authMiddleware');

const candidateAuth = [verifyToken, requireCandidate];

router.post('/ai-test/:questionId/chat', candidateAuth, aiChat);
router.post('/ai-test/:questionId/save-files', candidateAuth, saveFiles);
router.post('/ai-test/:questionId/submit', candidateAuth, submitAiTest);
router.get('/ai-test/:questionId/preview', candidateAuth, getPreview);

module.exports = router;
