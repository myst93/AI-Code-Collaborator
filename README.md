# 🚀 CodeFusion (DevSync AI) — Collaborative Code Editor

> **A real-time collaborative coding environment with integrated WebRTC video interviews and an AI-powered Gemini assistant.**

CodeFusion is a full-stack platform engineered for live technical interviews, pair programming, and collaborative problem-solving. It integrates a feature-rich Monaco-based editor (VS Code engine), real-time WebSocket synchronization, multi-language sandbox code execution, peer-to-peer WebRTC video calls, and a context-aware Google Gemini AI coding assistant.

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🏗️ System Architecture](#️-system-architecture)
- [📦 Docker Infrastructure](#-docker-infrastructure)
  - [Client Dockerfile (Multi-Stage Build + Nginx)](#1-client-dockerfile-clientdockerfile)
  - [Server Dockerfile (Multi-Language Sandbox)](#2-server-dockerfile-serverdockerfile)
  - [Docker Compose Orchestration](#3-docker-compose-orchestration-docker-composeyml)
- [⚙️ Environment Variables](#️-environment-variables)
- [🐳 Local Quickstart with Docker](#-local-quickstart-with-docker-recommended)
- [🛠️ Manual Local Setup (Without Docker)](#️-manual-local-setup-without-docker)
- [☁️ AWS Deployment Guide (EC2 + Docker)](#️-aws-deployment-guide-ec2--docker)
  - [1. Launch an EC2 Instance](#step-1-launch-an-aws-ec2-instance)
  - [2. Configure Security Group Rules](#step-2-configure-security-group-inbound-rules)
  - [3. Connect via SSH](#step-3-connect-to-your-instance-via-ssh)
  - [4. Install Docker & Docker Compose](#step-4-install-docker--docker-compose)
  - [5. Clone & Configure the Project](#step-5-clone-and-configure-the-project)
  - [6. Build & Launch Containers](#step-6-build-and-launch-containers)
  - [7. Production Port 80 Mapping & SSL](#step-7-production-port-80-mapping--ssl)
- [🔌 API & WebSocket Reference](#-api--websocket-reference)
- [🔒 Security & Sandbox Isolation](#-security--sandbox-isolation)
- [📄 License](#-license)

---

## ✨ Features

### 🖥️ Collaborative Code Editor
- **Real-Time Code Sync**: Instant character-by-character broadcasting to all room members via Socket.IO.
- **Monaco Editor Engine**: Powers VS Code with intelligent code formatting, bracket matching, and syntax highlighting.
- **Synced Language Selection**: Seamless switching across JavaScript, Python, C++, Java, and Go synced in real time.
- **Collaborative Presence**: Live remote cursor tracking and user presence indicators.

### ▶️ Multi-Language Execution Engine
- **Streaming Execution**: Real-time stdout/stderr streamed directly through WebSockets to an interactive terminal.
- **One-Shot REST Execution**: Buffered POST endpoint (`/api/execute`) for programmatic testing.
- **Interactive Stdin**: Full bi-directional stdin support mid-execution for console input prompts.
- **Sandboxed Security**: Isolated execution scratch spaces with a 5-second process timeout and 1 MB output cap.

| Supported Language | Runtime / Compiler | Version Included in Docker |
|--------------------|--------------------|----------------------------|
| **JavaScript**     | Node.js            | v20 LTS                    |
| **Python**         | Python 3           | 3.11+                      |
| **C++**            | g++ (GCC)          | 12+                        |
| **Java**           | OpenJDK            | 17+ Headless               |
| **Go**             | Go Compiler        | 1.22+                      |

### 🤖 Context-Aware Gemini AI Assistant
- **Context Injection**: Gemini automatically analyzes current editor code and terminal output with zero manual copy-pasting.
- **Multi-Turn Chat**: Preserves conversation history for follow-up questions and iterative refactoring.
- **Quick Actions**:
  - 🔍 **Explain**: Line-by-line logic breakdown and algorithmic complexity analysis.
  - 🐛 **Debug**: Detects syntax bugs, logical edge-cases, and fixes runtime errors.
  - ⚡ **Optimize**: Generates Big-O performance optimizations and cleaner implementations.
- Powered by Google Gemini 2.0 Flash via `@google/genai`.

### 📹 WebRTC Video Interview Mode
- **Full Mesh Video Calling**: Low-latency, peer-to-peer browser video and audio streams using WebRTC.
- **Interview Mode**: Expands into an interview workspace layout with full-screen code and interactive video tiles.
- **Media Toggles**: Independent hardware toggles for microphone mute and camera feed disabling.
- **Resource Cleanup**: Automated webcam and microphone stream release upon room exit.

### 💬 Room Chat & Persistence
- **Room-Scoped Messaging**: Instant in-room team chat.
- **MongoDB Persistence**: Room code, language selections, and chat records persist in MongoDB so late joiners catch up instantly.

---

## 🏗️ System Architecture

```
CodeFusion Workspace
├── client/                      # React 19 + Vite Frontend
│   ├── Dockerfile               # Multi-stage production build (Node + Nginx)
│   ├── nginx.conf               # Reverse-proxy config for SPA routing & WebSockets
│   └── src/
│       ├── App.jsx              # Main app controller, Socket.IO & WebRTC mesh coordinator
│       ├── context/AuthContext  # Client authentication state provider
│       └── components/
│           ├── EditorContainer  # Monaco code editor & interactive terminal
│           ├── AIPanel          # Gemini assistant tabs & room chat
│           └── VideoGrid        # WebRTC video tile matrix
│
├── server/                      # Node.js + Express + Socket.IO Backend
│   ├── Dockerfile               # Multi-language compiler & execution container
│   ├── index.js                 # Server entry point & HTTP/WebSocket server
│   ├── config/
│   │   ├── db.js                # MongoDB connection handler (Mongoose)
│   │   └── ai.js                # Gemini API initialization
│   ├── controllers/
│   │   ├── aiController.js      # AI prompt processing & streaming
│   │   └── executeController.js # Synchronous execution controller
│   ├── services/
│   │   └── executeService.js    # Child process sandbox execution engine
│   └── sockets/
│       └── socketHandler.js     # Real-time room events, cursors, and WebRTC signaling
│
└── docker-compose.yml           # Unified orchestration for MongoDB, Server & Client
```

---

## 📦 Docker Infrastructure

The project includes production-ready Dockerfiles and a Compose specification that completely eliminates manual dependency installation.

### 1. Client Dockerfile (`client/Dockerfile`)
Uses an efficient **multi-stage build**:
1. **Build Stage (`node:22-alpine`)**: Installs dependencies and bundles the React application via Vite (`npm run build`).
2. **Production Stage (`nginx:alpine`)**: Copies the compiled static assets into Nginx and configures an internal reverse proxy:
   - `/` serves the React Single Page Application (`try_files $uri /index.html`).
   - `/api/` seamlessly proxies REST API requests to the backend container (`http://server:5000/api/`).
   - `/socket.io/` handles WebSocket upgrades with sticky sessions (`proxy_set_header Upgrade $http_upgrade`).
   - Eliminates CORS issues and hardcoded host URLs in production.

### 2. Server Dockerfile (`server/Dockerfile`)
Built on `node:20-bookworm-slim` to provide an all-in-one execution sandbox:
- Pre-installs **Python 3**, **GCC/G++**, **Default JDK Headless**, and **Go (golang-go)**.
- Creates an isolated `/app/temp_runs` execution directory with restricted access.
- Runs with production node settings (`NODE_ENV=production`).

### 3. Docker Compose Orchestration (`docker-compose.yml`)
Spins up three connected services on a private bridge network (`devsync-network`):
- **`mongodb`**: Official `mongo:7.0` container with a persistent volume (`devsync_mongodb_data`) and built-in healthcheck.
- **`server`**: Built from `./server`, waits for MongoDB healthcheck confirmation before starting.
- **`client`**: Built from `./client`, exposes port `3000` (or `80` in production) and routes API/WebSocket traffic internally to `server:5000`.

---

## ⚙️ Environment Variables

Copy `.env.example` to create your root environment file:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Express backend server |
| `GEMINI_API_KEY` | *(Required)* | Google Gemini API key ([Get one free from AI Studio](https://aistudio.google.com/)) |
| `MONGODB_URI` | `mongodb://mongodb:27017/devsync` | MongoDB connection URI (`mongodb://localhost:27017/devsync` for local host runs) |
| `VITE_SOCKET_URL` | *(Optional)* | Backend URL for client. In Docker/Nginx setups, this defaults automatically to current origin (`window.location.origin`) |

---

## 🐳 Local Quickstart with Docker (Recommended)

Running with Docker Compose installs all language compilers, spins up MongoDB, builds the client, and launches the entire stack in one command.

### 1. Configure `.env`
```bash
cp .env.example .env
```
Open `.env` and paste your Gemini API key:
```env
GEMINI_API_KEY=AIzaSy...
```

### 2. Start the Stack
```bash
docker compose up --build
```

### 3. Access the Application
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

To run in the background (detached mode):
```bash
docker compose up -d --build
```

To stop containers:
```bash
docker compose down
```

---

## 🛠️ Manual Local Setup (Without Docker)

If you prefer to run services directly on your host machine:

### 1. Prerequisites
- **Node.js**: v18+ & **npm**: v9+
- **MongoDB**: v6+ running locally (`sudo systemctl start mongod` or `mongod --dbpath /data/db`)
- Language runtimes for code execution: `python3`, `g++`, `default-jdk`, `golang-go`

### 2. Setup Server
```bash
cd server
npm install
cp ../.env.example .env
# Ensure MONGODB_URI=mongodb://localhost:27017/devsync and GEMINI_API_KEY are configured
npm run dev
```

### 3. Setup Client
```bash
cd ../client
npm install
npm run dev
```
Client runs at [http://localhost:5173](http://localhost:5173).

---

## ☁️ AWS Deployment Guide (EC2 + Docker)

This guide walks through deploying CodeFusion on an **AWS EC2** instance using Docker and Docker Compose.

```
                    ┌────────────────────────────────────────────────────────┐
                    │                    AWS EC2 Instance                    │
                    │                                                        │
 Internet           │   ┌────────────────┐      ┌────────────────────────┐   │
 ─────────► [Port 80] ─►│ devsync-client │ ────►│ devsync-server         │   │
 (Browser)          │   │ (Nginx :80)    │ /api │ (Node.js :5000)        │   │
                    │   └────────────────┘ /ws  └───────────┬────────────┘   │
                    │                                       │                │
                    │                                       ▼                │
                    │                           ┌────────────────────────┐   │
                    │                           │ devsync-mongodb        │   │
                    │                           │ (MongoDB :27017)       │   │
                    │                           └────────────────────────┘   │
                    └────────────────────────────────────────────────────────┘
```

### Step 1: Launch an AWS EC2 Instance
1. Log in to the **AWS Management Console** and navigate to **EC2** > **Launch Instance**.
2. **Name**: `codefusion-app` (or your preferred name).
3. **AMI**: **Amazon Linux 2023 AMI** or **Ubuntu Server 24.04 LTS**.
4. **Instance Type**: `t3.small` or `t3.medium` (recommended, as compiling C++/Java/Go requires sufficient RAM and CPU).
5. **Key Pair**: Select or create a new key pair (e.g., `codefusion.pem`) and download it.
6. **Storage**: At least **20 GB** gp3 SSD (to hold Docker images, compilers, and MongoDB data).

### Step 2: Configure Security Group Inbound Rules
Ensure your EC2 Security Group permits the following inbound traffic:

| Type | Protocol | Port Range | Source | Purpose |
|---|---|---|---|---|
| **SSH** | TCP | `22` | `My IP` (or `0.0.0.0/0`) | Remote terminal administration |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Public web app access (Nginx) |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL web access |
| **Custom TCP** | TCP | `3000` | `0.0.0.0/0` | *(Optional)* Direct client testing port |

> **Security Note:** Keep port `27017` (MongoDB) closed to the public Internet. The containers communicate privately inside the Docker bridge network.

### Step 3: Connect to your Instance via SSH
Set key permissions on your local machine and connect:

```bash
chmod 400 ~/Downloads/codefusion.pem
ssh -i ~/Downloads/codefusion.pem ec2-user@<YOUR-EC2-PUBLIC-IP>
```
*(If using Ubuntu, use `ubuntu@<YOUR-EC2-PUBLIC-IP>` instead of `ec2-user`).*

### Step 4: Install Docker & Docker Compose

#### On Amazon Linux 2023:
```bash
# Update packages
sudo dnf update -y

# Install Docker
sudo dnf install -y docker git
sudo systemctl enable --now docker

# Add your user to the docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins/
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Re-login to apply group permissions
newgrp docker
```

#### On Ubuntu:
```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Verify installation:
```bash
docker --version
docker compose version
```

### Step 5: Clone and Configure the Project

```bash
# Clone the repository
git clone https://github.com/myst93/AI-Code-Collaborator.git
cd AI-Code-Collaborator

# Create .env from template
cp .env.example .env
```

Edit your `.env` file with your credentials:
```bash
nano .env
```
Provide your actual Gemini API key:
```env
PORT=5000
GEMINI_API_KEY=AIzaSyYourActualKeyHere
MONGODB_URI=mongodb://mongodb:27017/devsync
```

### Step 6: Build and Launch Containers

Run the compose command in detached mode:
```bash
docker compose up -d --build
```

Monitor container health and status:
```bash
docker compose ps
```

View real-time aggregated logs:
```bash
docker compose logs -f
```

### Step 7: Production Port 80 Mapping & SSL

By default, the client container binds to `3000:80`. To serve your application directly on standard HTTP port 80:

1. Update the `client` section in [docker-compose.yml](file:///home/oberai/Projects/Code%20Editor/docker-compose.yml):
   ```yaml
   client:
     build:
       context: ./client
       dockerfile: Dockerfile
     container_name: devsync-client
     restart: unless-stopped
     ports:
       - "80:80"       # Map port 80 directly
     depends_on:
       - server
     networks:
       - devsync-network
   ```
2. Re-deploy:
   ```bash
   docker compose up -d
   ```
3. Open `http://<YOUR-EC2-PUBLIC-IP>` in your browser!

#### Enabling SSL / HTTPS with Let's Encrypt (Recommended for WebRTC Camera/Mic)
Browsers require a secure context (`https://` or `localhost`) to access webcams and microphones via `getUserMedia()`. For production video calls on AWS:

1. Point your domain (e.g. `codefusion.yourdomain.com`) to your EC2 Public IP via an **A Record** in your DNS provider (Route 53, Cloudflare, Namecheap, etc.).
2. You can terminate SSL via an **AWS Application Load Balancer (ALB)** with a free AWS Certificate Manager (ACM) certificate, or install **Certbot** with host Nginx reverse proxy.

---

## 🔌 API & WebSocket Reference

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status check |
| `POST` | `/api/execute` | Synchronous buffered code execution |
| `POST` | `/api/ai/chat` | Context-aware AI prompt completion |

#### `POST /api/execute`
```json
{
  "language": "python",
  "code": "print('Hello, CodeFusion!')",
  "stdin": ""
}
```

#### `POST /api/ai/chat`
```json
{
  "prompt": "Optimize this sorting algorithm",
  "code": "function bubbleSort(arr) { ... }",
  "compilerOutput": "STDOUT:\n...\nSTDERR:\n...",
  "history": []
}
```

### Socket.IO Real-Time Events

#### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, username }` | Join or initialize collaborative room session |
| `code-change` | `{ roomId, code }` | Broadcast live code change |
| `language-change` | `{ roomId, language }` | Synchronize selected programming language |
| `cursor-change` | `{ roomId, cursor, username }` | Broadcast live cursor coordinates |
| `run-code` | `{ language, code }` | Trigger streaming compilation and execution |
| `stop-code` | — | Abort currently running execution process |
| `terminal-input` | `string` | Send stdin characters to active child process |
| `chat-message` | `{ roomId, message, username }` | Broadcast team chat message |
| `webrtc-signal` | `{ roomId, targetSocketId, signalData }` | WebRTC SDP offer/answer/ICE candidate relay |

#### Server → Client
| Event | Payload | Description |
|---|---|---|
| `room-users` | `User[]` | Active connected user list |
| `initial-code` | `{ code, language, chatHistory }` | Initial room state delivered on connection |
| `code-update` | `string` | Synchronized code content from peer |
| `language-update` | `string` | Updated editor syntax language |
| `terminal-output` | `string` | Streamed stdout/stderr chunk |
| `terminal-exit` | `number` | Exit code when process completes |
| `chat-message` | `{ id, username, message, timestamp }` | Incoming room message |
| `webrtc-signal` | `{ senderSocketId, signalData }` | Routed WebRTC signal |
| `user-left` | `{ socketId, username }` | Participant disconnect notification |

---

## 🔒 Security & Sandbox Isolation

- **Execution Timeout**: Enforced hard 5-second process timeout kills runaway infinite loops and CPU-hogging scripts.
- **Output Buffering Cap**: Maximum 1 MB buffer limit prevents memory exhaustion from flood logging.
- **Filesystem Isolation**: Code executions run in unique, temporary working directories created on-the-fly and wiped immediately after execution.
- **Container Isolation**: In Docker mode, compiler toolchains execute completely segregated from the host operating system.
- **Protected Database Layer**: MongoDB is isolated inside the private Docker bridge network and not exposed externally.

---

## 🛠️ Maintenance & Troubleshooting Commands

```bash
# View running containers and resource usage
docker stats

# Follow server logs in real time
docker compose logs -f server

# Restart only the backend service
docker compose restart server

# Rebuild only the frontend after code edits
docker compose build client && docker compose up -d client

# Clean up stopped containers, unused networks, and dangling images
docker system prune -f
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

<div align="center">
  <sub>Built with ❤️ for real-time collaboration and seamless technical interviews.</sub>
</div>
