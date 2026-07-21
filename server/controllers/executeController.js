import { executeCodeSync } from '../services/executeService.js';

export const executeCode = async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required.' });
  }

  try {
    const runResult = await executeCodeSync({ language, code, stdin });
    return res.json(runResult);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
