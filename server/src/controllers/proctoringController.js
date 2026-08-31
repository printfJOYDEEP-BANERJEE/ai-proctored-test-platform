// Proctoring Controller — Module 5
// Implements all endpoints from Section 9.8 exactly
// Implements malpractice review endpoint
const MalpracticeLog = require('../models/MalpracticeLog');
const Candidate = require('../models/Candidate');
const cloudinaryService = require('../services/cloudinaryService');
const malpracticeService = require('../services/malpracticeService');
const multer = require('multer');

// Multer config for frame upload (multipart/form-data)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── POST /proctoring/:testId/frame ────────────────────────────────────────────
// multipart/form-data: image
// Response: { phoneDetected: Boolean }
// AC: If phoneDetected, server auto-creates MalpracticeLog (FR-7.2)
const submitFrame = [
  upload.single('image'),
  async (req, res, next) => {
    try {
      const { testId } = req.params;
      const candidateId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ error: 'image file is required' });
      }

      // Call YOLO service for phone detection
      const { phoneDetected } = await malpracticeService.detectPhone(req.file.buffer);

      if (phoneDetected) {
        // FR-7.2: Server auto-creates MalpracticeLog — client does NOT need to call /violation separately
        // Upload frame to Cloudinary as proof
        const candidate = await Candidate.findById(candidateId, 'name');
        const screenshotUrl = await cloudinaryService.uploadScreenshot(
          req.file.buffer,
          testId,
          candidateId
        );

        // Get roomId from active submission
        const Submission = require('../models/Submission');
        const activeSub = await Submission.findOne({ candidateId, testId, status: 'IN_PROGRESS' });
        const roomId = activeSub?.roomId;

        const log = await MalpracticeLog.create({
          candidateId,
          testId,
          roomId,
          violationType: 'PHONE_DETECTED',
          proofScreenshotUrl: screenshotUrl,
        });

        // Emit malpractice:alert to admins + candidate:warning to candidate (FR-7.3)
        const io = req.app.get('io');
        const malpracticeCount = await MalpracticeLog.countDocuments({ candidateId, testId });

        io.to(`test:${testId}:admin`).emit('malpractice:alert', {
          malpracticeLogId: log._id,
          candidateId,
          candidateName: candidate?.name || 'Unknown',
          roomId,
          violationType: 'PHONE_DETECTED',
          proofScreenshotUrl: screenshotUrl,
          currentCount: malpracticeCount,
        });

        // Emit to candidate's socket (they are in room test:{testId}:candidate:{candidateId})
        io.to(`candidate:${candidateId}`).emit('candidate:warning', {
          violationType: 'PHONE_DETECTED',
          message: 'Phone detected in your camera view. This has been flagged.',
        });
      }

      res.json({ phoneDetected });
    } catch (err) {
      next(err);
    }
  },
];

// ── POST /proctoring/violation ────────────────────────────────────────────────
// Body: { candidateId, testId, roomId, violationType, screenshotBase64 }
// Response: { malpracticeLog }
// Used for client-detected violations: MULTIPLE_FACES, NO_FACE_15MIN, TAB_SWITCH, FULLSCREEN_EXIT
const reportViolation = async (req, res, next) => {
  try {
    const { candidateId, testId, roomId, violationType, screenshotBase64 } = req.body;

    // Validate — candidate can only report their own violations
    if (req.user.type === 'candidate' && req.user.id !== candidateId) {
      return res.status(403).json({ error: 'Cannot report violation for another candidate' });
    }

    if (!violationType || !candidateId || !testId || !roomId) {
      return res.status(400).json({ error: 'candidateId, testId, roomId, violationType are required' });
    }

    // Upload screenshot to Cloudinary
    let proofScreenshotUrl = null;
    if (screenshotBase64) {
      const buffer = Buffer.from(
        screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
      proofScreenshotUrl = await cloudinaryService.uploadScreenshot(buffer, testId, candidateId);
    }

    const log = await MalpracticeLog.create({
      candidateId,
      testId,
      roomId,
      violationType,
      proofScreenshotUrl,
    });

    const candidate = await Candidate.findById(candidateId, 'name');
    const malpracticeCount = await MalpracticeLog.countDocuments({ candidateId, testId });

    // FR-7.3: (a) candidate:warning, (b) malpractice:alert to admin — within 2 seconds
    const io = req.app.get('io');
    io.to(`test:${testId}:admin`).emit('malpractice:alert', {
      malpracticeLogId: log._id,
      candidateId,
      candidateName: candidate?.name || 'Unknown',
      roomId,
      violationType,
      proofScreenshotUrl,
      currentCount: malpracticeCount,
    });

    io.to(`candidate:${candidateId}`).emit('candidate:warning', {
      violationType,
      message: `Violation detected: ${violationType.replace(/_/g, ' ')}. This has been flagged.`,
    });

    // Seat map update
    io.to(`test:${testId}:admin`).emit('seatmap:status', {
      candidateId,
      roomId,
      colorStatus: 'YELLOW', // warning state; disqualified = RED handled below
    });

    res.json({ malpracticeLog: log });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /malpractice-logs/:logId/review ────────────────────────────────────
// Body: { adminAction: "WARNED" | "DISQUALIFIED" }
// Response: { malpracticeLog }
// FR-7.4: Only admin manual action disqualifies a candidate mid-test
const reviewMalpractice = async (req, res, next) => {
  try {
    const { logId } = req.params;
    const { adminAction } = req.body;

    if (!['WARNED', 'DISQUALIFIED'].includes(adminAction)) {
      return res.status(400).json({ error: 'adminAction must be WARNED or DISQUALIFIED' });
    }

    const log = await MalpracticeLog.findByIdAndUpdate(
      logId,
      {
        adminAction,
        adminReviewed: true,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!log) return res.status(404).json({ error: 'MalpracticeLog not found' });

    const io = req.app.get('io');

    if (adminAction === 'DISQUALIFIED') {
      // FR-7.4: Admin manual disqualification
      await Candidate.findByIdAndUpdate(log.candidateId, { isDisqualified: true });

      // Auto-submit disqualified candidate's submissions
      const Submission = require('../models/Submission');
      await Submission.updateMany(
        { candidateId: log.candidateId, testId: log.testId, status: 'IN_PROGRESS' },
        { status: 'AUTO_SUBMITTED_DISQUALIFIED', submittedAt: new Date() }
      );

      // candidate:disqualified event forces client to lock/close test window (Section 10.2)
      io.to(`candidate:${log.candidateId}`).emit('candidate:disqualified', {
        reason: 'MANUAL',
      });

      // Update seat map to RED
      io.to(`test:${log.testId}:admin`).emit('seatmap:status', {
        candidateId: log.candidateId,
        roomId: log.roomId,
        colorStatus: 'RED',
      });
    }

    res.json({ malpracticeLog: log });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests/:testId/candidates/:candidateId/malpractice-logs ───────────────
const getCandidateMalpracticeLogs = async (req, res, next) => {
  try {
    const { testId, candidateId } = req.params;
    const logs = await MalpracticeLog.find({ testId, candidateId })
      .populate('reviewedBy', 'name email')
      .sort({ detectedAt: -1 });
    res.json({ malpracticeLogs: logs });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests/:testId/malpractice-logs ───────────────────────────────────────
const getTestMalpracticeLogs = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const { candidateId } = req.query;
    const filter = { testId };
    if (candidateId) filter.candidateId = candidateId;

    const logs = await MalpracticeLog.find(filter)
      .populate('candidateId', 'name email isDisqualified')
      .populate('roomId', 'roomName roomCode')
      .populate('reviewedBy', 'name email')
      .sort({ detectedAt: -1 });
    res.json({ malpracticeLogs: logs });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitFrame,
  reportViolation,
  reviewMalpractice,
  getCandidateMalpracticeLogs,
  getTestMalpracticeLogs,
};
