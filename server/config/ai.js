import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let ai = null;

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Gemini AI Client successfully initialized.');
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment. AI features will fail.');
}

export const getAIClient = () => ai;
