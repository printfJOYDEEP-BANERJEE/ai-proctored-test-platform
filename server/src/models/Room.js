// Section 8.2 — Room collection (exact field names/types as specified)
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  roomName: { type: String, required: true }, // e.g., "Room 201"
  roomCode: { type: String, required: true, unique: true }, // auto-generated join ID
  roomPassword: { type: String, required: true }, // auto-generated
  passwordValidUntil: { type: Date, required: true }, // createdAt + startTestWindowMinutes
  capacity: { type: Number },
  status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
  joinedCandidates: [
    {
      candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Section 8.3 — required index (roomCode unique index defined inline on field)

module.exports = mongoose.model('Room', roomSchema);
