// server/services/providers/openaiCompatible.js
// Shared logic for any provider that exposes an OpenAI-compatible
// `/chat/completions` endpoint (OpenRouter, Groq, and, in future, Ollama).
const fetch = require('node-fetch');
const ApiError = require('../../utils/ApiError');

function handleUpstreamStatus(response, bodyText, providerName) {
  if (response.status === 401 || response.status === 403) {
    throw ApiError.internal(`Invalid or unauthorized ${providerName} API key.`);
  }
  if (response.status === 429) {
    throw ApiError.tooManyRequests(`${providerName} rate limit exceeded. Please try again shortly.`);
  }
  if (!response.ok) {
    throw ApiError.badGateway(`${providerName} API error (${response.status}): ${bodyText}`);
  }
}

/**
 * @param {object} cfg - { baseUrl, apiKey, model, providerName, extraHeaders }
 * @param {Array} messages - [{ role, content }]
 * @param {object} options - { temperature, maxTokens }
 */
async function generateResponse(cfg, messages, options = {}) {
  const { baseUrl, apiKey, model, providerName, extraHeaders = {} } = cfg;
  if (!apiKey) {
    throw ApiError.internal(`${providerName} API key is not configured.`);
  }

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false,
      }),
    });
  } catch (err) {
    throw ApiError.serviceUnavailable(`Network error while contacting ${providerName} API.`);
  }

  const text = await response.text();
  handleUpstreamStatus(response, text, providerName);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw ApiError.badGateway(`Received an unparsable response from ${providerName}.`);
  }

  const reply = data?.choices?.[0]?.message?.content || '';
  if (!reply) {
    throw ApiError.badGateway(`${providerName} returned an empty response.`);
  }
  return reply;
}

/**
 * Streaming generation via OpenAI-compatible SSE chat completions.
 * @returns {Promise<string>} full assembled text
 */
async function generateStreamResponse(cfg, messages, options = {}, onChunk) {
  const { baseUrl, apiKey, model, providerName, extraHeaders = {} } = cfg;
  if (!apiKey) {
    throw ApiError.internal(`${providerName} API key is not configured.`);
  }

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });
  } catch (err) {
    throw ApiError.serviceUnavailable(`Network error while contacting ${providerName} API.`);
  }

  if (!response.ok) {
    const errText = await response.text();
    handleUpstreamStatus(response, errText, providerName);
  }

  let fullText = '';
  let buffer = '';

  await new Promise((resolve, reject) => {
    response.body.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          // Ignore partial/malformed SSE frames.
        }
      }
    });
    response.body.on('end', resolve);
    response.body.on('error', reject);
  });

  return fullText;
}

module.exports = { generateResponse, generateStreamResponse };
