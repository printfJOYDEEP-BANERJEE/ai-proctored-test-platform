// Section 8.2 — MalpracticeLog collection (exact field names/types as specified)
const mongoose = require('mongoose');

const malpracticeLogSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  violationType: {
    type: String,
    enum: ['PHONE_DETECTED', 'MULTIPLE_FACES', 'NO_FACE_15MIN', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'OTHER'],
    required: true,
  },
  // Cloudinary URL (webcam or screen capture depending on violationType)
  proofScreenshotUrl: { type: String },
  detectedAt: { type: Date, default: Date.now },
  adminReviewed: { type: Boolean, default: false },
  adminAction: { type: String, enum: ['NONE', 'WARNED', 'DISQUALIFIED'], default: 'NONE' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  reviewedAt: { type: Date },
});

// Section 8.3 — required compound index
malpracticeLogSchema.index({ testId: 1, roomId: 1, candidateId: 1 });

module.exports = mongoose.model('MalpracticeLog', malpracticeLogSchema);
