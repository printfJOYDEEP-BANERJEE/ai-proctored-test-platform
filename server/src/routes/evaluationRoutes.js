// Evaluation and Reports routes — Section 9.7 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const {
  getResults, getShortlist, regenerateShortlist,
  exportShortlistPdf, getCopyPasteLog,
} = require('../controllers/evaluationController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, requireAdmin);

router.get('/tests/:testId/results', getResults);
router.get('/tests/:testId/shortlist', getShortlist);
router.post('/tests/:testId/shortlist/regenerate', regenerateShortlist);
router.get('/tests/:testId/shortlist/export-pdf', exportShortlistPdf);
router.get('/submissions/:submissionId/copy-paste-log', getCopyPasteLog);

module.exports = router;
