// server/services/providers/openrouterProvider.js
const config = require('../../config/config');
const shared = require('./openaiCompatible');

function cfg() {
  return {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: config.llm.openrouter.apiKey,
    model: config.llm.openrouter.model,
    providerName: 'OpenRouter',
    extraHeaders: {
      // Optional but recommended by OpenRouter for free-tier usage attribution.
      'HTTP-Referer': config.clientOrigin,
      'X-Title': 'AI Chatbot',
    },
  };
}

async function generateResponse(messages, options = {}) {
  return shared.generateResponse(cfg(), messages, options);
}

async function generateStreamResponse(messages, options = {}, onChunk) {
  return shared.generateStreamResponse(cfg(), messages, options, onChunk);
}

module.exports = { generateResponse, generateStreamResponse };
