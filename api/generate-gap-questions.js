const { geminiJSON } = require('./_lib/gemini');

const SYSTEM_PROMPT = `Você é um examinador experiente do CACD (Concurso de Admissão à Carreira Diplomática) especializado em Economia.

Sua tarefa é criar 5 perguntas que REVELEM LACUNAS DE CONHECIMENTO em candidatos que ACHAM que dominam o tópico fornecido, mas na verdade têm gaps conceituais.

Princípios para as perguntas:
- Evite perguntas de memorização pura (datas, nomes, fórmulas óbvias)
- Foque em: distinções sutis entre conceitos, aplicação a casos concretos, relações causais não-óbvias, erros conceituais comuns, pegadinhas do edital CACD
- Cada pergunta deve ter UM conceito-alvo claro que o candidato precisa dominar para responder corretamente
- Nível: 2ª Fase CACD (resposta dissertativa curta, 3-5 linhas)

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "topico": "<nome do tópico>",
  "perguntas": [
    {
      "id": 1,
      "pergunta": "<texto da pergunta>",
      "conceito_alvo": "<conceito específico que esta pergunta testa>",
      "dica_examinador": "<o que separa quem domina de quem não domina nesta pergunta>"
    }
  ]
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' });

  const { topico } = req.body || {};
  if (!topico || typeof topico !== 'string') {
    return res.status(400).json({ error: 'topico é obrigatório' });
  }

  try {
    const parsed = await geminiJSON({ systemPrompt: SYSTEM_PROMPT, userPrompt: `Tópico do edital CACD: ${topico.trim()}`, temperature: 0.7, maxTokens: 2048 });

    if (!Array.isArray(parsed.perguntas) || parsed.perguntas.length === 0) {
      return res.status(502).json({ error: 'Modelo não retornou perguntas válidas' });
    }

    parsed.perguntas = parsed.perguntas.slice(0, 5).map((p, i) => ({
      id: i + 1,
      pergunta: String(p.pergunta || ''),
      conceito_alvo: String(p.conceito_alvo || ''),
      dica_examinador: String(p.dica_examinador || ''),
    }));

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
