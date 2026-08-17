import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import registerSocketHandler from './sockets/socketHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import executeRoutes from './routes/executeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

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

// Initialize Database Connection
connectDB();

// Mount REST API Routes
app.use('/health', healthRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/ai', aiRoutes);

// Register Real-Time Socket Handlers
registerSocketHandler(io);

// Start Server
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Warning]: Port ${PORT} is currently busy. Retrying in 1s...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT);
    }, 1000);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown for nodemon restarts to prevent EADDRINUSE port binding crashes
process.once('SIGUSR2', () => {
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
