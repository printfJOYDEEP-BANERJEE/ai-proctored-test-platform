// Room routes — Section 9.3 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const { createRoom, getRooms, deleteRoom, getRoomCandidates } = require('../controllers/roomController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const adminAuth = [verifyToken, requireAdmin];

router.post('/tests/:testId/rooms', adminAuth, createRoom);
router.get('/tests/:testId/rooms', adminAuth, getRooms);
router.delete('/rooms/:roomId', adminAuth, deleteRoom);
router.get('/rooms/:roomId/candidates', adminAuth, getRoomCandidates);

module.exports = router;
