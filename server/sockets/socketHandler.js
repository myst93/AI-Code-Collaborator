import { spawn, exec } from 'child_process';
import Room from '../models/Room.js';
import { getDbStatus } from '../config/db.js';
import { prepareStreamingExecution } from '../services/executeService.js';

// In-memory active user sockets tracker & timers
const rooms = {};
const saveTimers = {};
const activeProcesses = {};
const inMemoryRooms = {};

// Helper: Fetch room document from DB, or fallback to in-memory store
const getOrCreateRoom = async (roomId) => {
  if (getDbStatus()) {
    try {
      let dbRoom = await Room.findOne({ roomId });
      if (!dbRoom) {
        dbRoom = await Room.create({
          roomId,
          code: '// Welcome to the Collaborative Editor! Write your code here.\n',
          language: 'javascript',
          chatHistory: [],
        });
        console.log(`[DB] Created new document room: ${roomId}`);
      }
      return dbRoom;
    } catch (err) {
      console.error('[DB Fetch Error] Fallback to in-memory.', err.message);
    }
  }

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
  if (getDbStatus()) {
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
  if (getDbStatus()) {
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
  if (getDbStatus()) {
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

export default function registerSocketHandler(io) {
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

      let execDetails;
      try {
        execDetails = prepareStreamingExecution({ language, code });
      } catch (err) {
        socket.emit('terminal-output', `[System Error]: ${err.message}\n`);
        socket.emit('terminal-exit', 1);
        return;
      }

      const { runDir, compileCmd, runCmd, execArgs, cleanup } = execDetails;

      const startSpawn = () => {
        socket.emit('terminal-output', `[System]: Executing code...\n`);

        const child = spawn(runCmd, execArgs, {
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
          delete activeProcesses[socket.id];
          cleanup();
        });

        child.on('error', (err) => {
          clearTimeout(killTimeout);
          socket.emit('terminal-output', `[System Error]: Execution error: ${err.message}\n`);
          socket.emit('terminal-exit', 1);
          delete activeProcesses[socket.id];
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
}
