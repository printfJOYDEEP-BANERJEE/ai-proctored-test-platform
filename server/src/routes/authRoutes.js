// Auth routes — Section 9.1 (exact endpoint paths as specified)
const express = require('express');
const router = express.Router();
const {
  adminLogin,
  adminCreate,
  candidateRegister,
  candidateLogin,
  refreshToken,
  logout,
} = require('../controllers/authController');
const { verifyToken, requireSuperAdmin } = require('../middleware/authMiddleware');

// POST /api/v1/auth/admin/login
router.post('/admin/login', adminLogin);

// POST /api/v1/auth/admin/create
// Super Admin only — FR-1.1: non-Super-Admin returns 403
router.post('/admin/create', verifyToken, requireSuperAdmin, adminCreate);

// POST /api/v1/auth/candidate/register
router.post('/candidate/register', candidateRegister);

// POST /api/v1/auth/candidate/login
router.post('/candidate/login', candidateLogin);

// POST /api/v1/auth/refresh
router.post('/refresh', refreshToken);

// POST /api/v1/auth/logout
router.post('/logout', logout);

module.exports = router;
