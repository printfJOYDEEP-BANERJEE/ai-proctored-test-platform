// AI Test Controller — Module 4
// Implements all endpoints from Section 9.6 exactly
// ASSUMPTION: Copy-paste allowed within AI Test interface (chat → editor), blocked from external
// sources. See FR-6.1 note and user confirmation.
const Submission = require('../models/Submission');
const Question = require('../models/Question');
const kimiService = require('../services/kimiService');

// ── POST /ai-test/:questionId/chat ────────────────────────────────────────────
// Body: { message }
// Response: { reply }
// Proxies to Kimi, appends to promptLog (FR-6.2)
// AC: Every chat message and AI reply appended to promptLog with timestamp
const aiChat = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { message } = req.body;
    const candidateId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Get question context for Kimi
    const question = await Question.findById(questionId, { hiddenTestCases: 0 });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    // FR-6.1: AI response is returned in chat panel ONLY — never auto-inserted into filesJson
    // Candidate must manually copy (within-interface only) into the editor
    const reply = await kimiService.chat(question.description, message);

    // Append to promptLog with timestamps (FR-6.2)
    const timestamp = new Date();
    await Submission.findOneAndUpdate(
      { candidateId, questionId },
      {
        $push: {
          promptLog: {
            $each: [
              { role: 'candidate', message, timestamp },
              { role: 'ai', message: reply, timestamp: new Date() },
            ],
          },
        },
      },
      { upsert: false }
    );

    res.json({ reply });
  } catch (err) {
    next(err);
  }
};

// ── POST /ai-test/:questionId/save-files ──────────────────────────────────────
// Body: { filesJson }
// Response: { success: true }
const saveFiles = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { filesJson } = req.body;
    const candidateId = req.user.id;

    await Submission.findOneAndUpdate(
      { candidateId, questionId },
      { filesJson },
      { upsert: false }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /ai-test/:questionId/submit ──────────────────────────────────────────
// Body: { filesJson, promptLog }
// Response: { submission }
const submitAiTest = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { filesJson, promptLog } = req.body;
    const candidateId = req.user.id;

    if (!filesJson) {
      return res.status(400).json({ error: 'filesJson is required' });
    }

    const submission = await Submission.findOneAndUpdate(
      { candidateId, questionId },
      {
        filesJson,
        // Replace promptLog if provided (full log from client as backup — server log is authoritative)
        // ASSUMPTION: Server-side promptLog (from /chat calls) is authoritative; client-provided
        // promptLog only fills gaps if server log is empty
        ...(promptLog && { promptLog }),
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      { new: true, upsert: false }
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission session not found. Call start-attempt first.' });
    }

    // Enqueue AI Test evaluation
    const evaluationService = require('../services/evaluationService');
    evaluationService.evaluateSingleSubmission(submission._id.toString()).catch(console.error);

    res.json({ submission });
  } catch (err) {
    next(err);
  }
};

// ── GET /ai-test/:questionId/preview ─────────────────────────────────────────
// Response: { previewBundle } — data handed to Sandpack on client (client-side rendering)
// AC: No new Submission record or server call created merely by clicking Preview (FR-6.3)
const getPreview = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const candidateId = req.user.id;

    // Only return the current filesJson — Sandpack renders client-side (FR-6.3)
    const submission = await Submission.findOne(
      { candidateId, questionId },
      { filesJson: 1 }
    );

    // FR-6.3: This endpoint does NOT create or modify any Submission record
    res.json({ previewBundle: submission?.filesJson || {} });
  } catch (err) {
    next(err);
  }
};

module.exports = { aiChat, saveFiles, submitAiTest, getPreview };
