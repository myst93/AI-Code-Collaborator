# 🚀 DevSync AI — Collaborative Code Editor

> **A real-time collaborative coding environment with integrated video interviews and an AI-powered Gemini assistant.**

DevSync AI is a full-stack web application designed for technical interviews and pair programming. It combines a feature-rich Monaco-based code editor, live WebSocket synchronization, peer-to-peer WebRTC video calls, and a context-aware Gemini AI coding assistant — all in a single unified workspace.

---

## ✨ Features

### 🖥️ Collaborative Code Editor
- **Real-time code sync** — changes are instantly broadcast to all room participants via Socket.IO
- **Monaco Editor** (VS Code engine) with syntax highlighting for all supported languages
- **Shared language selection** — switching language syncs across all connected clients
- **Cursor presence** — see where collaborators are editing in real time

### ▶️ Code Execution Engine
- **Streaming execution** — run code and see output streamed live to all room participants via socket events
- **REST execution** — synchronous buffered execution endpoint for one-shot runs
- **Interactive terminal** — send standard input (`stdin`) to running processes mid-execution
- **Sandboxed environment** — temporary per-run directories with a 5-second timeout and 1 MB output limit to prevent abuse
- **Multi-language support:**

| Language   | Compiler / Runtime |
|------------|--------------------|
| JavaScript | Node.js            |
| Python     | Python 3           |
| C++        | g++                |
| Java       | javac / java       |
| Go         | go run             |

### 🤖 Gemini AI Assistant
- **Context-aware chat** — the AI receives the current code and terminal output as context on every message
- **Persistent conversation history** — multi-turn chat with full history forwarded to the Gemini API
- **Quick Actions:**
  - 🔍 **Explain** — breaks down the code's logic and performance characteristics
  - 🐛 **Debug** — finds syntax bugs, logical edge-cases, and resolves compiler errors first
  - ⚡ **Optimize** — proposes time/space complexity improvements with a refactored version
- Powered by **Gemini 2.0 Flash** via `@google/genai`

### 📹 Video Interview Mode
- **WebRTC peer-to-peer video** — full mesh topology (every participant connects directly to every other)
- **Interview Mode** — enters fullscreen with a live video grid visible alongside the editor
- **Mic & Camera controls** — mute/unmute audio and video independently at any time
- **Auto-teardown** — webcam and microphone are released when exiting Interview Mode

### 💬 Room Chat
- **Shared room chat** — send and receive messages in a room-scoped chat panel
- **Chat history persistence** — MongoDB stores chat history per room so late joiners catch up automatically

### 🗄️ Room Persistence (MongoDB)
- Room state (code, language, chat history) is persisted to MongoDB
- New users joining an existing room receive the current state immediately on connect

---

## 🏗️ Architecture

```
DevSync AI
├── client/          # React 19 + Vite frontend
│   └── src/
│       ├── App.jsx                  # Root component, socket & WebRTC orchestration
│       └── components/
│           ├── EditorContainer.jsx  # Monaco editor + compile panel
│           ├── AIPanel.jsx          # Gemini AI chat + room chat tabs
│           └── VideoGrid.jsx        # WebRTC video tile grid
│
└── server/          # Node.js + Express + Socket.IO backend
    ├── index.js                     # App entry, server bootstrap
    ├── config/
    │   ├── db.js                    # MongoDB connection (Mongoose)
    │   └── ai.js                    # Gemini AI client initialisation
    ├── models/
    │   └── Room.js                  # Room schema (code, language, chatHistory)
    ├── controllers/
    │   ├── aiController.js          # POST /api/ai/chat — Gemini API bridge
    │   └── executeController.js     # POST /api/execute — sync code execution
    ├── routes/
    │   ├── aiRoutes.js
    │   ├── executeRoutes.js
    │   └── healthRoutes.js
    ├── services/
    │   └── executeService.js        # Code sandboxing (sync + streaming modes)
    └── sockets/
        └── socketHandler.js         # All real-time Socket.IO event handling
```

---

## ⚙️ Prerequisites

Make sure the following are installed on your system:

| Dependency  | Minimum Version | Purpose                      |
|-------------|-----------------|------------------------------|
| Node.js     | v18+            | Server & client runtime      |
| npm         | v9+             | Package management           |
| MongoDB     | v6+ (local)     | Room state persistence       |
| Python 3    | v3.8+           | Python code execution        |
| g++         | v11+            | C++ compilation              |
| Java JDK    | v11+            | Java compilation & execution |
| Go          | v1.20+          | Go code execution            |

> **Note:** Only install the language runtimes you plan to use. JavaScript (Node.js) is required as it powers the server.

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd "Code Editor"
```

### 2. Configure the Server

```bash
cd server
cp .env.example .env   # or edit .env directly
```

Edit `server/.env`:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=mongodb://localhost:27017/devsync
```

> Get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 4. Start MongoDB

Make sure your local MongoDB instance is running:

```bash
mongod --dbpath ./data/db
# or with systemd:
sudo systemctl start mongod
```

### 5. Run the Application

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Server starts at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Client starts at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔌 API Reference

### REST Endpoints

| Method | Endpoint         | Description                              |
|--------|------------------|------------------------------------------|
| GET    | `/health`        | Server health check                      |
| POST   | `/api/execute`   | Synchronous code execution (buffered)    |
| POST   | `/api/ai/chat`   | Send a prompt to the Gemini AI assistant |

#### `POST /api/execute`
```json
{
  "language": "python",
  "code": "print('Hello, World!')",
  "stdin": ""
}
```

#### `POST /api/ai/chat`
```json
{
  "prompt": "Explain this code",
  "code": "// current editor content",
  "compilerOutput": "STDOUT:\n...\nSTDERR:\n...",
  "history": [{ "role": "user", "content": "..." }]
}
```

### Socket.IO Events

#### Client → Server

| Event             | Payload                                         | Description                        |
|-------------------|-------------------------------------------------|------------------------------------|
| `join-room`       | `{ roomId, username }`                          | Join or create a room              |
| `code-change`     | `{ roomId, code }`                              | Broadcast a code update            |
| `language-change` | `{ roomId, language }`                          | Broadcast a language switch        |
| `cursor-change`   | `{ roomId, cursor, username }`                  | Broadcast cursor position          |
| `run-code`        | `{ language, code }`                            | Start streaming code execution     |
| `stop-code`       | —                                               | Kill the running process           |
| `terminal-input`  | `string`                                        | Send stdin to the running process  |
| `chat-message`    | `{ roomId, message, username }`                 | Send a room chat message           |
| `webrtc-signal`   | `{ roomId, targetSocketId, signalData }`        | Forward WebRTC SDP / ICE signal    |

#### Server → Client

| Event             | Payload                                         | Description                          |
|-------------------|-------------------------------------------------|--------------------------------------|
| `room-users`      | `User[]`                                        | Updated list of room participants    |
| `initial-code`    | `{ code, language, chatHistory }`               | Room state on join                   |
| `code-update`     | `string`                                        | Incoming code change from a peer     |
| `language-update` | `string`                                        | Incoming language change from a peer |
| `terminal-output` | `string`                                        | Streamed stdout chunk                |
| `terminal-exit`   | `number`                                        | Process exit code                    |
| `chat-message`    | `{ id, username, message, timestamp }`          | Incoming room chat message           |
| `user-left`       | `{ socketId, username }`                        | A participant disconnected           |
| `webrtc-signal`   | `{ senderSocketId, signalData }`                | Forwarded WebRTC signal              |

---

## 🗂️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19, Vite 8, Monaco Editor     |
| Styling    | Vanilla CSS (glassmorphism dark UI) |
| Icons      | Lucide React                        |
| Real-time  | Socket.IO (client + server)         |
| Video      | WebRTC (native browser API)         |
| Backend    | Node.js, Express 4                  |
| Database   | MongoDB + Mongoose 8                |
| AI         | Google Gemini 2.0 Flash             |
| Linting    | OxLint                              |

---

## 🔒 Security Notes

- The server uses a **5-second execution timeout** and **1 MB output cap** to prevent runaway scripts.
- Code is executed in **isolated temporary directories** that are cleaned up after each run.
- In production, restrict the CORS `origin` in `server/index.js` to your specific frontend domain.
- **Never commit your `.env` file** — it contains your Gemini API key and MongoDB credentials.
- WebRTC STUN servers use Google's public STUN (`stun.l.google.com`). For production, consider adding a TURN server for NAT traversal reliability.

---

## 📄 License

This project is open source. See [LICENSE](LICENSE) for details.

---

<div align="center">
  Built with ❤️ — DevSync AI
</div>
