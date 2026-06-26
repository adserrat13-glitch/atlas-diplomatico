const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `Você é um examinador do CACD especializado em criar questões de múltipla escolha para revisão de lacunas de conhecimento.

Sua tarefa é criar EXATAMENTE 20 questões de múltipla escolha no estilo CACD, priorizando os conceitos onde o candidato demonstrou gaps, mas cobrindo o tópico geral.

Regras obrigatórias:
- Cada questão tem 5 alternativas (A, B, C, D, E)
- Apenas UMA alternativa é correta
- As alternativas incorretas devem ser plausíveis (não óbvias)
- A explicação deve clarificar por que a alternativa correta está certa E por que as outras estão erradas no ponto principal
- Nível: 1ª e 2ª Fase CACD
- Priorize os conceitos das lacunas fornecidas nas primeiras questões

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "questoes": [
    {
      "id": 1,
      "enunciado": "<texto da questão>",
      "alternativas": {
        "A": "<alternativa A>",
        "B": "<alternativa B>",
        "C": "<alternativa C>",
        "D": "<alternativa D>",
        "E": "<alternativa E>"
      },
      "correta": "C",
      "explicacao": "<por que C está correta e o conceito-chave>"
    }
  ]
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  const { topico, lacunas } = req.body || {};
  if (!topico || typeof topico !== 'string') {
    return res.status(400).json({ error: 'topico é obrigatório' });
  }

  const lacunasText = Array.isArray(lacunas) && lacunas.length > 0
    ? `\n\nLacunas identificadas no candidato (priorize estes conceitos):\n${lacunas.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
    : '';

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Tópico: ${topico.trim()}${lacunasText}\n\nGere exatamente 20 questões de múltipla escolha.` },
      ],
      temperature: 0.6,
      max_tokens: 6000,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return res.status(502).json({ error: 'Resposta do modelo não é JSON válido' });
    }

    if (!Array.isArray(parsed.questoes) || parsed.questoes.length === 0) {
      return res.status(502).json({ error: 'Modelo não retornou questões válidas' });
    }

    const LETRAS = ['A', 'B', 'C', 'D', 'E'];
    parsed.questoes = parsed.questoes.slice(0, 20).map((q, i) => ({
      id: i + 1,
      enunciado: String(q.enunciado || ''),
      alternativas: {
        A: String(q.alternativas?.A || ''),
        B: String(q.alternativas?.B || ''),
        C: String(q.alternativas?.C || ''),
        D: String(q.alternativas?.D || ''),
        E: String(q.alternativas?.E || ''),
      },
      correta: LETRAS.includes(String(q.correta).toUpperCase()) ? String(q.correta).toUpperCase() : 'A',
      explicacao: String(q.explicacao || ''),
    }));

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
