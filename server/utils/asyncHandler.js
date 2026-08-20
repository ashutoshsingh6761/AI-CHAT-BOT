// server/utils/asyncHandler.js
/**
 * Wraps an async Express route handler so that any rejected promise
 * is forwarded to next(err) instead of crashing the process.
 * This lets us write plain async/await controllers with no try/catch noise.
 *
 * @param {Function} fn - async (req, res, next) => {}
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
