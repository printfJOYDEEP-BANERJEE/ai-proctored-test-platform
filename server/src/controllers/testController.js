// Test Controller — Module 2
// Implements all endpoints from Section 9.2 exactly
const Test = require('../models/Test');
const shortlistService = require('../services/shortlistService');

// ── POST /tests ───────────────────────────────────────────────────────────────
// AC: Test is created in DRAFT status until explicitly started (FR-2.1)
const createTest = async (req, res, next) => {
  try {
    const {
      title,
      testType,
      questionSetId,
      durationMinutes,
      totalQuestions,
      passingCriteria,
      instructions,
      startTestWindowMinutes,
      supportedLanguages,
    } = req.body;

    if (!title || !testType || !questionSetId || !durationMinutes || !passingCriteria || !instructions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const test = await Test.create({
      title,
      testType,
      questionSetId,
      durationMinutes,
      totalQuestions: totalQuestions || 5,
      passingCriteria,
      instructions,
      startTestWindowMinutes: startTestWindowMinutes || 10,
      supportedLanguages: supportedLanguages || [],
      createdBy: req.user.id,
      status: 'DRAFT', // FR-2.1: always DRAFT on creation
    });

    res.status(201).json({ test });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests ────────────────────────────────────────────────────────────────
const getTests = async (req, res, next) => {
  try {
    const tests = await Test.find()
      .populate('createdBy', 'name email')
      .populate('questionSetId', 'name testType')
      .sort({ createdAt: -1 });
    res.json({ tests });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests/:testId ────────────────────────────────────────────────────────
const getTest = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.testId)
      .populate('createdBy', 'name email')
      .populate('questionSetId', 'name testType questionIds');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ test });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /tests/:testId ──────────────────────────────────────────────────────
const updateTest = async (req, res, next) => {
  try {
    // Disallow direct status manipulation via this generic PATCH
    const disallowed = ['status', 'createdBy', '_id'];
    disallowed.forEach((k) => delete req.body[k]);

    const test = await Test.findByIdAndUpdate(req.params.testId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ test });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /tests/:testId/passing-criteria ─────────────────────────────────────
// AC: On change, shortlist is recalculated immediately and automatically (FR-2.2)
const updatePassingCriteria = async (req, res, next) => {
  try {
    const { passingCriteria } = req.body;
    if (passingCriteria === undefined || passingCriteria === null) {
      return res.status(400).json({ error: 'passingCriteria is required' });
    }

    const test = await Test.findByIdAndUpdate(
      req.params.testId,
      { passingCriteria },
      { new: true, runValidators: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // FR-2.2: Auto-trigger shortlist regeneration if test has ended
    if (test.status === 'ENDED') {
      await shortlistService.regenerate(test._id.toString());
    }

    res.json({ test });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /tests/:testId/malpractice-threshold ────────────────────────────────
// AC: Only settable after test is ENDED; immediately re-evaluates shortlist (FR-2.3)
const updateMalpracticeThreshold = async (req, res, next) => {
  try {
    const { malpracticeDisqualifyThreshold } = req.body;
    if (malpracticeDisqualifyThreshold === undefined) {
      return res.status(400).json({ error: 'malpracticeDisqualifyThreshold is required' });
    }

    const existingTest = await Test.findById(req.params.testId);
    if (!existingTest) return res.status(404).json({ error: 'Test not found' });

    // AC: Only allowed after test has ENDED (FR-2.3)
    if (existingTest.status !== 'ENDED') {
      return res.status(400).json({ error: 'malpracticeDisqualifyThreshold can only be set after test has ENDED' });
    }

    const test = await Test.findByIdAndUpdate(
      req.params.testId,
      { malpracticeDisqualifyThreshold },
      { new: true, runValidators: true }
    );

    // FR-7.5: Re-evaluate all candidates' malpractice counts, update shortlist
    const updatedShortlist = await shortlistService.regenerate(test._id.toString());

    res.json({ test, updatedShortlist });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /tests/:testId ─────────────────────────────────────────────────────
const deleteTest = async (req, res, next) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.testId);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /tests/:testId/start ─────────────────────────────────────────────────
// Sets status to LIVE (Section 9.2, §12.1 flow)
const startTest = async (req, res, next) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.testId,
      { status: 'LIVE' },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Broadcast to all admins watching this test
    const io = req.app.get('io');
    io.to(`test:${test._id}:admin`).emit('test:started', { testId: test._id, status: 'LIVE' });

    res.json({ test });
  } catch (err) {
    next(err);
  }
};

// ── POST /tests/:testId/end ───────────────────────────────────────────────────
// Sets status to ENDED; triggers final evaluation pass; broadcasts test:ended to candidates
const endTest = async (req, res, next) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.testId,
      { status: 'ENDED' },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Section 10.2: broadcast test:ended to all candidates in the test (forces auto-submit)
    const io = req.app.get('io');
    io.to(`test:${test._id}:admin`).emit('test:ended', { testId: test._id });
    // Broadcast to all candidate rooms for this test
    // Candidates are in rooms test:{testId}:room:{roomId} — we emit to test:{testId}:* pattern
    // Socket.io doesn't support wildcards natively; we use a dedicated test-level room for broadcasts
    io.to(`test:${test._id}`).emit('test:ended', { testId: test._id });

    // Trigger final evaluation pass (evaluation worker)
    const evaluationService = require('../services/evaluationService');
    evaluationService.runFinalEvaluationPass(test._id.toString()).catch((err) => {
      console.error('[Evaluation] Final pass error:', err);
    });

    res.json({ test });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTest,
  getTests,
  getTest,
  updateTest,
  updatePassingCriteria,
  updateMalpracticeThreshold,
  deleteTest,
  startTest,
  endTest,
};
