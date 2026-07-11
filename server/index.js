import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with specific frontend URL
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devsync';

// Setup workspace path details for local compiler sandbox
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, 'temp_runs');

// Ensure compile sandbox directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ----------------------------------------------------
// Database Connection & Auto-Fallback Recovery State
// ----------------------------------------------------
let isDbConnected = false;

mongoose.connect(MONGODB_URI)
  .then(() => {
    isDbConnected = true;
    console.log('MongoDB successfully connected.');
  })
  .catch((err) => {
    isDbConnected = false;
    console.warn('MongoDB connection failed. Session running in-memory fallback. Error:', err.message);
  });

mongoose.connection.on('connected', () => { isDbConnected = true; });
mongoose.connection.on('disconnected', () => { isDbConnected = false; });
mongoose.connection.on('error', () => { isDbConnected = false; });

// MongoDB Room schema definition
const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: '// Welcome to the Collaborative Editor! Write your code here.\n' },
  language: { type: String, default: 'javascript' },
  chatHistory: [
    {
      id: String,
      username: String,
      message: String,
      timestamp: String,
    }
  ]
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// In-memory fallback session store (for when MongoDB is offline)
const inMemoryRooms = {};

// Helper: Retrieve room details dynamically
const getOrCreateRoom = async (roomId) => {
  if (isDbConnected) {
    try {
      let dbRoom = await Room.findOne({ roomId });
      if (!dbRoom) {
        dbRoom = await Room.create({
          roomId,
          code: '// Welcome to the Collaborative Editor! Write your code here.\n',
          language: 'javascript',
          chatHistory: [],
        });
      }
      return dbRoom;
    } catch (err) {
      console.error('[DB Fallback] Error fetching room from MongoDB:', err.message);
    }
  }

  // Fallback memory state logic
  if (!inMemoryRooms[roomId]) {
    inMemoryRooms[roomId] = {
      roomId,
      code: '// Welcome to the Collaborative Editor! Write your code here.\n',
      language: 'javascript',
      chatHistory: [],
    };
    console.log(`[Memory Fallback] Created session for room: ${roomId}`);
  }
  return inMemoryRooms[roomId];
};

// Helper: Save room editor text dynamically
const saveCode = async (roomId, code) => {
  if (isDbConnected) {
    try {
      await Room.findOneAndUpdate({ roomId }, { code }, { upsert: true });
      console.log(`[DB] Code persisted to MongoDB for room: ${roomId}`);
      return;
    } catch (err) {
      console.error('[DB Save Error] Failed to write code to MongoDB:', err.message);
    }
  }

  if (!inMemoryRooms[roomId]) {
    inMemoryRooms[roomId] = { roomId };
  }
  inMemoryRooms[roomId].code = code;
  console.log(`[Memory Fallback] Code updated in-memory for room: ${roomId}`);
};

// Helper: Save programming language dynamically
const saveLanguage = async (roomId, language) => {
  if (isDbConnected) {
    try {
      await Room.findOneAndUpdate({ roomId }, { language }, { upsert: true });
      console.log(`[DB] Language persisted to MongoDB for room: ${roomId}`);
      return;
    } catch (err) {
      console.error('[DB Save Error] Failed to write language to MongoDB:', err.message);
    }
  }

  if (!inMemoryRooms[roomId]) {
    inMemoryRooms[roomId] = { roomId };
  }
  inMemoryRooms[roomId].language = language;
  console.log(`[Memory Fallback] Language updated in-memory for room: ${roomId}`);
};

// Helper: Save chat history log dynamically
const saveChatMessage = async (roomId, chatMsg) => {
  if (isDbConnected) {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $push: { chatHistory: chatMsg } },
        { upsert: true }
      );
      console.log(`[DB] Chat message persisted to MongoDB for room: ${roomId}`);
      return;
    } catch (err) {
      console.error('[DB Save Error] Failed to write chat message to MongoDB:', err.message);
    }
  }

  if (!inMemoryRooms[roomId]) {
    inMemoryRooms[roomId] = { roomId, chatHistory: [] };
  }
  if (!inMemoryRooms[roomId].chatHistory) {
    inMemoryRooms[roomId].chatHistory = [];
  }
  inMemoryRooms[roomId].chatHistory.push(chatMsg);
  console.log(`[Memory Fallback] Chat log appended in-memory for room: ${roomId}`);
};

// ----------------------------------------------------
// AI Agent Client Initialization
// ----------------------------------------------------
let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Gemini AI Client successfully initialized.');
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment. AI features will fail.');
}

// In-memory active user sockets tracker
const rooms = {};
const saveTimers = {};
const activeProcesses = {};

// Socket.IO signaling & synchronization logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Join Room
  socket.on('join-room', async ({ roomId, username }) => {
    socket.join(roomId);
    
    // Fetch room from DB / Memory Fallback
    const roomState = await getOrCreateRoom(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
      };
    }

    // Add user to the active room list
    const userExist = rooms[roomId].users.some(u => u.socketId === socket.id);
    if (!userExist) {
      rooms[roomId].users.push({ socketId: socket.id, username });
    }

    console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);

    // Emit list of active users to everyone in the room
    io.to(roomId).emit('room-users', rooms[roomId].users);

    // Send the current code, language, and historical chat messages to the newly joined user
    socket.emit('initial-code', {
      code: roomState.code,
      language: roomState.language,
      chatHistory: roomState.chatHistory || [],
    });

    // Notify other users that someone joined
    socket.to(roomId).emit('user-joined', { socketId: socket.id, username });
  });

  // 2. Real-Time Code Sync
  socket.on('code-change', ({ roomId, code }) => {
    socket.to(roomId).emit('code-update', code);
    
    // Save to database with debouncing
    if (saveTimers[roomId]) {
      clearTimeout(saveTimers[roomId]);
    }
    
    saveTimers[roomId] = setTimeout(() => {
      saveCode(roomId, code);
    }, 2000);
  });

  // 3. Language Selection Sync
  socket.on('language-change', ({ roomId, language }) => {
    socket.to(roomId).emit('language-update', language);
    saveLanguage(roomId, language);
  });

  // 4. Cursor Position Sync
  socket.on('cursor-change', ({ roomId, cursor, username }) => {
    socket.to(roomId).emit('cursor-update', { socketId: socket.id, cursor, username });
  });

  // 5. WebRTC Video Call Signaling
  socket.on('webrtc-signal', ({ roomId, targetSocketId, signalData }) => {
    io.to(targetSocketId).emit('webrtc-signal', {
      senderSocketId: socket.id,
      signalData,
    });
  });

  // 6. Text Chat & Log Persistence
  socket.on('chat-message', ({ roomId, message, username }) => {
    const chatMsg = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    io.to(roomId).emit('chat-message', chatMsg);
    saveChatMessage(roomId, chatMsg);
  });

  // 7. Disconnection Clean-Up
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Stop running processes for this socket
    if (activeProcesses[socket.id]) {
      try { activeProcesses[socket.id].kill('SIGKILL'); } catch (e) {}
      delete activeProcesses[socket.id];
    }

    Object.keys(rooms).forEach((roomId) => {
      const room = rooms[roomId];
      const index = room.users.findIndex((u) => u.socketId === socket.id);
      
      if (index !== -1) {
        const disconnectedUser = room.users[index];
        room.users.splice(index, 1);
        
        io.to(roomId).emit('room-users', room.users);
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: disconnectedUser.username,
        });

        if (room.users.length === 0) {
          delete rooms[roomId];
          
          if (saveTimers[roomId]) {
            clearTimeout(saveTimers[roomId]);
            delete saveTimers[roomId];
          }
          
          console.log(`Room ${roomId} is now inactive and cleared from memory.`);
        }
      }
    });
  });

  // 8. Run Code (Interactive Spawn Engine)
  socket.on('run-code', ({ language, code }) => {
    // Terminate any running process for this socket first
    if (activeProcesses[socket.id]) {
      try { activeProcesses[socket.id].kill('SIGKILL'); } catch (e) {}
      delete activeProcesses[socket.id];
    }

    const runId = Math.random().toString(36).substring(2, 9);
    const runDir = path.join(TEMP_DIR, runId);
    
    try {
      fs.mkdirSync(runDir, { recursive: true });
    } catch (err) {
      socket.emit('terminal-output', `[System Error]: Failed to create sandboxed folder: ${err.message}\n`);
      socket.emit('terminal-exit', 1);
      return;
    }

    let filename = '';
    let compileCmd = '';
    let runCmd = '';
    let execArgs = [];

    switch (language.toLowerCase()) {
      case 'javascript':
        filename = 'main.js';
        runCmd = 'node';
        execArgs = ['main.js'];
        break;
      case 'python':
        filename = 'main.py';
        runCmd = 'python3';
        execArgs = ['main.py'];
        break;
      case 'cpp':
        filename = 'main.cpp';
        compileCmd = `g++ main.cpp -o main_bin`;
        runCmd = './main_bin';
        execArgs = [];
        break;
      case 'java':
        filename = 'Main.java';
        compileCmd = `javac Main.java`;
        runCmd = 'java';
        execArgs = ['Main'];
        break;
      case 'go':
        filename = 'main.go';
        runCmd = 'go';
        execArgs = ['run', 'main.go'];
        break;
      default:
        try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
        socket.emit('terminal-output', `[System Error]: Language ${language} is not supported.\n`);
        socket.emit('terminal-exit', 1);
        return;
    }

    // Write code file
    const filePath = path.join(runDir, filename);
    try {
      fs.writeFileSync(filePath, code);
    } catch (err) {
      socket.emit('terminal-output', `[System Error]: Failed to write file: ${err.message}\n`);
      socket.emit('terminal-exit', 1);
      try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
      return;
    }

    const cleanup = () => {
      delete activeProcesses[socket.id];
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch (e) {}
    };

    const startSpawn = () => {
      let actualCmd = runCmd;
      let actualArgs = execArgs;

      socket.emit('terminal-output', `[System]: Executing code...\n`);

      const child = spawn(actualCmd, actualArgs, {
        cwd: runDir,
        env: { ...process.env, PATH: process.env.PATH }
      });

      activeProcesses[socket.id] = child;

      // 15 seconds runtime limit trigger
      const killTimeout = setTimeout(() => {
        if (child && !child.killed) {
          try { child.kill('SIGKILL'); } catch (e) {}
          socket.emit('terminal-output', `\n[System Timeout]: Script execution exceeded the 15-second sandbox limit.\n`);
        }
      }, 15000);

      child.stdout.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      child.stderr.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      child.on('close', (exitCode) => {
        clearTimeout(killTimeout);
        socket.emit('terminal-exit', exitCode === null ? 1 : exitCode);
        cleanup();
      });

      child.on('error', (err) => {
        clearTimeout(killTimeout);
        socket.emit('terminal-output', `[System Error]: Execution error: ${err.message}\n`);
        socket.emit('terminal-exit', 1);
        cleanup();
      });
    };

    // Run compiler first if compile command is active
    if (compileCmd) {
      socket.emit('terminal-output', `[System]: Compiling code...\n`);
      exec(compileCmd, { cwd: runDir, timeout: 8000 }, (cErr, cStdout, cStderr) => {
        if (cErr) {
          socket.emit('terminal-output', cStderr || cErr.message);
          socket.emit('terminal-exit', cErr.code || 1);
          cleanup();
          return;
        }
        startSpawn();
      });
    } else {
      startSpawn();
    }
  });

  // 9. Interactive terminal standard input relay
  socket.on('terminal-input', (text) => {
    const child = activeProcesses[socket.id];
    if (child && child.stdin && !child.killed) {
      try {
        child.stdin.write(text);
      } catch (err) {
        console.error('Error writing to child stdin:', err.message);
      }
    }
  });

  // 10. Stop running process
  socket.on('stop-code', () => {
    const child = activeProcesses[socket.id];
    if (child) {
      try { child.kill('SIGKILL'); } catch (e) {}
      delete activeProcesses[socket.id];
      socket.emit('terminal-output', `\n[System]: Execution stopped by user.\n`);
      socket.emit('terminal-exit', 130);
    }
  });
});

// ----------------------------------------------------
// Local Sandboxed Code Compilation & Execution Engine
// ----------------------------------------------------
app.post('/api/execute', async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required.' });
  }

  // Create a unique temporary directory for this run
  const runId = Math.random().toString(36).substring(2, 9);
  const runDir = path.join(TEMP_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  let filename = '';
  let compileCmd = '';
  let runCmd = '';

  switch (language.toLowerCase()) {
    case 'javascript':
      filename = 'main.js';
      runCmd = `node ${filename}`;
      break;
    case 'python':
      filename = 'main.py';
      // Attempt Python3 first, fallback to standard python command
      runCmd = `python3 ${filename} || python ${filename}`;
      break;
    case 'cpp':
      filename = 'main.cpp';
      compileCmd = `g++ main.cpp -o main_bin`;
      runCmd = `./main_bin`;
      break;
    case 'java':
      filename = 'Main.java';
      compileCmd = `javac Main.java`;
      runCmd = `java Main`;
      break;
    case 'go':
      filename = 'main.go';
      runCmd = `go run main.go`;
      break;
    default:
      fs.rmSync(runDir, { recursive: true, force: true });
      return res.status(400).json({ error: `Language ${language} is not supported for local compilation.` });
  }

  // Write temporary source file
  const filePath = path.join(runDir, filename);
  fs.writeFileSync(filePath, code);

  // Sandboxed child process execution parameters
  const execOptions = {
    cwd: runDir,
    timeout: 5000, // 5 seconds timeout limit to prevent loops hanging the thread
    maxBuffer: 1024 * 1024, // 1MB maximum buffer threshold
  };

  const executeCode = () => {
    return new Promise((resolve) => {
      // 1. Run compiler check first if compilation command is active (e.g. C++, Java)
      if (compileCmd) {
        exec(compileCmd, execOptions, (cErr, cStdout, cStderr) => {
          if (cErr) {
            resolve({
              stdout: cStdout,
              stderr: cStderr || cErr.message,
              code: cErr.code || 1,
            });
            return;
          }
          runBinary();
        });
      } else {
        runBinary();
      }

      // 2. Execute runnable script / binary
      function runBinary() {
        const child = exec(runCmd, execOptions, (err, stdout, stderr) => {
          if (err && err.killed) {
            resolve({
              stdout,
              stderr: `${stderr}\n[Timeout Error]: Script execution exceeded the 5-second sandbox limit.`,
              code: 124, // standard core timeout status code
            });
          } else {
            resolve({
              stdout,
              stderr: stderr || (err ? err.message : ''),
              code: err ? err.code || 1 : 0,
            });
          }
        });

        // Feed standard input (stdin) if provided
        if (stdin && child.stdin) {
          child.stdin.write(stdin);
          child.stdin.end();
        }
      }
    });
  };

  const runResult = await executeCode();

  // Clean up temporary run workspace directory
  try {
    fs.rmSync(runDir, { recursive: true, force: true });
  } catch (cleanErr) {
    console.error('Temp compilation dir clean error:', cleanErr.message);
  }

  res.json(runResult);
});

// Gemini AI Assistant Endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { prompt, code, compilerOutput, history } = req.body;

  if (!ai) {
    return res.status(503).json({
      error: 'AI service is currently unavailable. Please verify the server is configured with a GEMINI_API_KEY.',
    });
  }

  try {
    const systemPrompt = `You are "DevSync AI Assistant", a premium embedded AI developer agent helping users during a live technical coding interview.
Your role is to act as a helpful technical advisor, compiler debugger, and interviewer co-pilot.
Guidelines:
1. Provide accurate, clear, and readable code explanations, debugging insights, and optimization tips.
2. Keep answers professional and brief. Highlighting specific lines or bugs is helpful.
3. Be constructive. Do not directly spoonfeed the exact full solution instantly to the candidate unless specifically asked, but explain the logic/edge-cases and provide snippets to guide them.
4. When writing code snippets, use markdown code blocks with correct syntax tags.

Below is the context of the user's active session:
-----
CURRENT CODE STATE:
${code || '// No code written yet'}
-----
COMPILER/TERMINAL OUTPUT (if any):
${compilerOutput || 'None'}
-----
`;

    const contents = [
      { text: systemPrompt },
      ...(history || []).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contents,
    });

    res.json({ response: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'Gemini AI Agent failed to generate response.',
      details: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', databaseStatus: isDbConnected ? 'connected' : 'offline-fallback' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
