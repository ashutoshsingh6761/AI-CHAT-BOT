# Nimbus — AI Chatbot

A production-ready, ChatGPT-style AI chatbot built entirely with **JavaScript** (no TypeScript):

- **Frontend:** HTML5, CSS3, Vanilla JavaScript — responsive, dark/light theme, streaming responses, Markdown + syntax-highlighted code, copy-to-clipboard.
- **Backend:** Node.js + Express.js, MVC architecture, JWT authentication, MongoDB/Mongoose persistence.
- **AI:** Pluggable provider layer — **Google Gemini** (free tier, default), **OpenRouter** (free models), or **Groq** (free & fast) — switchable via a single environment variable, with streaming (SSE) support.

---

## Table of contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Environment variables](#environment-variables)
6. [Running locally](#running-locally)
7. [API endpoints](#api-endpoints)
8. [Switching AI providers](#switching-ai-providers)
9. [Security](#security)
10. [Deployment guide](#deployment-guide)
11. [Troubleshooting](#troubleshooting)

---

## Features

**Chat**
- Real-time streaming responses (Server-Sent Events) with a non-streaming fallback
- Enter to send, Shift+Enter for a new line
- Auto-resizing input, auto-scroll, typing indicator
- Markdown rendering with syntax-highlighted, copyable code blocks
- Per-message copy button and timestamps

**Chat history**
- Multiple conversations per user, stored in MongoDB
- Create, rename, delete, and resume conversations
- Sidebar chat list sorted by recency

**Authentication**
- Register / login with JWT
- Passwords hashed with bcrypt
- Protected routes via middleware

**AI**
- Conversation context sent to the model (bounded to the last 20 messages)
- Configurable system prompt, temperature, and max tokens
- Modular provider layer — add a new provider without touching controllers/routes

**Security**
- Helmet (secure HTTP headers)
- CORS
- Rate limiting (global, auth, and chat-specific limits)
- express-validator input validation
- express-mongo-sanitize (NoSQL injection protection)
- DOMPurify + XSS sanitization on both server and client
- All secrets via environment variables

---

## Project structure

```
chatbot/
│
├── client/                      # Vanilla JS frontend (served statically by Express)
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js               # fetch wrapper + SSE streaming client
│   │   ├── markdown.js          # marked.js + DOMPurify + highlight.js
│   │   ├── auth.js              # login/register UI logic
│   │   ├── chat.js              # chat UI: history, messages, sending
│   │   └── app.js               # bootstrap: theme, sidebar, view switching
│   └── assets/
│
├── server/
│   ├── server.js                 # Express app entry point
│   ├── config/
│   │   ├── config.js              # env var loader/validator
│   │   └── db.js                  # MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   └── Chat.js
│   ├── middleware/
│   │   ├── auth.js                # JWT "protect" middleware
│   │   ├── errorHandler.js        # centralized error handling
│   │   ├── rateLimiter.js
│   │   └── validate.js            # express-validator rules + sanitization
│   ├── controllers/
│   │   ├── authController.js
│   │   └── chatController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── chatRoutes.js
│   ├── services/
│   │   ├── aiService.js           # provider-agnostic facade
│   │   └── providers/
│   │       ├── geminiProvider.js
│   │       ├── openrouterProvider.js
│   │       ├── groqProvider.js
│   │       └── openaiCompatible.js  # shared OpenAI-compatible client
│   └── utils/
│       ├── asyncHandler.js
│       ├── ApiError.js
│       ├── generateToken.js
│       └── seed.js                # optional demo-user seeder
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js** 18+
- **MongoDB** running locally, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A **free API key** from one of the supported LLM providers:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) — Gemini (recommended, generous free tier)
  - [OpenRouter](https://openrouter.ai/keys) — free models (e.g. `meta-llama/llama-3.1-8b-instruct:free`)
  - [Groq](https://console.groq.com/keys) — free & very fast inference

---

## Installation

```bash
# 1. Clone / unzip the project, then enter the folder
cd chatbot

# 2. Install dependencies
npm install

# 3. Copy the example environment file and fill in your values
cp .env.example .env
```

---

## Environment variables

Set these in your `.env` file (see `.env.example` for the full template):

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the server listens on | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CLIENT_ORIGIN` | Allowed CORS origin (frontend URL) | `http://localhost:5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/ai-chatbot` |
| `JWT_SECRET` | Long random string used to sign JWTs | `openssl rand -hex 32` output |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `LLM_PROVIDER` | `gemini` \| `openrouter` \| `groq` | `gemini` |
| `GEMINI_API_KEY` | API key from Google AI Studio | — |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `OPENROUTER_API_KEY` | API key from OpenRouter | — |
| `OPENROUTER_MODEL` | A free OpenRouter model id | `meta-llama/llama-3.1-8b-instruct:free` |
| `GROQ_API_KEY` | API key from Groq | — |
| `GROQ_MODEL` | Groq model name | `llama-3.1-8b-instant` |
| `DEFAULT_TEMPERATURE` | Default sampling temperature | `0.7` |
| `DEFAULT_MAX_TOKENS` | Default max response tokens | `1024` |
| `SYSTEM_PROMPT` | Default system prompt sent to the model | see `.env.example` |

You only need to fill in the API key for the provider you set in `LLM_PROVIDER`.

---

## Running locally

```bash
# Development (auto-restarts on file changes, requires devDependency "nodemon")
npm run dev

# Production
npm start
```

The app will be available at **http://localhost:5000** (or whatever `PORT` you set) — the Express server serves both the API (`/api/...`) and the static frontend from the same origin, so there's no separate frontend server or CORS setup needed for local use.

Optional: seed a demo account (`demo@nimbus.ai` / `demo1234`) so you can log in immediately:

```bash
npm run seed
```

---

## API endpoints

All `/api/chat/*` routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | Create an account, returns `{ user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | Log in, returns `{ user, token }` |
| GET | `/api/auth/me` | — | Get the current authenticated user |

### Chat

| Method | Endpoint | Body / Query | Description |
|---|---|---|---|
| POST | `/api/chat` | `{ message, chatId?, temperature?, maxTokens? }` | Send a message. Omit `chatId` to start a new chat. Add `?stream=true` for an SSE streaming response. |
| GET | `/api/chat/history` | — | List the user's chats (summaries, most recent first) |
| GET | `/api/chat/:id` | — | Get a single chat with full message history |
| PATCH | `/api/chat/:id` | `{ title }` | Rename a chat |
| DELETE | `/api/chat/:id` | — | Delete a chat |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Basic health check |

**Example — send a message (non-streaming):**

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "Explain recursion in one paragraph."}'
```

**Example — streaming:** the client opens `POST /api/chat?stream=true` and reads a `text/event-stream` response with three event types: `meta` (chat id/title), `chunk` (`{ delta }` text pieces), and `done`/`error`.

### Standard response shape

```json
{ "success": true, "data": { ... }, "message": "optional" }
{ "success": false, "message": "Error description", "errors": ["optional", "list"] }
```

HTTP status codes used: `200/201` success, `400` validation error, `401` auth error, `403` forbidden, `404` not found, `409` conflict (duplicate email), `429` rate limited, `500` server error, `502/503` upstream AI/DB unavailable.

---

## Switching AI providers

The AI layer is fully modular (`server/services/aiService.js` + `server/services/providers/*`).

To switch providers, just change one line in `.env`:

```env
LLM_PROVIDER=groq
```

To add a brand-new provider (e.g. a local Ollama instance):

1. Create `server/services/providers/ollamaProvider.js` exporting `generateResponse(messages, options)` and `generateStreamResponse(messages, options, onChunk)`.
2. Register it in the `providers` map in `server/services/aiService.js`.
3. Add its config block to `server/config/config.js` and `.env`.

No controller, route, or frontend code needs to change.

---

## Security

- **Helmet** sets secure HTTP headers.
- **CORS** restricted to `CLIENT_ORIGIN` in production.
- **Rate limiting**: global API limiter, a stricter auth limiter, and a chat-specific limiter to protect free-tier LLM quotas.
- **Validation**: every request body is validated with `express-validator` before hitting a controller.
- **Sanitization**: `express-mongo-sanitize` strips NoSQL-injection operators; `xss`/`DOMPurify` sanitize user-supplied text on both ends.
- **Passwords**: hashed with bcrypt (never returned in API responses).
- **JWT**: short-lived, signed with a server-only secret; sent as a Bearer token, not a cookie (simplifies CORS + avoids CSRF surface).
- **Secrets**: all keys/URIs live in `.env`, which is git-ignored.

---

## Deployment guide

### 1. Database
Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier available). Whitelist your server's IP and copy the connection string into `MONGODB_URI`.

### 2. Environment
Set all variables from `.env.example` in your host's environment/secret manager. Set `NODE_ENV=production` and `CLIENT_ORIGIN` to your deployed URL.

### 3. Deploy the Node app
Works on any Node host since frontend + backend are served from the same Express process (no build step required):

- **Render / Railway / Fly.io**: connect the repo, set the start command to `npm start`, add the environment variables, deploy.
- **VPS (e.g. Ubuntu + Nginx)**:
  ```bash
  npm install --production
  npm install -g pm2
  pm2 start server/server.js --name nimbus-chatbot
  pm2 save
  ```
  Put Nginx in front as a reverse proxy to `localhost:5000` and terminate TLS there.
- **Docker** (minimal example):
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm install --production
  COPY . .
  EXPOSE 5000
  CMD ["npm", "start"]
  ```

### 4. Post-deploy checklist
- [ ] `JWT_SECRET` is a long random value (not the default)
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` points to your production database
- [ ] The correct `LLM_PROVIDER` and matching API key are set
- [ ] `GET /api/health` returns `200`

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `503` on every request | MongoDB isn't reachable — check `MONGODB_URI` |
| `500` "API key is not configured" | The API key for your selected `LLM_PROVIDER` is missing in `.env` |
| `429` from the AI | You've hit the free-tier rate limit of the provider — wait, or switch `LLM_PROVIDER` |
| `401 Unauthorized` in the app | Your JWT expired — log out and back in |
| Streaming doesn't show text incrementally | Some proxies buffer SSE — ensure your reverse proxy disables buffering for `/api/chat` (see the `X-Accel-Buffering: no` header already set by the server) |

---

Built with plain JavaScript end-to-end — no TypeScript, no build step, no framework lock-in.
