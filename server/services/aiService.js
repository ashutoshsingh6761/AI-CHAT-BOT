// server/services/aiService.js
//
// Provider-agnostic AI service facade.
// Controllers only ever talk to this file, never to a specific provider.
// To add a new provider (e.g. Ollama): create services/providers/xProvider.js
// exporting { generateResponse, generateStreamResponse }, register it in the
// `providers` map below, then set LLM_PROVIDER=x in .env. Nothing else changes.
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

const geminiProvider = require('./providers/geminiProvider');
const openrouterProvider = require('./providers/openrouterProvider');
const groqProvider = require('./providers/groqProvider');

const providers = {
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  groq: groqProvider,
};

function getActiveProvider(overrideName) {
  const name = (overrideName || config.llm.provider || 'gemini').toLowerCase();
  const provider = providers[name];
  if (!provider) {
    throw ApiError.badRequest(
      `Unsupported LLM provider "${name}". Supported providers: ${Object.keys(providers).join(', ')}.`
    );
  }
  return { name, provider };
}

/**
 * Builds the final message array sent to the LLM: system prompt + history.
 * @param {Array<{role:string, content:string}>} history
 * @param {string} [systemPrompt]
 */
function buildMessages(history, systemPrompt) {
  const messages = [];
  const prompt = systemPrompt || config.llm.systemPrompt;
  if (prompt) {
    messages.push({ role: 'system', content: prompt });
  }
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  return messages;
}

/**
 * Non-streaming chat completion.
 * @param {Array} history - prior conversation messages [{role, content}]
 * @param {object} options - { temperature, maxTokens, systemPrompt, providerOverride }
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function getChatResponse(history, options = {}) {
  const { name, provider } = getActiveProvider(options.providerOverride);
  const messages = buildMessages(history, options.systemPrompt);

  const text = await provider.generateResponse(messages, {
    temperature: options.temperature ?? config.llm.defaultTemperature,
    maxTokens: options.maxTokens ?? config.llm.defaultMaxTokens,
  });

  return { text, provider: name };
}

/**
 * Streaming chat completion. Invokes onChunk(text) as tokens arrive.
 * @returns {Promise<{ text: string, provider: string }>} full text once complete
 */
async function getChatStreamResponse(history, options = {}, onChunk) {
  const { name, provider } = getActiveProvider(options.providerOverride);
  const messages = buildMessages(history, options.systemPrompt);

  const text = await provider.generateStreamResponse(
    messages,
    {
      temperature: options.temperature ?? config.llm.defaultTemperature,
      maxTokens: options.maxTokens ?? config.llm.defaultMaxTokens,
    },
    onChunk
  );

  return { text, provider: name };
}

module.exports = { getChatResponse, getChatStreamResponse, getActiveProvider };
