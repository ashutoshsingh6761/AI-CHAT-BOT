// server/middleware/errorHandler.js
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

/**
 * Catch-all for unmatched routes. Must be mounted after all real routes.
 */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized error handler. Normalizes known error types
 * (Mongoose validation/cast errors, JWT errors, duplicate keys, ApiError)
 * into a consistent { success: false, message, errors } JSON shape.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.details || null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed';
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field "${err.path}"`;
  }

  // Mongo duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already in use`;
  }

  // Mongo connection-level failures
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    statusCode = 503;
    message = 'Database is currently unavailable. Please try again shortly.';
  }

  if (config.env !== 'production' && !(err instanceof ApiError)) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(config.env === 'development' && !(err instanceof ApiError) ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
