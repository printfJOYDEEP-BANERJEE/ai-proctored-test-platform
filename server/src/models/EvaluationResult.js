// Section 8.2 — EvaluationResult collection (exact field names/types as specified)
const mongoose = require('mongoose');

const evaluationResultSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    unique: true, // Section 8.3 — unique index
  },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  scoreBreakdown: {
    // Standard coding scoring weights (FR-9.4)
    codeCorrectness: { type: Number },      // 30%
    testCasePassPercent: { type: Number },  // 10%
    timeComplexity: { type: Number },       // 15%
    spaceComplexity: { type: Number },      // 10%
    codeStructure: { type: Number },        // 10%
    problemSolvingApproach: { type: Number }, // 8%
    exceptionHandling: { type: Number },    // 8%
    inputValidation: { type: Number },      // 5%
    codeOptimization: { type: Number },     // 2%
    linesOfCode: { type: Number },          // 2%
    // AI Test only (FR-9.3)
    promptQuality: { type: Number },        // 60%
    outputCorrectnessDesign: { type: Number }, // 40%
  },
  finalScorePerQuestion: { type: Number }, // 0-10 scale (FR-9.4)
  // e.g., 2.5 — used for live progress + passing criteria check (FR-5.5)
  questionsCompletedCount: { type: Number },
  isPassed: { type: Boolean }, // computed against Test.passingCriteria
  evaluatedAt: { type: Date },
});

module.exports = mongoose.model('EvaluationResult', evaluationResultSchema);
