// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, registerRules, loginRules, sanitizeBody } = require('../middleware/validate');

router.post('/register', authLimiter, sanitizeBody(['name', 'email']), registerRules, validate, register);
router.post('/login', authLimiter, sanitizeBody(['email']), loginRules, validate, login);
router.get('/me', protect, getMe);

module.exports = router;
