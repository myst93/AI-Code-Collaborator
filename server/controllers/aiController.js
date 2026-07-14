import { getAIClient } from '../config/ai.js';

export const chatWithAI = async (req, res) => {
  const { prompt, code, compilerOutput, history } = req.body;
  const ai = getAIClient();

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
      ...(history || []).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return res.json({ response: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: 'Gemini AI Agent failed to generate response.',
      details: error.message,
    });
  }
};
