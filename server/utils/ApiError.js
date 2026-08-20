// server/utils/ApiError.js
/**
 * Standardized application error carrying an HTTP status code.
 * Thrown/forwarded errors of this type are handled explicitly
 * by the global error handler with the correct status + message.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
  static badGateway(message = 'Upstream service error') {
    return new ApiError(502, message);
  }
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ApiError(503, message);
  }
}

module.exports = ApiError;
