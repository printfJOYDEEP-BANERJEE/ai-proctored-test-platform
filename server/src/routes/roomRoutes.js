// Room routes — Section 9.3 (exact endpoint paths)
const express = require('express');
const router = express.Router();
const { createRoom, getRooms, deleteRoom, getRoomCandidates } = require('../controllers/roomController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, requireAdmin);

router.post('/tests/:testId/rooms', createRoom);
router.get('/tests/:testId/rooms', getRooms);
router.delete('/rooms/:roomId', deleteRoom);
router.get('/rooms/:roomId/candidates', getRoomCandidates);

module.exports = router;
