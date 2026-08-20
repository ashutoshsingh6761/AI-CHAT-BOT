// server/services/providers/groqProvider.js
const config = require('../../config/config');
const shared = require('./openaiCompatible');

function cfg() {
  return {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: config.llm.groq.apiKey,
    model: config.llm.groq.model,
    providerName: 'Groq',
    extraHeaders: {},
  };
}

async function generateResponse(messages, options = {}) {
  return shared.generateResponse(cfg(), messages, options);
}

async function generateStreamResponse(messages, options = {}, onChunk) {
  return shared.generateStreamResponse(cfg(), messages, options, onChunk);
}

module.exports = { generateResponse, generateStreamResponse };
