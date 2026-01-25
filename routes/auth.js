const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  verifyToken,
  getProfile,
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Public
 */
router.get('/verify', verifyToken);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Protected (requires token)
 */
router.get('/profile', getProfile);

module.exports = router;
