// server/services/providers/geminiProvider.js
// Google Gemini free-tier provider, implemented via the plain REST API
// (no SDK dependency needed) so it stays lightweight and swappable.
const fetch = require('node-fetch');
const config = require('../../config/config');
const ApiError = require('../../utils/ApiError');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Converts our internal, provider-agnostic message format
 * [{ role: 'user'|'assistant'|'system', content }]
 * into Gemini's `contents` format, and separates out the system prompt
 * (Gemini uses a dedicated `systemInstruction` field).
 */
function toGeminiPayload(messages, { temperature, maxTokens }) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const contents = conversation.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemMessages.length) {
    payload.systemInstruction = {
      parts: [{ text: systemMessages.map((m) => m.content).join('\n') }],
    };
  }

  return payload;
}

function assertApiKey() {
  if (!config.llm.gemini.apiKey) {
    throw ApiError.internal(
      'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.'
    );
  }
}

function handleUpstreamStatus(response, bodyText) {
  if (response.status === 401 || response.status === 403) {
    throw ApiError.internal('Invalid or unauthorized Gemini API key.');
  }
  if (response.status === 429) {
    throw ApiError.tooManyRequests('Gemini rate limit exceeded. Please try again shortly.');
  }
  if (!response.ok) {
    throw ApiError.badGateway(`Gemini API error (${response.status}): ${bodyText}`);
  }
}

/**
 * Non-streaming generation.
 * @returns {Promise<string>} the full assistant reply text
 */
async function generateResponse(messages, options = {}) {
  assertApiKey();
  const { temperature = config.llm.defaultTemperature, maxTokens = config.llm.defaultMaxTokens } = options;
  const model = config.llm.gemini.model;

  const url = `${BASE_URL}/${model}:generateContent?key=${config.llm.gemini.apiKey}`;
  const payload = toGeminiPayload(messages, { temperature, maxTokens });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw ApiError.serviceUnavailable('Network error while contacting Gemini API.');
  }

  const text = await response.text();
  handleUpstreamStatus(response, text);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw ApiError.badGateway('Received an unparsable response from Gemini.');
  }

  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!reply) {
    throw ApiError.badGateway('Gemini returned an empty response (it may have blocked the content).');
  }
  return reply;
}

/**
 * Streaming generation using Gemini's Server-Sent-Events endpoint.
 * Calls onChunk(textDelta) for every incremental piece of text received.
 * @returns {Promise<string>} the full assembled reply text
 */
async function generateStreamResponse(messages, options = {}, onChunk) {
  assertApiKey();
  const { temperature = config.llm.defaultTemperature, maxTokens = config.llm.defaultMaxTokens } = options;
  const model = config.llm.gemini.model;

  const url = `${BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${config.llm.gemini.apiKey}`;
  const payload = toGeminiPayload(messages, { temperature, maxTokens });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw ApiError.serviceUnavailable('Network error while contacting Gemini API.');
  }

  if (!response.ok) {
    const errText = await response.text();
    handleUpstreamStatus(response, errText);
  }

  let fullText = '';
  let buffer = '';

  await new Promise((resolve, reject) => {
    response.body.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          // Ignore partial/malformed SSE frames; they resolve on the next chunk.
        }
      }
    });
    response.body.on('end', resolve);
    response.body.on('error', reject);
  });

  return fullText;
}

module.exports = { generateResponse, generateStreamResponse };
