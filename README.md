# WhatsApp Assistant Backend

Express backend for a portfolio WhatsApp assistant app. It provides account auth, WhatsApp Web session management, recent-chat retrieval, self-message sending, Socket.IO status notifications, scheduled WhatsApp checks, and OpenAI-powered conversation summaries.

This repo is the backend half of the app. It is intended to pair with the frontend in the parent `WAAssistant` workspace, especially `refactored-app` or the deployed frontend origin configured in `server.js`.

## Tech Stack

- Node.js 20 and CommonJS
- Express 4
- MongoDB with Mongoose
- JWT authentication with bcrypt password hashing
- Socket.IO for WhatsApp connection and QR timeout notifications
- whatsapp-web.js with Puppeteer-backed WhatsApp Web sessions
- OpenAI API for chat summaries and suggested engagement
- Agenda for scheduled background work

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the required values in `.env`, then start the server:

```bash
npm start
```

For local development with auto-restart:

```bash
npm run dev
```

The API listens on `PORT` or `5000` by default. In development, CORS is configured for `http://localhost:3000`. In production, the HTTP CORS origin is set to `https://waassistant-frontend.onrender.com`.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP server port. Defaults to `5000`. |
| `NODE_ENV` | No | Switches CORS behavior between development and production. |
| `MONGODB_URI` | Yes | MongoDB connection string for Mongoose and Agenda. |
| `JWT_SECRET` | Yes | Secret used to sign and verify auth tokens. |
| `OPENAI_API_KEY` | Yes | API key used by the OpenAI chat summary service. |
| `CHROME_PATH` | No | Optional Chrome or Chromium executable path for Puppeteer. |

Do not commit `.env` or real credentials. Use `.env.example` only for placeholder documentation.

## Main Modules

- `server.js` configures Express, CORS, Socket.IO, routers, MongoDB, Agenda, and server startup.
- `routers/authRouter.js` handles signup, login, and logout token checks.
- `routers/waManageRouter.js` handles WhatsApp QR login, auth status, and disconnect.
- `routers/waMessageRouter.js` handles recent-message retrieval and self-message sending.
- `services/whatsappClientManager.js` owns WhatsApp Web client lifecycle, QR events, message sending, and session cleanup.
- `services/whatsappAssistant.js` filters recent chats and sends generated summaries to the user's own WhatsApp chat.
- `services/openai.js` calls the OpenAI API for summary generation.
- `scheduler/agenda.js` defines the scheduled WhatsApp check job.
- `socket-handlers.js` bridges internal events to Socket.IO notifications for the frontend.
- `models/user.js` defines the MongoDB user model and lookup helpers.

## Security Notes

- Runtime WhatsApp session data is intentionally ignored: `.wwebjs_auth/`, `.wwebjs_cache/`, and `sessions/`.
- `.env` is ignored and should contain only local secrets.
- Logs should not print full environment values, auth tokens, QR payloads, request headers, or browser session data.
- JWTs currently expire after seven days. There is no server-side token revocation list; frontend logout removes the token client-side.
- WhatsApp Web sessions can contain sensitive account state. Remove local runtime folders before sharing or archiving the repo.

## Current Status

This backend is suitable for portfolio review as a readable project snapshot, not as a hardened production service. The core flows are present, but operational hardening remains: stronger validation, safer session deletion, more complete tests, production-grade logging, and token revocation would be needed before real deployment.
