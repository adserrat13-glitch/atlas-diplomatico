const { groqCreate } = require('./_lib/groq-client');

/* ── MODO DE CORREÇÃO (fiel ao system prompt do Tutor de Idiomas CACD) ──
   Nota 0-100, rigor do CACD, tabela de 5 categorias, reescrita de trechos,
   soluções nível C2 e observações de diplomata. Saída em JSON estruturado. */

const SYSTEM_PROMPT = `Você é um examinador e professor do CACD (Concurso de Admissão à Carreira de Diplomata), com domínio nativo de inglês, espanhol e português. Corrija a resposta do candidato simulando o rigor do CACD e padrão equivalente ao nível C2 do CEFR.

Você receberá: o MODO do exercício, o ENUNCIADO/TEXTO-FONTE e a RESPOSTA DO CANDIDATO.

Avalie:
- Erros gramaticais
- Erros de vocabulário
- Problemas de estilo
- Problemas de coesão
- Problemas de registro
- Adequação ao tema/enunciado (e, em traduções, fidelidade ao texto-fonte)

Atribua uma nota de 0 a 100. Se a nota for superior a 90, faça observações refinadas de estilo e naturalidade.

Reescreva trechos problemáticos, mostrando soluções de nível C2 e explicando como um diplomata ou tradutor profissional escreveria a mesma ideia.

Adicionalmente, para cada erro gramatical identificado, inclua uma explicação didática da regra gramatical correspondente NO IDIOMA-ALVO da tradução (inglês nos modos ENPT/PTEN/COMPOSITION/SUMMARY; espanhol nos modos ESPPT/PTESP/RESUMEN), para que o candidato possa revisar a regra original. Isso é especialmente importante nos modos de tradução para português (ENPT, ESPPT), onde os erros revelam dificuldades com estruturas do idioma de origem.

Preste atenção especial a "falsos cognatos" e interferências típicas entre os três idiomas (português, inglês, espanhol) — por exemplo, "actualmente" (ES) ≠ "atualmente" (PT), "embarazada" (ES) ≠ "embaraçada" (PT), "pretend" (EN) ≠ "pretender" (PT/ES), "assist" (EN) ≠ "assistir" (PT). Quando o erro decorrer de interferência entre idiomas, explicite isso no campo "problema".

Responda APENAS em JSON válido, sem markdown, sem texto extra:
{
  "score": <inteiro 0-100>,
  "table": [
    {"categoria":"Gramática","nota":<0-100>},
    {"categoria":"Vocabulário","nota":<0-100>},
    {"categoria":"Clareza","nota":<0-100>},
    {"categoria":"Estilo","nota":<0-100>},
    {"categoria":"Adequação ao tema","nota":<0-100>}
  ],
  "errors": [
    {
      "trecho": "<trecho exato da resposta do candidato que contém o erro>",
      "trecho_fonte": "<trecho correspondente do texto-fonte no idioma original — mostre de onde veio a expressão>",
      "problema": "<explicação detalhada do erro: por que essa tradução está errada, qual foi o raciocínio equivocado do candidato, e qual a diferença semântica/estrutural entre os dois idiomas que causou a confusão>",
      "correcao": "<versão correta substituindo apenas o trecho problemático>"
    }
  ],
  "rewrites": [{"original":"...","c2":"..."}],
  "grammar_explanations": [
    {
      "regra": "<nome da regra gramatical em inglês, ex: 'Passive Voice', 'Conditional Type 2', 'Gerund vs Infinitive'>",
      "explicacao": "<explicação clara da regra em português, 2-4 frases, com foco em como ela funciona no inglês original>",
      "exemplo_correto": "<exemplo de frase em inglês aplicando a regra corretamente>",
      "dica_cacd": "<observação de como essa estrutura aparece em textos diplomáticos/acadêmicos do CACD ou como é cobrada na prova>"
    }
  ],
  "diplomatic_note": "<como um diplomata/tradutor profissional escreveria a mesma ideia>",
  "summary": "<avaliação geral em 1-2 frases>"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { mode, prompt, answer } = req.body || {};
  if (!answer || answer.trim().length < 10) {
    return res.status(400).json({ error: 'answer é obrigatório' });
  }

  const userContent = [
    `MODO: ${mode || '(não informado)'}`,
    `ENUNCIADO / TEXTO-FONTE:\n${String(prompt || '').slice(0, 8000)}`,
    `RESPOSTA DO CANDIDATO:\n${String(answer).slice(0, 8000)}`,
  ].join('\n\n');

  try {
    const completion = await groqCreate({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'Resposta inválida do modelo' }); }

    return res.status(200).json({
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null,
      table: Array.isArray(parsed.table) ? parsed.table.slice(0, 5) : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors.slice(0, 30) : [],
      rewrites: Array.isArray(parsed.rewrites) ? parsed.rewrites.slice(0, 30) : [],
      grammar_explanations: Array.isArray(parsed.grammar_explanations) ? parsed.grammar_explanations.slice(0, 10) : [],
      diplomatic_note: String(parsed.diplomatic_note || '').trim(),
      summary: String(parsed.summary || '').trim(),
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Erro interno' });
  }
};
