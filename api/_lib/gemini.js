const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-2.0-flash';

/**
 * Chama o Gemini e retorna o conteúdo já parseado como objeto JS.
 * Substitui o padrão Groq: groq.chat.completions.create({ response_format: json_object })
 *
 * @param {{ systemPrompt: string, userPrompt: string, temperature?: number, maxTokens?: number }} opts
 * @returns {Promise<object>}
 */
async function geminiJSON({ systemPrompt, userPrompt, temperature = 0.85, maxTokens = 2048 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return JSON.parse(text);
}

module.exports = { geminiJSON };
