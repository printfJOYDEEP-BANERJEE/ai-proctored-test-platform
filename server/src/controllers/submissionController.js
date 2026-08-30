// Submission Controller — Module 3 (Standard Coding) + Module 4 (AI Test)
// Implements all endpoints from Section 9.5 exactly
const Test = require('../models/Test');
const Room = require('../models/Room');
const Question = require('../models/Question');
const QuestionSet = require('../models/QuestionSet');
const Submission = require('../models/Submission');
const judge0Service = require('../services/judge0Service');

// ── POST /rooms/join ──────────────────────────────────────────────────────────
// Body: { roomCode, roomPassword }
// Response: { test, room, instructions }
// AC: 403 if now > passwordValidUntil (FR-3.3)
const joinRoom = async (req, res, next) => {
  try {
    const { roomCode, roomPassword } = req.body;
    if (!roomCode || !roomPassword) {
      return res.status(400).json({ error: 'roomCode and roomPassword are required' });
    }

    const room = await Room.findOne({ roomCode });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // FR-3.3: Password validity check
    if (new Date() > room.passwordValidUntil) {
      return res.status(403).json({ error: 'Room code expired' });
    }

    if (room.status === 'CLOSED') {
      return res.status(403).json({ error: 'Room is closed' });
    }

    // Verify password
    if (room.roomPassword !== roomPassword) {
      return res.status(403).json({ error: 'Invalid room password' });
    }

    const test = await Test.findById(room.testId).populate('questionSetId');
    if (!test) return res.status(404).json({ error: 'Test not found' });

    if (test.status !== 'LIVE') {
      return res.status(403).json({ error: 'Test is not currently live' });
    }

    res.json({
      test: {
        _id: test._id,
        title: test.title,
        testType: test.testType,
        durationMinutes: test.durationMinutes,
        totalQuestions: test.totalQuestions,
        supportedLanguages: test.supportedLanguages,
      },
      room: {
        _id: room._id,
        roomName: room.roomName,
        roomCode: room.roomCode,
      },
      instructions: test.instructions,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /tests/:testId/start-attempt ─────────────────────────────────────────
// AC: candidateStartTime = now, candidateEndTime = now + durationMinutes (FR-5.1)
// Response: { submissionSessionId, candidateStartTime, candidateEndTime, questions[] }
const startAttempt = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const candidateId = req.user.id;

    const test = await Test.findById(testId).populate({
      path: 'questionSetId',
      populate: { path: 'questionIds' },
    });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.status !== 'LIVE') {
      return res.status(403).json({ error: 'Test is not currently live' });
    }

    const now = new Date();
    const candidateStartTime = now;
    const candidateEndTime = new Date(now.getTime() + test.durationMinutes * 60 * 1000);

    // Get questions from question set (visible test cases only — FR-4.2)
    const questionSet = test.questionSetId;
    const allQuestions = questionSet.questionIds || [];
    // Limit to totalQuestions
    const questions = allQuestions.slice(0, test.totalQuestions).map((q) => ({
      _id: q._id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      constraints: q.constraints,
      visibleTestCases: q.visibleTestCases, // visible only — hiddenTestCases excluded
      aiTestBriefFiles: q.aiTestBriefFiles,
      testType: q.testType,
    }));

    // Find the room for this candidate (from a prior join)
    // ASSUMPTION: We require the roomId to be passed in req.body or use the last joined room
    const { roomId } = req.body;

    // Create IN_PROGRESS submissions for each question
    const submissionPromises = questions.map((q) =>
      Submission.findOneAndUpdate(
        { candidateId, testId, questionId: q._id },
        {
          $setOnInsert: {
            candidateId,
            testId,
            roomId,
            questionId: q._id,
            candidateStartTime,
            candidateEndTime,
            status: 'IN_PROGRESS',
            visibleTestCasesTotal: q.visibleTestCases?.length || 0,
            hiddenTestCasesTotal: 0, // will be set during evaluation
          },
        },
        { upsert: true, new: true }
      )
    );
    const submissions = await Promise.all(submissionPromises);

    // Server-side auto-submit timer (FR-5.6: server-side timer, not solely client-triggered)
    const msUntilEnd = candidateEndTime.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        // Auto-submit all IN_PROGRESS submissions for this candidate/test
        await Submission.updateMany(
          { candidateId, testId, status: 'IN_PROGRESS' },
          { status: 'AUTO_SUBMITTED_TIME_UP', submittedAt: new Date() }
        );
        console.log(`[AutoSubmit] Candidate ${candidateId} test ${testId} auto-submitted at time-up`);

        // Trigger evaluation
        const evaluationService = require('../services/evaluationService');
        evaluationService.evaluateCandidateSubmissions(candidateId, testId).catch(console.error);
      } catch (err) {
        console.error('[AutoSubmit] Error:', err);
      }
    }, msUntilEnd);

    res.json({
      submissionSessionId: submissions[0]?._id, // session reference
      candidateStartTime,
      candidateEndTime,
      questions,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests/:testId/questions/:questionId ──────────────────────────────────
// visibleTestCases only (FR-4.2)
const getQuestion = async (req, res, next) => {
  try {
    // FR-4.2: Never return hiddenTestCases to candidates
    const projection = req.user.type === 'admin' ? {} : { hiddenTestCases: 0 };
    const question = await Question.findById(req.params.questionId, projection);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ question });
  } catch (err) {
    next(err);
  }
};

// ── POST /submissions/:questionId/run ─────────────────────────────────────────
// Proxy to Judge0, does NOT persist (Section 9.5)
const runCode = async (req, res, next) => {
  try {
    const { code, language, customInput } = req.body;
    const { questionId } = req.params;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    const question = await Question.findById(questionId, { hiddenTestCases: 0 });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    // Run against visible test cases
    const testCases = customInput
      ? [{ input: customInput, expectedOutput: '' }]
      : question.visibleTestCases;

    const results = await judge0Service.runAgainstTestCases(code, language, testCases);

    const output = results[0]?.stdout || results[0]?.stderr || '';
    const visibleTestResults = results.map((r, i) => ({
      input: testCases[i]?.input,
      expectedOutput: testCases[i]?.expectedOutput,
      actualOutput: r.stdout?.trim(),
      passed: r.stdout?.trim() === testCases[i]?.expectedOutput?.trim(),
      error: r.stderr || r.compile_output,
      status: r.status?.description,
    }));

    res.json({ output, visibleTestResults });
  } catch (err) {
    next(err);
  }
};

// ── POST /submissions/:questionId/save ────────────────────────────────────────
// Autosave — no evaluation (Section 9.5, NFR: autosave every 30s)
const saveCode = async (req, res, next) => {
  try {
    const { code, language } = req.body;
    const { questionId } = req.params;
    const candidateId = req.user.id;

    const savedAt = new Date();
    await Submission.findOneAndUpdate(
      { candidateId, questionId },
      { code, language, $setOnInsert: { status: 'IN_PROGRESS' } },
      { upsert: false } // only update existing, don't create
    );

    res.json({ success: true, savedAt });
  } catch (err) {
    next(err);
  }
};

// ── POST /submissions/:questionId/submit ──────────────────────────────────────
// Final submit — triggers evaluation worker
const submitCode = async (req, res, next) => {
  try {
    const { code, language } = req.body;
    const { questionId } = req.params;
    const candidateId = req.user.id;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    const question = await Question.findById(questionId, { hiddenTestCases: 0 });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    // Run visible test cases for immediate feedback
    const visibleResults = await judge0Service.runAgainstTestCases(
      code,
      language,
      question.visibleTestCases
    );
    const visiblePassed = visibleResults.filter(
      (r) => r.stdout?.trim() === question.visibleTestCases[visibleResults.indexOf(r)]?.expectedOutput?.trim()
    ).length;

    // Update submission
    const submission = await Submission.findOneAndUpdate(
      { candidateId, questionId },
      {
        code,
        language,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        visibleTestCasesPassed: visiblePassed,
        visibleTestCasesTotal: question.visibleTestCases.length,
      },
      { new: true, upsert: false }
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission session not found. Call start-attempt first.' });
    }

    // Enqueue evaluation worker (async — don't block response)
    const evaluationService = require('../services/evaluationService');
    evaluationService.evaluateSingleSubmission(submission._id.toString()).catch(console.error);

    // Broadcast progress update via Socket.io
    const io = req.app.get('io');
    io.to(`test:${submission.testId}:admin`).emit('dashboard:update', {
      candidateId,
      roomId: submission.roomId,
      questionsCompleted: visiblePassed / Math.max(question.visibleTestCases.length, 1),
    });

    res.json({ submission });
  } catch (err) {
    next(err);
  }
};

// ── POST /tests/:testId/submit-all ────────────────────────────────────────────
// Final full-test submit (or auto-triggered at time-up)
const submitAll = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const candidateId = req.user.id;

    // Mark all IN_PROGRESS submissions as submitted
    await Submission.updateMany(
      { candidateId, testId, status: 'IN_PROGRESS' },
      { status: 'SUBMITTED', submittedAt: new Date() }
    );

    // Emit candidate:submitted to admin room (Section 10.2)
    const io = req.app.get('io');
    // Get candidate name for announcement
    const Candidate = require('../models/Candidate');
    const candidate = await Candidate.findById(candidateId, 'name');
    io.to(`test:${testId}:admin`).emit('candidate:submitted', {
      candidateName: candidate?.name || 'Unknown',
    });

    // Trigger evaluation for all submissions
    const evaluationService = require('../services/evaluationService');
    evaluationService.evaluateCandidateSubmissions(candidateId, testId).catch(console.error);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  joinRoom,
  startAttempt,
  getQuestion,
  runCode,
  saveCode,
  submitCode,
  submitAll,
};
