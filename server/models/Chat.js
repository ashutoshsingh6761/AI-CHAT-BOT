// server/models/Chat.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New Chat',
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    provider: {
      type: String,
      default: 'gemini',
    },
  },
  { timestamps: true }
);

// Fast lookup of a user's chats ordered by recency.
chatSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
