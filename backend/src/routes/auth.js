const express = require('express');
const router = express.Router();
const { loginLimiter } = require('../middleware/rateLimiters');
const { authMiddleware } = require('../middleware/auth');
const { validateLogin, validateNewPassword } = require('../middleware/validators');
const authController = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', loginLimiter, validateLogin, authController.login);

// POST /api/auth/refresh
router.post('/refresh', authController.refreshTokenEndpoint);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// PATCH /api/auth/me/password
router.patch('/me/password', authMiddleware, validateNewPassword, authController.changePassword);

// PATCH /api/auth/me/email
router.patch('/me/email', authMiddleware, authController.changeEmail);

// PATCH /api/auth/me/profile
router.patch('/me/profile', authMiddleware, authController.updateProfile);

module.exports = router;
