// Proctoring routes — Section 9.8 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const { submitFrame, reportViolation } = require('../controllers/proctoringController');
const { verifyToken, requireCandidate } = require('../middleware/authMiddleware');

router.use(verifyToken, requireCandidate);

// POST /proctoring/:testId/frame — multipart/form-data upload
router.post('/:testId/frame', submitFrame);

// POST /proctoring/violation — client-detected violations
router.post('/violation', reportViolation);

module.exports = router;
