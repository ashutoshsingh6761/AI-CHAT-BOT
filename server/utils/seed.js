// server/utils/seed.js
// Optional helper: creates a demo user so you can log in immediately
// without going through the registration form. Run with: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/User');

const DEMO_USER = {
  name: 'Demo User',
  email: 'demo@nimbus.ai',
  password: 'demo1234',
};

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('[seed] Connected to MongoDB');

  const existing = await User.findOne({ email: DEMO_USER.email });
  if (existing) {
    console.log(`[seed] Demo user already exists: ${DEMO_USER.email}`);
  } else {
    await User.create(DEMO_USER);
    console.log(`[seed] Created demo user -> email: ${DEMO_USER.email} / password: ${DEMO_USER.password}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
