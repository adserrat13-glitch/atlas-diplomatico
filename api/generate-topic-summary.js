const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é um professor especialista em preparação para o CACD.

Sua missão NÃO é ensinar profundamente o conteúdo. Sua missão é apenas ativar a memória do estudante antes da avaliação.

Produza um resumo extremamente objetivo do tópico do edital fornecido.

O resumo deve servir apenas para relembrar os conceitos principais, sem responder antecipadamente a perguntas de avaliação.

Em no máximo 250 palavras explique:
- conceito central do tema;
- contexto histórico (quando aplicável);
- principais autores, instituições ou teorias;
- conceitos que costumam aparecer em provas do CACD;
- relações com outros assuntos importantes;
- erros comuns cometidos pelos candidatos.

Não escreva exemplos longos.
Não faça listas extensas.
Não aprofunde discussões.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "resumo": "<texto do resumo, máximo 250 palavras>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { topico } = req.body || {};
  if (!topico || typeof topico !== 'string') {
    return res.status(400).json({ error: 'topico é obrigatório' });
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Tópico do edital CACD: ${topico.trim()}` },
      ],
      temperature: 0.5,
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return res.status(502).json({ error: 'Resposta do modelo não é JSON válido' });
    }

    const resumo = String(parsed.resumo || '').trim();
    if (!resumo) return res.status(502).json({ error: 'Modelo não retornou um resumo válido' });

    return res.status(200).json({ resumo });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
