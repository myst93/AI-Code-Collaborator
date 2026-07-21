import express from 'express';
import { getDbStatus } from '../config/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    databaseStatus: getDbStatus() ? 'connected' : 'offline-fallback',
  });
});

export default router;
