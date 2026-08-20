// server/config/config.js
// Centralized, validated access to environment variables.
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-chatbot',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_insecure_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  llm: {
    provider: (process.env.LLM_PROVIDER || 'gemini').toLowerCase(),
    defaultTemperature: parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7,
    defaultMaxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS, 10) || 1024,
    systemPrompt:
      process.env.SYSTEM_PROMPT ||
      'You are a helpful, friendly, and knowledgeable AI assistant.',
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    },
  },
};

// Warn (do not crash) about missing critical values in development.
if (config.env !== 'test') {
  if (config.jwt.secret === 'dev_only_insecure_secret') {
    console.warn('[config] WARNING: Using an insecure default JWT_SECRET. Set JWT_SECRET in your .env file.');
  }
}

module.exports = config;
