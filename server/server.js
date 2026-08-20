// server/server.js
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const config = require('./config/config');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// ---- Security & core middleware ----
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for the bundled static client; tighten if you host it elsewhere
  })
);
app.use(
  cors({
    origin: config.clientOrigin === '*' ? true : config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize()); // strips $ and . operators from user input to prevent NoSQL injection

if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

app.use('/api', apiLimiter);

// ---- API routes ----
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy', env: config.env });
});
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// ---- Static client (serves the vanilla JS frontend) ----
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(clientDir, 'index.html'));
});

// ---- Error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

// ---- Startup ----
async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[server] AI Chatbot running on http://localhost:${config.port} (${config.env})`);
    console.log(`[server] Active LLM provider: ${config.llm.provider}`);
  });
}

start();

// Guard against unhandled promise rejections crashing the process silently.
process.on('unhandledRejection', (err) => {
  console.error('[fatal] Unhandled promise rejection:', err);
});

module.exports = app;
