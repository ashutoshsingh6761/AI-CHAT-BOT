// server/config/db.js
const mongoose = require('mongoose');
const config = require('./config');

/**
 * Connects to MongoDB using Mongoose.
 * Exits the process on failure so the failure is loud and obvious
 * (process managers like pm2/docker will restart it).
 */
async function connectDB() {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(config.mongoUri, {
      // Modern mongoose (6+/8+) no longer needs useNewUrlParser/useUnifiedTopology,
      // they are kept here as no-ops for clarity/compatibility with older drivers.
    });

    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[db] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[db] MongoDB disconnected. Attempting to reconnect is handled by the driver.');
    });
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
