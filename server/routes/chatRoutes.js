// server/routes/chatRoutes.js
const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getHistory,
  getChatById,
  renameChat,
  deleteChat,
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  chatMessageRules,
  renameChatRules,
  sanitizeBody,
} = require('../middleware/validate');

// All chat routes require authentication.
router.use(protect);

router.post('/', chatLimiter, chatMessageRules, validate, sendMessage);
router.get('/history', getHistory);
router.get('/:id', getChatById);
router.patch('/:id', sanitizeBody(['title']), renameChatRules, validate, renameChat);
router.delete('/:id', deleteChat);

module.exports = router;
