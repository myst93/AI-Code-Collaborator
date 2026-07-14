import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devsync';

let isDbConnected = false;

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    isDbConnected = true;
    console.log('MongoDB successfully connected.');
  } catch (err) {
    isDbConnected = false;
    console.warn('MongoDB connection failed. Session running in-memory fallback. Error:', err.message);
  }
};

mongoose.connection.on('connected', () => { isDbConnected = true; });
mongoose.connection.on('disconnected', () => { isDbConnected = false; });
mongoose.connection.on('error', () => { isDbConnected = false; });

export const getDbStatus = () => isDbConnected;
