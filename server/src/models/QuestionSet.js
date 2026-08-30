// Section 8.2 — QuestionSet collection (exact field names/types as specified)
const mongoose = require('mongoose');

const questionSetSchema = new mongoose.Schema({
  testType: {
    type: String,
    enum: ['SPOJ', 'REACT', 'JAVASCRIPT', 'AI_TEST'],
    required: true,
  },
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // pool this set draws from
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QuestionSet', questionSetSchema);
