# Modo "Digitar" com Correção por IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new study mode (`digitar.html`) where the user types answers instead of flipping a card, with AI grading (Groq) judging semantic correctness rather than exact string match, and a persisted per-card mastery score in Supabase.

**Architecture:** New static page mirrors `flashcards.html`'s deck-selection UI (manifest.json + SUBJECT_META), adds a two-round type-in-the-answer flow, calls a new serverless grading endpoint (`api/grade-flashcard.js`, same shape as `api/tutor-correct.js`), and persists round-2 scores in a new `digitar_status` Supabase table via two new `DB` methods mirroring the existing `card_status` pattern.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), PapaParse for CSV, Supabase JS SDK, Vercel serverless functions (Node, CommonJS), Groq SDK (`llama-3.3-70b-versatile`).

## Global Constraints

- No build step — plain `<script>` tags, CommonJS in `/api`.
- Follow existing file conventions exactly: theme via `theme.css` + inline `<style>` block, nav via the same markup pattern as other pages, `DB` global object as the only Supabase access point.
- Groq API key comes from existing `GROQ_API_KEY` env var — no new secrets.
- RLS on all new tables: rows scoped to `auth.uid() = user_id`.
- Do not modify `flashcards.html`, `card_status` table, or any existing `DB` methods — purely additive.

---

### Task 1: Supabase migration for `digitar_status`

**Files:**
- Create: `sql/digitar_status.sql`

**Interfaces:**
- Produces: table `digitar_status(user_id, deck_name, question, score, last_review)` with unique constraint `(user_id, deck_name, question)`, consumed by Task 2's `DB` methods.

- [ ] **Step 1: Write the migration SQL**

```sql
-- sql/digitar_status.sql
-- Run manually in Supabase SQL Editor.

create table if not exists digitar_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null,
  question text not null,
  score int not null check (score >= 0 and score <= 100),
  last_review timestamptz not null default now(),
  primary key (user_id, deck_name, question)
);

alter table digitar_status enable row level security;

create policy "digitar_status_own_rows" on digitar_status
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Run it in the Supabase SQL Editor for this project**

No local test harness exists for SQL in this repo (same pattern as `sql/idiomas_sessions.sql`, run manually). After running, verify in the Supabase Table Editor that `digitar_status` exists with RLS enabled and the one policy listed.

- [ ] **Step 3: Commit**

```bash
git add sql/digitar_status.sql
git commit -m "feat: add digitar_status table migration for AI-graded typing mode"
```

---

### Task 2: `DB.getDigitarScoreMap` / `DB.upsertDigitarScore` in `supabase.js`

**Files:**
- Modify: `supabase.js` (insert new section right after the existing `// ── CARD STATUS ─────────────────────────────────────────────────────` block, i.e. after line 294 per current file, before `// ── ACTIVITY ──`)

**Interfaces:**
- Consumes: `DB.getUser()` (supabase.js:37-40), module-level `_sb` Supabase client.
- Produces:
  - `DB.getDigitarScoreMap(deckName: string) -> Promise<{ [question: string]: { score: number, last_review: string } }>`
  - `DB.upsertDigitarScore(deckName: string, question: string, score: number) -> Promise<void>`

  Both consumed by `digitar.html` in Task 4.

- [ ] **Step 1: Read the exact insertion point**

Confirm current line numbers before editing (they may have shifted):

```bash
grep -n "CARD STATUS\|ACTIVITY" "supabase.js"
```

Expected output shows the `// ── CARD STATUS ──` header, then `getCardStatusMap`/`upsertCard`, then `// ── ACTIVITY ──`. Insert the new section between the end of `upsertCard` (the closing `},` after its function body) and the `// ── ACTIVITY ──` comment.

- [ ] **Step 2: Add the new DB methods**

Insert this block immediately after `upsertCard`'s closing `},` and before `// ── ACTIVITY ──`:

```js
  // ── DIGITAR STATUS (AI-graded typing mode) ────────────────────────────

  /** Returns map: { question: {score, last_review} } for a deck */
  async getDigitarScoreMap(deckName) {
    const user = await this.getUser();
    if (!user) return {};
    const { data } = await _sb.from('digitar_status')
      .select('question, score, last_review')
      .eq('user_id', user.id).eq('deck_name', deckName);
    const map = {};
    (data || []).forEach(r => { map[r.question] = { score: r.score, last_review: r.last_review }; });
    return map;
  },

  async upsertDigitarScore(deckName, question, score) {
    const user = await this.getUser();
    if (!user) return;
    await _sb.from('digitar_status').upsert({
      user_id: user.id,
      deck_name: deckName,
      question,
      score,
      last_review: new Date().toISOString()
    }, {
      onConflict: 'user_id,deck_name,question',
      ignoreDuplicates: false
    });
  },

```

- [ ] **Step 3: Manually verify no syntax errors**

```bash
node --check "supabase.js"
```

Expected: no output (exit code 0). This file is browser JS attached to `window.DB` via a trailing `window.DB = DB;` or similar — `node --check` only validates syntax, not runtime behavior, which is sufficient here since there's no test runner in this repo.

- [ ] **Step 4: Commit**

```bash
git add supabase.js
git commit -m "feat: add DB.getDigitarScoreMap and DB.upsertDigitarScore"
```

---

### Task 3: `api/grade-flashcard.js` grading endpoint

**Files:**
- Create: `api/grade-flashcard.js`

**Interfaces:**
- Consumes: `groqCreate` from `./_lib/groq-client.js` (existing, signature `groqCreate(params) -> Promise<ChatCompletion>`, reads `GROQ_API_KEY` from env).
- Produces: HTTP POST endpoint `/api/grade-flashcard` — request body `{ question: string, gabarito: string, resposta: string }`, response `{ score: number (0-100), feedback: string }` or `{ error: string }` with appropriate status code. Consumed by `digitar.html` in Task 4.

- [ ] **Step 1: Write the handler**

```js
// api/grade-flashcard.js
const { groqCreate } = require('./_lib/groq-client');

/* Avalia se a resposta digitada pelo usuário captura a ideia central do
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
```

- [ ] **Step 2: Verify syntax**

```bash
node --check "api/grade-flashcard.js"
```

Expected: no output (exit code 0).

- [ ] **Step 3: Manual smoke test against Groq (requires GROQ_API_KEY set locally)**

If the project has a local dev server (`vercel dev`), start it and run:

```bash
curl -s -X POST http://localhost:3000/api/grade-flashcard \
  -H "Content-Type: application/json" \
  -d '{"question":"O que é PIB?","gabarito":"Valor dos bens e serviços finais.","resposta":"É o valor total de tudo que um país produz."}'
```

Expected: JSON response with `score` >= 80 (captures the single key element — total value of final production) and a short `feedback` string.

Now test the strict-grading case — a gabarito with two key elements where the answer only captures one:

```bash
curl -s -X POST http://localhost:3000/api/grade-flashcard \
  -H "Content-Type: application/json" \
  -d '{"question":"O que é inflação de demanda?","gabarito":"Aumento de gastos que supera a capacidade de produção.","resposta":"É quando os preços sobem muito."}'
```

Expected: JSON response with `score` < 60 — the answer describes the general effect (rising prices) but omits the key causal mechanism (spending exceeding production capacity), and `feedback` should name that specific gap. This confirms the rubric penalizes vague/incomplete answers rather than rewarding "got the general idea." If `vercel dev` isn't available in this environment, defer both checks to Task 4's end-to-end verification, where they're exercised through the UI instead.

- [ ] **Step 4: Commit**

```bash
git add api/grade-flashcard.js
git commit -m "feat: add AI grading endpoint for typing flashcard mode"
```

---

### Task 4: `digitar.html` — deck selector (reused from flashcards.html)

**Files:**
- Create: `digitar.html`

**Interfaces:**
- Consumes: `manifest.json` (`{ flashcards: { [folder: string]: string[] } }`), `DB.requireAuth()`, `DB.getProfile()`, `DB.isAdmin()`, `DB.getExamDate()` (all existing, same as `flashcards.html`'s init block), Papa.parse (CDN, already loaded via `<script>` tag pattern).
- Produces: `allCards: {q: string, a: string}[]`, `deckName: string` module-level state, and a working deck browser that calls `startDigitarSession(deckName, allCards)` (defined in Task 5) once a deck is picked. This task stops at deck selection — Task 5 adds the study flow.

- [ ] **Step 1: Create the file with head, nav, and loader view**

Copy the structural pattern from `flashcards.html` (theme.css, icons.js, PapaParse/Supabase CDN scripts, nav markup) but trim to only what this page needs (loader view + a placeholder study container). Write the full file:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Digitar — Atlas Diplomático</title>
  <link rel="stylesheet" href="theme.css" />
  <script src="icons.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase.js"></script>
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    :root {
      --bg:#0f1115; --card:rgba(255,255,255,0.04); --border:#2a2f3a;
      --text:#e5e7eb; --muted:#9ca3af; --accent:#d4af37;
      --green:#34d399; --red:#f87171;
    }
    body { background:var(--bg); color:var(--text); font-family:Inter,sans-serif; min-height:100vh; }
    .grid-bg { position:fixed; inset:0; pointer-events:none; z-index:0;
      background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
      background-size:40px 40px; }

    nav { position:sticky; top:0; z-index:200; height:52px; background:#000;
      border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center;
      padding:0 16px; gap:2px; overflow-x:auto; scrollbar-width:none; }
    nav::-webkit-scrollbar { display:none; }
    .nav-logo { font-size:13px; font-weight:900; letter-spacing:2.5px; margin-right:14px;
      white-space:nowrap; flex-shrink:0; color:#fff; }
    .nav-logo span{color:#fff;text-decoration:underline}
    nav a { color:#888; text-decoration:none; font-size:11px; font-weight:600;
      padding:5px 9px; border-radius:6px; transition:.15s; white-space:nowrap;
      display:flex; align-items:center; gap:4px; flex-shrink:0; letter-spacing:.3px; }
    nav a:hover { color:#fff; background:rgba(255,255,255,0.06); }
    nav a.active{color:#d4af37;border-bottom:2px solid #d4af37;border-radius:0;padding-bottom:3px}
    .nav-spacer { flex:1; min-width:8px; }
    .nav-cd { font-size:11px; font-weight:700; color:#f5e642; background:rgba(245,230,66,.1);
      border:1px solid rgba(245,230,66,.25); padding:3px 10px; border-radius:20px;
      white-space:nowrap; flex-shrink:0; }
    .nav-user { width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,.1);
      display:flex; align-items:center; justify-content:center; font-size:11px;
      font-weight:700; flex-shrink:0; margin-left:6px; color:#888; }

    main { position:relative; z-index:1; max-width:800px; margin:0 auto; padding:32px 24px; }

    .view { display:none; }
    .view.active { display:flex; flex-direction:column; align-items:center; }

    #viewLoader { gap:24px; }
    .loader-title { font-size:28px; font-weight:700; letter-spacing:1px; }
    .loader-sub { color:var(--muted); font-size:14px; }

    .file-browser { width:100%; max-width:640px; display:flex; flex-direction:column; gap:8px; }
    .fb-loading, .fb-empty { color:var(--muted); font-size:14px; padding:24px; text-align:center; }
    .fb-subject { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
    .fb-subject-header { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; transition:.15s; user-select:none; }
    .fb-subject-header:hover { background:rgba(255,255,255,.04); }
    .fb-subject-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .fb-subject-name { font-size:13px; font-weight:600; color:#e8e8e8; flex:1; }
    .fb-subject-count { font-size:11px; color:var(--muted); background:rgba(255,255,255,.08); padding:2px 8px; border-radius:10px; }
    .fb-chevron { font-size:12px; color:var(--muted); transition:transform .2s; }
    .fb-subject.collapsed .fb-chevron { transform:rotate(-90deg); }
    .fb-subject.collapsed .fb-subject-files { display:none; }
    .fb-subject-files { border-top:1px solid var(--border); }
    .fb-file-row { display:flex; align-items:center; padding:10px 16px 10px 34px; cursor:pointer; transition:.15s; gap:10px; }
    .fb-file-row:hover { background:rgba(255,255,255,.04); }
    .fb-file-name { flex:1; font-size:13px; color:#aaa; }
    .fb-file-row:hover .fb-file-name { color:#e8e8e8; }
    .fb-file-arrow { font-size:12px; color:var(--muted); }
    .fb-file-row:hover .fb-file-arrow { color:var(--accent); }

    .btn {
      padding:12px 28px; border-radius:12px; font-size:14px; font-weight:600;
      cursor:pointer; border:none; transition:0.2s; font-family:inherit;
    }
    .btn-primary { background:var(--accent); color:#0f1117; }
    .btn-primary:hover { opacity:0.85; }
    .btn-secondary { background:rgba(255,255,255,0.07); color:var(--text); border:1px solid var(--border); }
    .btn-secondary:hover { background:rgba(255,255,255,0.12); }
    .btn-small { padding:8px 18px; font-size:13px; }
    .btn:disabled { opacity:0.5; cursor:not-allowed; }

    /* ===== OPTIONS VIEW ===== */
    #viewOptions { gap:16px; text-align:center; width:100%; }
    .opt-title { font-size:22px; font-weight:700; }
    .opt-sub { color:var(--muted); font-size:14px; }
    .opt-stats { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin:8px 0; }
    .opt-stat { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px 22px; min-width:100px; }
    .opt-stat-val { font-size:26px; font-weight:700; }
    .opt-stat-lbl { font-size:11px; color:var(--muted); margin-top:2px; }
    .opt-btns { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }

    /* ===== STUDY VIEW ===== */
    #viewStudy { gap:18px; width:100%; max-width:640px; }
    .study-header { width:100%; display:flex; align-items:center; gap:12px; }
    .study-deck-name { font-size:13px; color:var(--muted); font-weight:500; }
    .study-spacer { flex:1; }
    .study-counter { font-size:13px; color:var(--muted); }
    .study-round { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
    .study-round.r1 { background:rgba(142,167,255,.12); color:#8ea7ff; }
    .study-round.r2 { background:rgba(212,175,55,.15); color:var(--accent); }
    .study-exit { background:none; border:1px solid var(--border); color:var(--muted);
      padding:5px 12px; border-radius:8px; font-size:12px; cursor:pointer; font-family:inherit; }
    .study-exit:hover { color:var(--text); border-color:rgba(255,255,255,0.3); }
    .progress-bar { width:100%; height:5px; background:rgba(255,255,255,0.07); border-radius:20px; overflow:hidden; }
    .progress-fill { height:100%; background:var(--accent); border-radius:20px; transition:width 0.4s ease; }

    .dg-question { background:var(--card); border:1px solid var(--border); border-radius:16px;
      padding:24px; width:100%; font-size:16px; line-height:1.6; }
    .dg-question-label { font-size:11px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px; }
    .dg-gabarito { background:rgba(142,167,255,0.07); border:1px solid rgba(142,167,255,0.2);
      border-radius:16px; padding:20px 24px; width:100%; font-size:15px; line-height:1.6; color:#c5d5ff; }
    .dg-answer-box { width:100%; }
    .dg-textarea { width:100%; min-height:100px; background:rgba(255,255,255,0.04); border:1px solid var(--border);
      border-radius:12px; padding:14px 16px; color:var(--text); font-family:inherit; font-size:14px;
      line-height:1.5; resize:vertical; }
    .dg-textarea:focus { outline:none; border-color:var(--accent); }
    .dg-feedback { width:100%; border-radius:14px; padding:16px 20px; display:flex; flex-direction:column; gap:8px; }
    .dg-feedback.good { background:rgba(110,231,183,0.1); border:1px solid rgba(110,231,183,0.3); }
    .dg-feedback.mid { background:rgba(245,230,66,0.08); border:1px solid rgba(245,230,66,0.25); }
    .dg-feedback.bad { background:rgba(248,113,113,0.1); border:1px solid rgba(248,113,113,0.3); }
    .dg-score { font-size:24px; font-weight:700; }
    .dg-feedback-text { font-size:13px; color:var(--text); line-height:1.5; }

    /* ===== SUMMARY VIEW ===== */
    #viewSummary { gap:24px; text-align:center; width:100%; }
    .summary-icon { font-size:56px; }
    .summary-title { font-size:26px; font-weight:700; }
    .summary-sub { color:var(--muted); font-size:14px; }
    .summary-stats { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }
    .s-stat { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px 24px; min-width:100px; }
    .s-stat-val { font-size:28px; font-weight:700; }
    .s-stat-lbl { font-size:12px; color:var(--muted); margin-top:2px; }
    .s-green { color:var(--green); }
    .s-red { color:var(--red); }
    .summary-btns { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
    .weak-list { width:100%; max-width:600px; text-align:left; }
    .weak-list h3 { font-size:13px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px; }
    .weak-item { background:rgba(248,113,113,0.07); border:1px solid rgba(248,113,113,0.2);
      border-radius:12px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; gap:12px; align-items:center; }
    .weak-item-q { font-size:13px; flex:1; }
    .weak-item-score { font-size:13px; font-weight:700; color:#ef5350; flex-shrink:0; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <nav>
    <div class="nav-logo">ATLAS <span>DIPL.</span></div>
    <a href="index.html">Início</a>
    <a href="flashcards.html">Flashcards</a>
    <a href="digitar.html" class="active">Digitar</a>
    <a href="espiral.html">Espiral</a>
    <a href="analise.html">Análise</a>
    <div class="nav-spacer"></div>
    <div class="nav-cd" id="navCountdown"></div>
    <div class="nav-user" id="navUser">?</div>
  </nav>

  <main>
    <div class="view active" id="viewLoader">
      <div class="loader-title">MODO DIGITAR</div>
      <div class="loader-sub">Escreva a resposta — a IA avalia o conceito, não o texto exato</div>
      <div class="file-browser" id="fileBrowser">
        <div class="fb-loading">Carregando decks...</div>
      </div>
    </div>

    <div class="view" id="viewOptions">
      <div class="opt-title" id="deckTitle"></div>
      <div class="opt-sub" id="deckSub"></div>
      <div class="opt-stats" id="optStats"></div>
      <div class="opt-btns">
        <button class="btn btn-primary" onclick="startDigitarSession('all')">Estudar tudo</button>
        <button class="btn btn-secondary" onclick="startDigitarSession('weak')" id="btnWeak" style="display:none">Revisar &lt;90</button>
        <button class="btn btn-secondary btn-small" onclick="showView('viewLoader')">← Outro deck</button>
      </div>
    </div>

    <div class="view" id="viewStudy">
      <div class="study-header">
        <span class="study-deck-name" id="studyDeckName"></span>
        <span class="study-round r1" id="studyRound">Rodada 1</span>
        <div class="study-spacer"></div>
        <span class="study-counter" id="studyCounter"></span>
        <button class="study-exit" onclick="showView('viewLoader')">✕ Sair</button>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>

      <div class="dg-question">
        <div class="dg-question-label">Pergunta</div>
        <div id="dgQuestionText"></div>
      </div>

      <div class="dg-gabarito" id="dgGabaritoBox" style="display:none">
        <div class="dg-question-label">Gabarito</div>
        <div id="dgGabaritoText"></div>
      </div>

      <div class="dg-answer-box">
        <textarea class="dg-textarea" id="dgAnswerInput" placeholder="Digite sua resposta..."></textarea>
      </div>

      <div class="dg-feedback" id="dgFeedback" style="display:none">
        <div class="dg-score" id="dgScoreText"></div>
        <div class="dg-feedback-text" id="dgFeedbackText"></div>
      </div>

      <div class="opt-btns">
        <button class="btn btn-primary" id="dgSubmitBtn" onclick="submitDigitarAnswer()">Enviar</button>
        <button class="btn btn-secondary" id="dgNextBtn" onclick="nextDigitarStep()" style="display:none">Próximo →</button>
      </div>
    </div>

    <div class="view" id="viewSummary">
      <div class="summary-icon">📊</div>
      <div class="summary-title" id="summaryTitle"></div>
      <div class="summary-sub" id="summarySub"></div>
      <div class="summary-stats" id="summaryStats"></div>
      <div class="summary-btns">
        <button class="btn btn-primary" id="btnReviewWeak" onclick="startDigitarSession('weak')" style="display:none">Revisar &lt;90</button>
        <button class="btn btn-secondary" onclick="showView('viewLoader')">Outro deck</button>
        <a href="index.html" class="btn btn-secondary">← Início</a>
      </div>
      <div class="weak-list" id="weakList" style="display:none"></div>
    </div>
  </main>

  <script>
    const SUBJECT_META = {
      LP:   { name:'Língua Portuguesa',      folder:'PORTUGUÊS' },
      ING:  { name:'Língua Inglesa',          folder:'INGLÊS' },
      HB:   { name:'História do Brasil',      folder:'BRASIL' },
      HM:   { name:'História Mundial',        folder:'HISTORIA' },
      GEO:  { name:'Geografia',              folder:'GEOGRAFIA' },
      PI:   { name:'Política Internacional',  folder:'INTERNACIONAL' },
      ECO:  { name:'Economia',               folder:'ECONOMIA' },
      DIR:  { name:'Direito',                folder:'DIREITO' },
    };
    const FOLDER_COLORS = {
      'BRASIL': '#ffffff', 'DIREITO': '#cccccc', 'ECONOMIA': '#eeeeee',
      'GEOGRAFIA': '#ffffff', 'HISTORIA': '#cccccc', 'INTERNACIONAL': '#dddddd',
      'INGLÊS': '#eeeeee', 'PORTUGUÊS': '#ffffff',
    };

    let allCards = [], deckName = '';

    (async () => {
      const user = await DB.requireAuth();
      const [profile, examDate] = await Promise.all([DB.getProfile(), DB.getExamDate()]);
      const nu = document.getElementById('navUser');
      if (nu) nu.textContent = (profile?.name || user.email || '?').slice(0,2).toUpperCase();
      const nc = document.getElementById('navCountdown');
      if (nc) nc.textContent = Math.ceil((examDate - Date.now()) / 86400000) + 'd';
      loadFileBrowser();
    })();

    function showView(id) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    }

    let _manifest = null;
    async function loadManifest() {
      if (_manifest) return _manifest;
      try {
        const res = await fetch('manifest.json');
        if (!res.ok) throw new Error();
        _manifest = await res.json();
      } catch { _manifest = { flashcards: {} }; }
      return _manifest;
    }

    async function scanFolder(folder) {
      const m = await loadManifest();
      return (m.flashcards[folder] || []);
    }

    async function loadFileBrowser() {
      const browser = document.getElementById('fileBrowser');
      const m = await loadManifest();
      const folders = Object.keys(m.flashcards || {});
      if (!folders.length) {
        browser.innerHTML = '<div class="fb-empty">Nenhum deck encontrado.</div>';
        return;
      }
      const active = folders
        .map(folder => ({ folder, files: m.flashcards[folder] || [] }))
        .filter(s => s.files.length > 0)
        .sort((a, b) => a.folder.localeCompare(b.folder, 'pt-BR'));
      browser.innerHTML = active.map(s => {
        const color = FOLDER_COLORS[s.folder.toUpperCase()] || '#8ea7ff';
        const fullPath = 'FLASHCARDS/' + s.folder;
        const sortedFiles = [...s.files].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return `
        <div class="fb-subject">
          <div class="fb-subject-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <span class="fb-subject-dot" style="background:${color}"></span>
            <span class="fb-subject-name">${s.folder}</span>
            <span class="fb-subject-count">${s.files.length}</span>
            <span class="fb-chevron">▾</span>
          </div>
          <div class="fb-subject-files">
            ${sortedFiles.map(f => `<div class="fb-file-row" onclick="loadDeckFromPath('${encodeURIComponent(fullPath+'/'+f)}','${f.replace(/\.csv$/i,'').replace(/'/g,"\\'")}')">
              <span class="fb-file-name">${f.replace(/\.csv$/i,'')}</span>
              <span class="fb-file-arrow">→</span>
            </div>`).join('')}
          </div>
        </div>`;
      }).join('');
    }

    async function loadDeckFromPath(encodedPath, name) {
      const path = decodeURIComponent(encodedPath);
      try {
        const res = await fetch(encodeURI(path));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = await res.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8',{fatal:true}).decode(buf); }
        catch { text = new TextDecoder('windows-1252').decode(buf); }
        deckName = name;
        const result = Papa.parse(text, { delimiter:';', skipEmptyLines:true });
        allCards = result.data
          .filter(row => row[0]&&row[0].trim()&&row[1]&&row[1].trim())
          .map(row => ({ q:row[0].trim(), a:row[1].trim() }));
        if (allCards.length) await showDigitarOptions();
        else alert('Nenhum card encontrado: ' + name);
      } catch(e) { alert('Erro ao carregar: ' + e.message); }
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification (deck selection only)**

Open `digitar.html` directly in a browser via the project's local server (same server used for `flashcards.html`, e.g. `vercel dev` or a static file server pointed at the repo root). Confirm:
- Redirects to `/login.html` if not authenticated (via `DB.requireAuth()`).
- Once logged in, shows the folder list from `manifest.json` matching what `flashcards.html` shows.
- Clicking a CSV file switches to `viewOptions` — this will currently fail because `showDigitarOptions` isn't defined yet (Task 5). That's expected at this checkpoint; note it and continue to Task 5 before doing a full click-through test.

- [ ] **Step 3: Commit**

```bash
git add digitar.html
git commit -m "feat: add digitar.html deck selector shell"
```

---

### Task 5: Two-round study flow, scoring, and summary in `digitar.html`

**Files:**
- Modify: `digitar.html` (append to the `<script>` block created in Task 4, right before `</script>`)

**Interfaces:**
- Consumes:
  - `DB.getDigitarScoreMap(deckName)` / `DB.upsertDigitarScore(deckName, question, score)` (Task 2)
  - `POST /api/grade-flashcard` → `{score, feedback}` (Task 3)
  - `allCards`, `deckName` (Task 4, module state)
- Produces: `showDigitarOptions()`, `startDigitarSession(mode)`, `submitDigitarAnswer()`, `nextDigitarStep()` — all referenced by `onclick` handlers already wired in Task 4's HTML.

- [ ] **Step 1: Add the session state, options screen, and round-flow logic**

Insert this block right before the closing `</script>` tag in `digitar.html`:

```js
    let scoreMap = {};        // { question: {score, last_review} }
    let queue = [];           // cards for this session
    let qIdx = 0;
    let round = 1;            // 1 = with gabarito, 2 = blind
    let sessionScores = [];   // round-2 scores collected this session, for summary
    let weakCardsThisRun = [];

    async function showDigitarOptions() {
      scoreMap = await DB.getDigitarScoreMap(deckName);
      document.getElementById('deckTitle').textContent = deckName;
      document.getElementById('deckSub').textContent = `${allCards.length} cards`;

      const scored = allCards.filter(c => scoreMap[c.q]);
      const avg = scored.length
        ? Math.round(scored.reduce((s, c) => s + scoreMap[c.q].score, 0) / scored.length)
        : null;
      const weakCount = allCards.filter(c => !scoreMap[c.q] || scoreMap[c.q].score < 90).length;
      const masteredCount = allCards.length - weakCount;

      document.getElementById('optStats').innerHTML = `
        <div class="opt-stat"><div class="opt-stat-val">${avg === null ? '—' : avg + '%'}</div><div class="opt-stat-lbl">média (rodada 2)</div></div>
        <div class="opt-stat"><div class="opt-stat-val">${masteredCount}</div><div class="opt-stat-lbl">≥90 dominados</div></div>
        <div class="opt-stat"><div class="opt-stat-val">${weakCount}</div><div class="opt-stat-lbl">&lt;90 a revisar</div></div>
      `;

      const btnWeak = document.getElementById('btnWeak');
      btnWeak.style.display = weakCount > 0 ? '' : 'none';

      showView('viewOptions');
    }

    function startDigitarSession(mode) {
      if (mode === 'weak') {
        queue = allCards.filter(c => !scoreMap[c.q] || scoreMap[c.q].score < 90);
        if (!queue.length) { alert('Nenhum card abaixo de 90.'); return; }
      } else {
        queue = [...allCards];
      }
      qIdx = 0;
      round = mode === 'weak' ? 2 : 1;
      sessionScores = [];
      weakCardsThisRun = [];
      showView('viewStudy');
      document.getElementById('studyDeckName').textContent = deckName;
      renderDigitarStep();
    }

    function renderDigitarStep() {
      if (qIdx >= queue.length) { showDigitarSummary(); return; }
      const card = queue[qIdx];
      const roundEl = document.getElementById('studyRound');
      roundEl.textContent = round === 1 ? 'Rodada 1' : 'Rodada 2';
      roundEl.className = 'study-round ' + (round === 1 ? 'r1' : 'r2');

      document.getElementById('studyCounter').textContent = `${qIdx + 1} / ${queue.length}`;
      document.getElementById('progressFill').style.width = (qIdx / queue.length * 100) + '%';
      document.getElementById('dgQuestionText').textContent = card.q;

      const gabaritoBox = document.getElementById('dgGabaritoBox');
      if (round === 1) {
        document.getElementById('dgGabaritoText').textContent = card.a;
        gabaritoBox.style.display = '';
      } else {
        gabaritoBox.style.display = 'none';
      }

      document.getElementById('dgAnswerInput').value = '';
      document.getElementById('dgAnswerInput').disabled = false;
      document.getElementById('dgFeedback').style.display = 'none';
      document.getElementById('dgSubmitBtn').style.display = '';
      document.getElementById('dgNextBtn').style.display = 'none';
    }

    async function submitDigitarAnswer() {
      const card = queue[qIdx];
      const resposta = document.getElementById('dgAnswerInput').value.trim();
      const submitBtn = document.getElementById('dgSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Avaliando...';

      let result;
      try {
        const res = await fetch('/api/grade-flashcard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: card.q, gabarito: card.a, resposta }),
        });
        result = await res.json();
        if (result.error) throw new Error(result.error);
      } catch (e) {
        alert('Erro ao avaliar resposta: ' + e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';
        return;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar';

      const score = result.score;
      const feedbackEl = document.getElementById('dgFeedback');
      feedbackEl.className = 'dg-feedback ' + (score >= 90 ? 'good' : score >= 50 ? 'mid' : 'bad');
      feedbackEl.style.display = 'flex';
      document.getElementById('dgScoreText').textContent = score + '/100';
      document.getElementById('dgFeedbackText').textContent = result.feedback || '';

      document.getElementById('dgAnswerInput').disabled = true;
      document.getElementById('dgSubmitBtn').style.display = 'none';
      document.getElementById('dgNextBtn').style.display = '';

      if (round === 2) {
        sessionScores.push(score);
        if (score < 90) weakCardsThisRun.push({ q: card.q, score });
        await DB.upsertDigitarScore(deckName, card.q, score);
      }
    }

    function nextDigitarStep() {
      if (round === 1) {
        round = 2;
      } else {
        round = 1;
        qIdx++;
      }
      renderDigitarStep();
    }

    function showDigitarSummary() {
      showView('viewSummary');
      const avg = sessionScores.length
        ? Math.round(sessionScores.reduce((a,b) => a+b, 0) / sessionScores.length)
        : 0;
      document.getElementById('summaryTitle').textContent = avg >= 90 ? 'Excelente!' : avg >= 70 ? 'Bom progresso' : 'Continue praticando';
      document.getElementById('summarySub').textContent = `${queue.length} cards estudados`;
      document.getElementById('summaryStats').innerHTML = `
        <div class="s-stat"><div class="s-stat-val ${avg >= 90 ? 's-green' : ''}">${avg}%</div><div class="s-stat-lbl">média rodada 2</div></div>
        <div class="s-stat"><div class="s-stat-val s-red">${weakCardsThisRun.length}</div><div class="s-stat-lbl">abaixo de 90</div></div>
      `;
      const btnReviewWeak = document.getElementById('btnReviewWeak');
      const weakListEl = document.getElementById('weakList');
      if (weakCardsThisRun.length) {
        btnReviewWeak.style.display = '';
        weakListEl.style.display = '';
        weakListEl.innerHTML = '<h3>Cards a revisar</h3>' + weakCardsThisRun.map(c =>
          `<div class="weak-item"><div class="weak-item-q">${c.q}</div><div class="weak-item-score">${c.score}/100</div></div>`
        ).join('');
      } else {
        btnReviewWeak.style.display = 'none';
        weakListEl.style.display = 'none';
      }
    }
```

Note: the round-1 submission calls the same `/api/grade-flashcard` endpoint for feedback (consistent grading UX), but only round-2 scores are persisted via `DB.upsertDigitarScore`, matching the spec's "not persisted" rule for round 1.

- [ ] **Step 2: Manual end-to-end verification**

With the local dev server running and `GROQ_API_KEY` set:
1. Open `digitar.html`, log in, pick the Economia deck (`ECONOMIA .csv` per `manifest.json`, or `ECONOMIA PERGUNTAS E RESPOSTAS.csv` if added to the manifest).
2. Confirm `viewOptions` shows stats (avg `—` on first run, weak count = total cards).
3. Click "Estudar tudo". Confirm round 1 shows gabarito, submit gives feedback, "Próximo" advances to round 2 (same question, no gabarito).
4. Submit an answer that's a correct paraphrase (e.g. for "O que é PIB?" type "É a soma de tudo que o país produziu"). Confirm score ≥ 80.
5. Submit an answer that's clearly wrong. Confirm score is low (< 50).
5b. Submit an answer that only captures the general topic but misses a key element of the gabarito (e.g. for a card whose gabarito has a cause + effect, type only the effect). Confirm the score lands in the 30-69 range (not ≥90) and the feedback names the specific missing element — this is the core acceptance check for the feature: the grader must not let "got the general idea" pass as full credit.
6. Complete 3 cards, reach the summary screen, confirm avg % and weak count match what was submitted in round 2.
7. In Supabase Table Editor, confirm `digitar_status` has 3 rows for this user/deck with the round-2 scores.
8. Go back (`viewLoader` → same deck), confirm `viewOptions` now shows the updated avg/weak counts from step 7.
9. If any card scored < 90, click "Revisar <90" and confirm the session only includes those cards, starting directly at round 2 (no gabarito shown, since `startDigitarSession('weak')` sets `round = 2`).

- [ ] **Step 3: Commit**

```bash
git add digitar.html
git commit -m "feat: implement two-round typing study flow with AI grading"
```

---

## Self-Review Notes

- **Spec coverage:** Round 1 (with gabarito, not persisted) ✅ Task 5 Step 1; Round 2 (blind, persisted) ✅ same; new page separate from `flashcards.html` ✅ Task 4; deck selector reused ✅ Task 4; `api/grade-flashcard.js` mirroring `tutor-correct.js` ✅ Task 3; `digitar_status` table + RLS ✅ Task 1; `DB` methods mirroring `card_status` ✅ Task 2; summary with % and weak list ✅ Task 5; "Revisar <90" ✅ Task 5.
- **Placeholder scan:** No TBD/TODO; all code blocks are complete and runnable as written.
- **Type consistency:** `DB.getDigitarScoreMap` returns `{score, last_review}` per question — used consistently in `showDigitarOptions` and `startDigitarSession`. `/api/grade-flashcard` returns `{score, feedback}` — used consistently in `submitDigitarAnswer`. `allCards`/`deckName` set in Task 4, read in Task 5 without redeclaration (same `<script>` block, appended not replaced).
