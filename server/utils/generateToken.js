// server/utils/generateToken.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Signs a JWT for the given user id.
 * @param {string} userId
 * @returns {string} signed JWT
 */
function generateToken(userId) {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

module.exports = generateToken;
