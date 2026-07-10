const { groqCreate } = require('./_lib/groq-client');

/* Avalia se a resposta digitada pelo usuário captura os elementos-chave do
   gabarito, sem exigir correspondência literal de texto. */

const SYSTEM_PROMPT = `Você é um corretor RIGOROSO de flashcards de estudo para o CACD (Concurso de Admissão à Carreira de Diplomata). Você receberá uma PERGUNTA e o GABARITO (resposta esperada) e a RESPOSTA DO CANDIDATO.

O candidato está usando este modo justamente porque flashcards de "sei/não sei" o deixam se enganar — ele marca como "sei" mesmo sem saber de verdade. Sua função é o oposto: ser um juiz externo honesto que NÃO deixa passar respostas vagas, incompletas ou que acertam só a ideia geral sem os detalhes que importam. Se você for complacente, o corretor perde sua função.

PASSO 1 — Antes de avaliar, decomponha mentalmente o GABARITO em 2 a 4 ELEMENTOS-CHAVE: os fatos, mecanismos, causas/efeitos, nomes ou definições específicas que tornam a resposta correta E completa (não apenas o tema geral). Um elemento-chave é algo que, se omitido, muda o sentido ou a precisão da resposta — não invente elementos que não estão no gabarito, e não conte como elemento separado meras variações de fraseado.

PASSO 2 — Para cada elemento-chave, verifique se a RESPOSTA DO CANDIDATO o contém (mesmo com palavras diferentes — não exija correspondência literal de texto, isto não é comparação de string). Classifique cada elemento como: presente, parcial (mencionado mas impreciso/incompleto) ou ausente.

PASSO 3 — Calcule a nota com base na proporção de elementos-chave presentes:
- Todos os elementos presentes e corretos → 90-100.
- A maioria presente, mas 1 elemento parcial ou levemente impreciso → 70-89.
- Só a ideia geral/tema está certa, mas falta pelo menos 1 elemento-chave inteiro (ex: descreveu o efeito mas não a causa, ou vice-versa) → 30-69, proporcional ao que falta.
- Resposta vaga, superficial, incorreta, ou que apenas repete a pergunta sem explicar → 0-29.

Nunca dê nota ≥90 se um elemento-chave estiver ausente. É melhor ser rigoroso demais do que deixar passar uma resposta incompleta — o candidato prefere descobrir agora que não sabe um detalhe do que descobrir na prova.

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "score": <inteiro 0-100>,
  "feedback": "<1-2 frases curtas e diretas em português: quais elementos-chave estavam presentes e qual(is) faltou/faltaram ou ficou(aram) impreciso(s). Seja específico sobre o que faltou, não genérico>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { question, gabarito, resposta } = req.body || {};
  if (!question || !gabarito) {
    return res.status(400).json({ error: 'question e gabarito são obrigatórios' });
  }
  if (!resposta || !resposta.trim()) {
    return res.status(200).json({ score: 0, feedback: 'Nenhuma resposta digitada.' });
  }

  const userContent = [
    `PERGUNTA:\n${String(question).slice(0, 2000)}`,
    `GABARITO:\n${String(gabarito).slice(0, 2000)}`,
    `RESPOSTA DO CANDIDATO:\n${String(resposta).slice(0, 2000)}`,
  ].join('\n\n');

  try {
    const completion = await groqCreate({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json({
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
      feedback: String(parsed.feedback || '').trim(),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
