// AI Test routes — Section 9.6 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const { aiChat, saveFiles, submitAiTest, getPreview } = require('../controllers/aiTestController');
const { verifyToken, requireCandidate } = require('../middleware/authMiddleware');

router.use(verifyToken, requireCandidate);

router.post('/ai-test/:questionId/chat', aiChat);
router.post('/ai-test/:questionId/save-files', saveFiles);
router.post('/ai-test/:questionId/submit', submitAiTest);
router.get('/ai-test/:questionId/preview', getPreview);

module.exports = router;
