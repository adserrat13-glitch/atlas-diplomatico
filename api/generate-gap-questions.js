const Groq = require('groq-sdk');

const PROMPT_GAP = `Você é um examinador experiente do CACD (Concurso de Admissão à Carreira Diplomática) especializado em Economia.

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

const PROMPT_REVIEW = `Você é um examinador do CACD especializado em criar questões de múltipla escolha para revisão de lacunas de conhecimento.

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

const PROMPT_SUMMARY = `Você é um professor especialista em preparação para o CACD.

Sua missão NÃO é ensinar profundamente o conteúdo. Sua missão é apenas ativar a memória do estudante antes da avaliação, no formato de um mapa mental rápido.

Nada de introdução, contextualização ou frases de transição. Vá direto aos tópicos.

Formato obrigatório: lista de bullet points curtos (cada um com no máximo 1 linha, estilo telegráfico, sem frases completas de efeito). Use estas categorias como cabeçalhos de grupo, apenas as que fizerem sentido para o tópico:
- Conceito central
- Contexto histórico
- Autores/teorias/instituições
- Testado em prova
- Relaciona com
- Erro comum

Cada bullet deve ser uma informação factual isolada (termo — definição curta, ou nome — contribuição), não um parágrafo.

Regra crítica: todo termo ou distinção citado em "Erro comum" precisa ter sido DEFINIDO antes, em "Conceito central" (ou outro grupo). Nunca aponte uma confusão (ex.: "Confusão entre X e Y") sem antes ter um bullet que defina X e outro que defina Y. Se o tópico tem uma estrutura ou classificação central (ex.: uma divisão tripartite, uma tipologia), liste os elementos dessa estrutura em "Conceito central" antes de qualquer bullet que a mencione de passagem.

Máximo 15 bullets no total. Sem exemplos longos. Sem repetir a mesma ideia em bullets diferentes.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "grupos": [
    {
      "categoria": "<uma das categorias acima>",
      "bullets": ["<bullet curto 1>", "<bullet curto 2>"]
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

  const { topico, mode, lacunas } = req.body || {};
  if (!topico || typeof topico !== 'string') {
    return res.status(400).json({ error: 'topico é obrigatório' });
  }

  if (mode === 'summary') {
    try {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT_SUMMARY },
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

      if (!Array.isArray(parsed.grupos) || parsed.grupos.length === 0) {
        return res.status(502).json({ error: 'Modelo não retornou um resumo válido' });
      }
      const grupos = parsed.grupos
        .map(g => ({
          categoria: String(g.categoria || '').trim(),
          bullets: Array.isArray(g.bullets) ? g.bullets.map(String).filter(Boolean) : [],
        }))
        .filter(g => g.categoria && g.bullets.length > 0);

      if (grupos.length === 0) return res.status(502).json({ error: 'Modelo não retornou um resumo válido' });

      return res.status(200).json({ grupos });
    } catch (err) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
    }
  }

  const isReview = mode === 'review';

  const lacunasText = isReview && Array.isArray(lacunas) && lacunas.length > 0
    ? `\n\nLacunas identificadas no candidato (priorize estes conceitos):\n${lacunas.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
    : '';

  const userMsg = isReview
    ? `Tópico: ${topico.trim()}${lacunasText}\n\nGere exatamente 20 questões de múltipla escolha.`
    : `Tópico do edital CACD: ${topico.trim()}`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: isReview ? PROMPT_REVIEW : PROMPT_GAP },
        { role: 'user', content: userMsg },
      ],
      temperature: isReview ? 0.6 : 0.7,
      max_tokens: isReview ? 6000 : 2048,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return res.status(502).json({ error: 'Resposta do modelo não é JSON válido' });
    }

    if (isReview) {
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
    } else {
      if (!Array.isArray(parsed.perguntas) || parsed.perguntas.length === 0) {
        return res.status(502).json({ error: 'Modelo não retornou perguntas válidas' });
      }
      parsed.perguntas = parsed.perguntas.slice(0, 5).map((p, i) => ({
        id: i + 1,
        pergunta: String(p.pergunta || ''),
        conceito_alvo: String(p.conceito_alvo || ''),
        dica_examinador: String(p.dica_examinador || ''),
      }));
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
