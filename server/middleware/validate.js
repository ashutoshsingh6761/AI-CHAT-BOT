// server/middleware/validate.js
const { validationResult, body } = require('express-validator');
const xss = require('xss');
const ApiError = require('../utils/ApiError');

/**
 * Runs after a chain of express-validator checks; throws a 400 ApiError
 * with all collected messages if validation failed.
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const messages = result.array().map((e) => e.msg);
    return next(ApiError.badRequest('Validation failed', messages));
  }
  next();
}

// ---- Reusable validation chains ----

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 60 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

const chatMessageRules = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message cannot be empty')
    .isLength({ max: 8000 })
    .withMessage('Message is too long (max 8000 characters)'),
  body('chatId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid chat id'),
  body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
  body('maxTokens').optional().isInt({ min: 1, max: 8192 }).withMessage('maxTokens must be between 1 and 8192'),
];

const renameChatRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }).withMessage('Title too long'),
];

/**
 * Sanitizes free-text fields against stored XSS before they are persisted
 * or echoed back (e.g. chat titles, user names). Message content itself is
 * rendered as Markdown client-side, which is escaped separately there.
 */
function sanitizeBody(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      if (typeof req.body[field] === 'string') {
        req.body[field] = xss(req.body[field]);
      }
    }
    next();
  };
}

module.exports = {
  validate,
  registerRules,
  loginRules,
  chatMessageRules,
  renameChatRules,
  sanitizeBody,
};
