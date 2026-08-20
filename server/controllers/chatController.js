// server/controllers/chatController.js
const Chat = require('../models/Chat');
const aiService = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const MAX_HISTORY_MESSAGES = 20; // cap how much prior context we send to the LLM

/**
 * Derives a short chat title from the first user message.
 */
function deriveTitle(message) {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed || 'New Chat';
}

/**
 * @route   POST /api/chat
 * @desc    Send a message; creates a new chat if chatId is not provided.
 *          Streams the response via Server-Sent Events when ?stream=true,
 *          otherwise returns a single JSON response.
 * @access  Private
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { message, chatId, temperature, maxTokens, systemPrompt } = req.body;
  const streamRequested = req.query.stream === 'true' || req.body.stream === true;

  let chat;
  if (chatId) {
    chat = await Chat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) throw ApiError.notFound('Chat not found');
  } else {
    chat = await Chat.create({
      user: req.user._id,
      title: deriveTitle(message),
      provider: aiService.getActiveProvider().name,
    });
  }

  // Append the user's message immediately.
  chat.messages.push({ role: 'user', content: message });

  // Build bounded history for the LLM (most recent N messages).
  const history = chat.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const aiOptions = { temperature, maxTokens, systemPrompt };

  if (streamRequested) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Tell the client which chat this stream belongs to right away
    // (important for brand-new chats, which have no id until now).
    res.write(`event: meta\ndata: ${JSON.stringify({ chatId: chat._id, title: chat.title })}\n\n`);

    try {
      const { text } = await aiService.getChatStreamResponse(history, aiOptions, (delta) => {
        res.write(`event: chunk\ndata: ${JSON.stringify({ delta })}\n\n`);
      });

      chat.messages.push({ role: 'assistant', content: text });
      await chat.save();

      res.write(`event: done\ndata: ${JSON.stringify({ chatId: chat._id })}\n\n`);
      res.end();
    } catch (err) {
      // Persist the user's message even if the AI call failed, then report the error over SSE.
      await chat.save().catch(() => {});
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: err.message || 'AI generation failed' })}\n\n`
      );
      res.end();
    }
    return;
  }

  // Non-streaming path
  const { text, provider } = await aiService.getChatResponse(history, aiOptions);
  chat.messages.push({ role: 'assistant', content: text });
  chat.provider = provider;
  await chat.save();

  res.status(200).json({
    success: true,
    data: {
      chatId: chat._id,
      title: chat.title,
      reply: text,
      provider,
    },
  });
});

/**
 * @route   GET /api/chat/history
 * @desc    List the current user's chats (most recent first), without full message bodies.
 * @access  Private
 */
const getHistory = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ user: req.user._id })
    .select('title provider createdAt updatedAt messages')
    .sort({ updatedAt: -1 })
    .lean();

  const summarized = chats.map((c) => ({
    _id: c._id,
    title: c.title,
    provider: c.provider,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
    lastMessage: c.messages.length ? c.messages[c.messages.length - 1].content.slice(0, 120) : '',
  }));

  res.status(200).json({ success: true, data: { chats: summarized } });
});

/**
 * @route   GET /api/chat/:id
 * @desc    Get a single chat with its full message history.
 * @access  Private
 */
const getChatById = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id });
  if (!chat) throw ApiError.notFound('Chat not found');
  res.status(200).json({ success: true, data: { chat } });
});

/**
 * @route   PATCH /api/chat/:id
 * @desc    Rename a chat.
 * @access  Private
 */
const renameChat = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const chat = await Chat.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { title },
    { new: true, runValidators: true }
  );
  if (!chat) throw ApiError.notFound('Chat not found');
  res.status(200).json({ success: true, message: 'Chat renamed', data: { chat } });
});

/**
 * @route   DELETE /api/chat/:id
 * @access  Private
 */
const deleteChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!chat) throw ApiError.notFound('Chat not found');
  res.status(200).json({ success: true, message: 'Chat deleted' });
});

module.exports = { sendMessage, getHistory, getChatById, renameChat, deleteChat };
