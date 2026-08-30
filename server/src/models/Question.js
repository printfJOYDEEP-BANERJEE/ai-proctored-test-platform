// Section 8.2 — Question collection (exact field names/types as specified)
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet', required: true },
  testType: {
    type: String,
    enum: ['SPOJ', 'REACT', 'JAVASCRIPT', 'AI_TEST'],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true }, // full problem statement / AI-test project brief
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'] },
  inputFormat: { type: String },
  outputFormat: { type: String },
  constraints: { type: String }, // valid input range, used to catch hardcoding
  visibleTestCases: [
    {
      input: { type: String },
      expectedOutput: { type: String },
    },
  ], // shown to candidate
  hiddenTestCases: [
    {
      input: { type: String },
      expectedOutput: { type: String },
    },
  ], // used only for correctness scoring — NEVER returned to candidates (FR-4.2)
  // AI_TEST specific fields (null/unused for other types):
  aiTestBriefFiles: [{ fileName: { type: String } }], // e.g., [{ fileName: "index.html" }, { fileName: "style.css" }]
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Question', questionSchema);
