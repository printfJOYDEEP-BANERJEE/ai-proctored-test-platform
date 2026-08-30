// Room Controller — Module 2
// Implements all endpoints from Section 9.3 exactly
const crypto = require('crypto');
const Room = require('../models/Room');
const Test = require('../models/Test');
const Candidate = require('../models/Candidate');
const Submission = require('../models/Submission');

/**
 * Generate a cryptographically random room code (Section 13: not guessable, not sequential)
 * Example format: 6 uppercase alphanumeric chars, e.g., "A3K9MQ"
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ambiguous chars removed
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

/**
 * Generate a cryptographically random room password (Section 13)
 * Example format: 8 chars alphanumeric
 */
const generateRoomPassword = () => crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars

// ── POST /tests/:testId/rooms ─────────────────────────────────────────────────
// Auto-generates roomCode, roomPassword, passwordValidUntil (FR-3.1)
const createRoom = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const { roomName, capacity } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    const test = await Test.findById(testId);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Generate unique room code (retry on collision)
    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
      if (attempts > 10) return res.status(500).json({ error: 'Failed to generate unique room code' });
    } while (await Room.findOne({ roomCode }));

    const roomPassword = generateRoomPassword();
    const now = new Date();
    // passwordValidUntil = createdAt + startTestWindowMinutes (Section 8.2)
    const passwordValidUntil = new Date(
      now.getTime() + (test.startTestWindowMinutes || 10) * 60 * 1000
    );

    const room = await Room.create({
      testId,
      roomName,
      roomCode,
      roomPassword,
      passwordValidUntil,
      capacity: capacity || undefined,
      status: 'ACTIVE',
      createdAt: now,
    });

    // Broadcast to admins if test is LIVE (Section 10.2: room:updated event)
    const io = req.app.get('io');
    io.to(`test:${testId}:admin`).emit('room:updated', {
      roomId: room._id,
      action: 'ADDED',
    });

    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
};

// ── GET /tests/:testId/rooms ──────────────────────────────────────────────────
const getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({ testId: req.params.testId });
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /rooms/:roomId ─────────────────────────────────────────────────────
// AC: Candidates already in that room are NOT kicked out mid-test (FR-3.2)
// Only new joins to that room code are blocked (status = CLOSED)
const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // FR-3.2: Do not kick active candidates — just set status to CLOSED to block new joins
    // Candidates with active sessions persist (their timer/submissions are unaffected)
    await Room.findByIdAndUpdate(req.params.roomId, { status: 'CLOSED' });

    // Broadcast room removal to admins
    const io = req.app.get('io');
    io.to(`test:${room.testId}:admin`).emit('room:updated', {
      roomId: room._id,
      action: 'REMOVED',
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── GET /rooms/:roomId/candidates ─────────────────────────────────────────────
const getRoomCandidates = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Find all submissions for this room to get candidate list
    const submissions = await Submission.find({ roomId: req.params.roomId })
      .populate('candidateId', 'name email phone isDisqualified')
      .distinct('candidateId');

    // Get unique candidates who have joined this room
    const candidateSubmissions = await Submission.find({ roomId: req.params.roomId })
      .populate('candidateId', 'name email phone isDisqualified')
      .select('candidateId status visibleTestCasesPassed visibleTestCasesTotal');

    // Deduplicate by candidateId
    const seen = new Set();
    const candidates = [];
    for (const sub of candidateSubmissions) {
      const id = sub.candidateId?._id?.toString();
      if (id && !seen.has(id)) {
        seen.add(id);
        candidates.push(sub.candidateId);
      }
    }

    res.json({ candidates });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRoom, getRooms, deleteRoom, getRoomCandidates };
