/**
 * api/lp.js — Roteador único para o módulo de Língua Portuguesa CACD
 *
 * Endpoints (via query param ?action=):
 *   POST  ?action=topics-upload
 *   POST  ?action=questions-generate
 *   POST  ?action=answers-submit
 *   GET   ?action=performance
 *   GET   ?action=weak-topics
 *   POST  ?action=simulados-generate
 *   POST  ?action=questions-targeted
 */

const { createClient }     = require('@supabase/supabase-js');
const { getSupabase }      = require('./lp/_lib/supabase-client');
const { generateQuestion } = require('./lp/_lib/groq-generator');
const { validateQuestion, prepareRecord } = require('./lp/_lib/validator');
const { distributeQuestions, NORMALIZED_TOPICS } = require('./lp/_lib/topic-weights');
const Groq = require('groq-sdk');

const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_Q       = 30;
const MAX_RETRIES = 2;
const WEAK_THR    = 65;
const MIN_ANS     = 2;

const PARSE_PROMPT = `Você recebeu o conteúdo de um arquivo de tópicos de Língua Portuguesa para concursos.
Extraia TODOS os tópicos e subtópicos encontrados.
Para cada item, estime um peso de incidência entre 0.01 e 0.20 com base na relevância para provas CESPE/CEBRASPE.
Agrupe por área principal (ex: Morfossintaxe, Semântica, Morfologia, Ortografia, Interpretação de Texto, Literatura).
Responda APENAS em JSON válido, sem markdown:
{"topics":[{"name":"...","subtopic":"...","area":"...","weight":0.05}]}`;

// ─── Autenticação via JWT ─────────────────────────────────────────────────────
async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { error: 'Token de autenticação ausente' };

  // Verifica o JWT com o Supabase usando a anon key (respeita RLS)
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: 'Token inválido ou expirado' };
  return { user_id: user.id };
}

// ─── Handler principal ────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action || req.body?.action;
  if (!action) return res.status(400).json({ error: 'Parâmetro ?action= obrigatório' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });

  // Autenticar e derivar user_id do JWT — nunca do body
  const auth = await authenticate(req);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const { user_id } = auth;

  try {
    switch (action) {
      case 'topics-upload':      return await topicsUpload(req, res, apiKey, user_id);
      case 'questions-generate': return await questionsGenerate(req, res, apiKey, user_id);
      case 'answers-submit':     return await answersSubmit(req, res, user_id);
      case 'performance':        return await performance(req, res, user_id);
      case 'weak-topics':        return await weakTopics(req, res, user_id);
      case 'simulados-generate': return await simuladosGenerate(req, res, apiKey, user_id);
      case 'questions-targeted': return await questionsTargeted(req, res, apiKey, user_id);
      default: return res.status(400).json({ error: `action desconhecida: ${action}` });
    }
  } catch (err) {
    console.error('[lp]', action, err);
    return res.status(500).json({ error: err?.message || 'Erro interno' });
  }
};

// ─── topics-upload ────────────────────────────────────────────────────────────
async function topicsUpload(req, res, apiKey, user_id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST esperado' });
  const { content, filename, use_defaults } = req.body || {};

  const supabase = getSupabase();
  await supabase.from('lp_topics').delete().eq('user_id', user_id);

  let topicsToInsert;

  if (use_defaults || !content) {
    topicsToInsert = NORMALIZED_TOPICS.map(t => ({
      user_id, name: t.name, subtopic: t.subtopic,
      area: t.area, weight: t.weight, source_file: 'default_cacd_index',
    }));
  } else {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PARSE_PROMPT },
        { role: 'user',   content: String(content).slice(0, 15000) },
      ],
      temperature: 0.2, max_tokens: 4096,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Resposta vazia do modelo' });
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return res.status(502).json({ error: 'JSON inválido do modelo' }); }

    const extracted = Array.isArray(parsed.topics) ? parsed.topics : [];
    if (!extracted.length) return res.status(400).json({ error: 'Nenhum tópico encontrado' });

    const totalW = extracted.reduce((s, t) => s + (Number(t.weight) || 0.05), 0);
    topicsToInsert = extracted.map(t => ({
      user_id,
      name:        String(t.name || '').trim().slice(0, 200),
      subtopic:    String(t.subtopic || '').trim().slice(0, 300) || null,
      area:        String(t.area || 'Geral').trim().slice(0, 100),
      weight:      parseFloat(((Number(t.weight) || 0.05) / totalW).toFixed(6)),
      source_file: filename || 'upload',
    })).filter(t => t.name.length > 0);
  }

  const { data, error } = await supabase.from('lp_topics').insert(topicsToInsert).select('id,name,subtopic,area,weight');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, count: data.length, topics: data });
}

// ─── questions-generate ───────────────────────────────────────────────────────
async function questionsGenerate(req, res, apiKey, user_id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST esperado' });
  const { count = 10, difficulty = 'cacd', trap_percentage = 20, topic_filter = [] } = req.body || {};

  const safeCount = Math.min(MAX_Q, Math.max(1, Number(count) || 10));
  const safeDiff  = ['easy','medium','hard','cacd'].includes(difficulty) ? difficulty : 'cacd';
  const trapCount = Math.round(safeCount * Math.min(100, Number(trap_percentage) || 20) / 100);

  const supabase = getSupabase();
  const { data: userTopics } = await supabase.from('lp_topics').select('name,subtopic,area,weight').eq('user_id', user_id);
  const { data: hashes }     = await supabase.from('lp_questions').select('content_hash').eq('user_id', user_id).order('created_at',{ascending:false}).limit(500);

  const hashSet    = new Set((hashes || []).map(r => r.content_hash));
  const dist       = distributeQuestions(safeCount, topic_filter, userTopics?.length ? userTopics : null);
  if (!dist.length) return res.status(400).json({ error: 'Nenhum tópico disponível' });

  const queue = buildQueue(dist, safeCount, trapCount);
  const { questions, errors } = await runGeneration(queue, safeDiff, user_id, hashSet, supabase, apiKey);

  return res.status(200).json({ success: true, generated: questions.length, requested: safeCount, failed: errors.length, questions, generation_errors: errors.length ? errors : undefined });
}

// ─── answers-submit ───────────────────────────────────────────────────────────
async function answersSubmit(req, res, user_id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST esperado' });
  const { question_id, user_answer, simulado_id } = req.body || {};
  if (!question_id) return res.status(400).json({ error: 'question_id obrigatório' });
  if (typeof user_answer !== 'boolean') return res.status(400).json({ error: 'user_answer deve ser boolean' });

  const supabase = getSupabase();
  const { data: q, error: qErr } = await supabase.from('lp_questions')
    .select('id,answer,explanation,grammar_justification,topic_name,subtopic,difficulty')
    .eq('id', question_id).single();
  if (qErr || !q) return res.status(404).json({ error: 'Questão não encontrada' });

  const is_correct = user_answer === q.answer;
  const { error: insErr } = await supabase.from('lp_answers').insert({ user_id, question_id, simulado_id: simulado_id || null, user_answer, is_correct });
  if (insErr) return res.status(500).json({ error: insErr.message });

  return res.status(200).json({
    is_correct, correct_answer: q.answer,
    correct_answer_label: q.answer ? 'CERTO' : 'ERRADO',
    explanation: q.explanation, grammar_justification: q.grammar_justification,
    topic: q.topic_name, subtopic: q.subtopic, difficulty: q.difficulty,
  });
}

// ─── performance ─────────────────────────────────────────────────────────────
async function performance(req, res, user_id) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET esperado' });
  const { period = '30' } = req.query;

  const days  = Math.min(365, Math.max(1, Number(period) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = getSupabase();

  const { data: answers, error } = await supabase.from('lp_answers')
    .select('id,is_correct,answered_at,user_answer,lp_questions(topic_name,subtopic,area,difficulty,recurrence_degree)')
    .eq('user_id', user_id).gte('answered_at', since).order('answered_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  if (!answers?.length) return res.status(200).json({ total: 0, correct: 0, accuracy: 0, proficiency_index: 0, cacd_readiness: 0, by_topic: [], by_area: [], by_difficulty: [], evolution: [], message: 'Sem respostas no período' });

  const total   = answers.length;
  const correct = answers.filter(a => a.is_correct).length;
  const accuracy = pct(correct, total);

  // Por tópico
  const topicMap = {};
  for (const a of answers) {
    const q = a.lp_questions; if (!q) continue;
    const k = q.topic_name;
    if (!topicMap[k]) topicMap[k] = { topic: k, area: q.area, total: 0, correct: 0 };
    topicMap[k].total++; if (a.is_correct) topicMap[k].correct++;
  }
  const by_topic = Object.values(topicMap).map(t => ({ ...t, accuracy: pct(t.correct, t.total) })).sort((a,b) => a.accuracy - b.accuracy);

  // Por área
  const areaMap = {};
  for (const t of by_topic) {
    if (!areaMap[t.area]) areaMap[t.area] = { area: t.area, total: 0, correct: 0 };
    areaMap[t.area].total += t.total; areaMap[t.area].correct += t.correct;
  }
  const by_area = Object.values(areaMap).map(a => ({ ...a, accuracy: pct(a.correct, a.total) }));

  // Por dificuldade
  const diffMap = {};
  for (const a of answers) {
    const d = a.lp_questions?.difficulty || 'unknown';
    if (!diffMap[d]) diffMap[d] = { difficulty: d, total: 0, correct: 0 };
    diffMap[d].total++; if (a.is_correct) diffMap[d].correct++;
  }
  const by_difficulty = Object.values(diffMap).map(d => ({ ...d, accuracy: pct(d.correct, d.total) }));

  // Evolução diária
  const dayMap = {};
  for (const a of answers) {
    const day = a.answered_at.slice(0,10);
    if (!dayMap[day]) dayMap[day] = { date: day, total: 0, correct: 0 };
    dayMap[day].total++; if (a.is_correct) dayMap[day].correct++;
  }
  const evolution = Object.values(dayMap).map(d => ({ ...d, accuracy: pct(d.correct, d.total) }));

  // Proficiência ponderada
  const dw = { easy:1, medium:2, hard:3, cacd:4 };
  let ws = 0, wt = 0;
  for (const a of answers) { const w = dw[a.lp_questions?.difficulty] || 2; wt += w; if (a.is_correct) ws += w; }
  const proficiency_index = wt > 0 ? pct(ws, wt) : 0;

  // Prontidão CACD
  const cacdA = answers.filter(a => a.lp_questions?.difficulty === 'cacd');
  const cacdAcc = cacdA.length > 0 ? cacdA.filter(a => a.is_correct).length / cacdA.length : accuracy / 100;
  const cacd_readiness = parseFloat(((cacdAcc * 0.7 + Math.min(1, total / 200) * 0.3) * 100).toFixed(1));

  return res.status(200).json({ period_days: days, total, correct, accuracy, proficiency_index, cacd_readiness, by_topic, by_area, by_difficulty, evolution });
}

// ─── weak-topics ──────────────────────────────────────────────────────────────
async function weakTopics(req, res, user_id) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET esperado' });
  const { limit = '5' } = req.query;

  const supabase = getSupabase();
  const { data: answers, error } = await supabase.from('lp_answers')
    .select('is_correct,lp_questions(topic_name,subtopic,area,recurrence_degree)')
    .eq('user_id', user_id);
  if (error) return res.status(500).json({ error: error.message });
  if (!answers?.length) return res.status(200).json({ weak_topics: [], message: 'Sem histórico' });

  const topicMap = {};
  for (const a of answers) {
    const q = a.lp_questions; if (!q) continue;
    const k = q.topic_name;
    if (!topicMap[k]) topicMap[k] = { name: k, subtopic: q.subtopic, area: q.area, recurrence_degree: q.recurrence_degree || 3, total: 0, correct: 0 };
    topicMap[k].total++; if (a.is_correct) topicMap[k].correct++;
  }

  const maxResults = Math.min(20, Math.max(1, Number(limit) || 5));
  const weak = Object.values(topicMap)
    .filter(t => t.total >= MIN_ANS && (t.correct / t.total) * 100 < WEAK_THR)
    .map(t => ({ ...t, accuracy: pct(t.correct, t.total), impact: parseFloat(((1 - t.correct / t.total) * t.recurrence_degree).toFixed(3)) }))
    .sort((a,b) => b.impact - a.impact)
    .slice(0, maxResults)
    .map(t => ({ ...t, suggestion: t.accuracy < 30 ? `Prioridade crítica: revise os fundamentos de "${t.name}".` : t.accuracy < 50 ? `Estude as regras de "${t.name}" — taxa muito baixa para o CACD.` : `Reforce "${t.name}" com questões de nível CACD.` }));

  return res.status(200).json({ weak_topics: weak, threshold: WEAK_THR, min_answers: MIN_ANS });
}

// ─── simulados-generate ───────────────────────────────────────────────────────
async function simuladosGenerate(req, res, apiKey, user_id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST esperado' });
  const { count = 10, difficulty = 'cacd', title, trap_percentage = 25 } = req.body || {};

  const safeCount = Math.min(MAX_Q, Math.max(1, Number(count) || 10));
  const safeDiff  = ['easy','medium','hard','cacd'].includes(difficulty) ? difficulty : 'cacd';
  const trapCount = Math.round(safeCount * Math.min(100, Number(trap_percentage) || 25) / 100);
  const simTitle  = title || `Simulado CACD — ${new Date().toLocaleDateString('pt-BR')}`;

  const supabase = getSupabase();
  const { data: userTopics } = await supabase.from('lp_topics').select('name,subtopic,area,weight').eq('user_id', user_id);
  const { data: hashes }     = await supabase.from('lp_questions').select('content_hash').eq('user_id', user_id).order('created_at',{ascending:false}).limit(500);

  const hashSet = new Set((hashes || []).map(r => r.content_hash));
  const dist    = distributeQuestions(safeCount, [], userTopics?.length ? userTopics : null);
  const queue   = buildQueue(dist, safeCount, trapCount);
  const { questions } = await runGeneration(queue, safeDiff, user_id, hashSet, supabase, apiKey);

  if (!questions.length) return res.status(500).json({ error: 'Não foi possível gerar questões suficientes' });

  const { data: simulado, error: simErr } = await supabase.from('lp_simulados')
    .insert({ user_id, title: simTitle, question_ids: questions.map(q => q.id), config: { count: safeCount, difficulty: safeDiff, trap_percentage } })
    .select().single();
  if (simErr) return res.status(500).json({ error: simErr.message });

  return res.status(200).json({ success: true, simulado_id: simulado.id, title: simTitle, generated: questions.length, questions });
}

// ─── questions-targeted ───────────────────────────────────────────────────────
async function questionsTargeted(req, res, apiKey, user_id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST esperado' });
  const { count = 5, difficulty = 'hard' } = req.body || {};

  const safeCount = Math.min(20, Math.max(1, Number(count) || 5));
  const safeDiff  = ['easy','medium','hard','cacd'].includes(difficulty) ? difficulty : 'hard';

  const supabase = getSupabase();
  const { data: answers } = await supabase.from('lp_answers')
    .select('is_correct,lp_questions(topic_name,subtopic,area,recurrence_degree)').eq('user_id', user_id);

  const topicMap = {};
  for (const a of (answers || [])) {
    const q = a.lp_questions; if (!q) continue;
    const k = q.topic_name;
    if (!topicMap[k]) topicMap[k] = { name: k, subtopic: q.subtopic, area: q.area, recurrence_degree: q.recurrence_degree || 3, total: 0, correct: 0 };
    topicMap[k].total++; if (a.is_correct) topicMap[k].correct++;
  }

  let weakTopics = Object.values(topicMap)
    .filter(t => t.total >= MIN_ANS && (t.correct / t.total) * 100 < WEAK_THR)
    .sort((a,b) => (a.correct/a.total) - (b.correct/b.total))
    .slice(0, 5);

  if (!weakTopics.length) weakTopics = NORMALIZED_TOPICS.slice(0, 5).map(t => ({ name: t.name, subtopic: t.subtopic, area: t.area }));

  const perTopic = Math.ceil(safeCount / weakTopics.length);
  const queue = [];
  for (const t of weakTopics) for (let i = 0; i < perTopic && queue.length < safeCount; i++) queue.push({ ...t, isTrap: false });

  const { data: hashes } = await supabase.from('lp_questions').select('content_hash').eq('user_id', user_id).limit(500);
  const hashSet = new Set((hashes || []).map(r => r.content_hash));
  const { questions } = await runGeneration(queue, safeDiff, user_id, hashSet, supabase, apiKey);

  return res.status(200).json({ success: true, generated: questions.length, weak_topics: weakTopics.map(t => t.name), questions });
}

// ─── Helpers compartilhados ───────────────────────────────────────────────────
function buildQueue(dist, total, trapCount) {
  const queue = []; let trapRemaining = trapCount;
  for (const slot of dist) {
    for (let i = 0; i < slot.assigned; i++) {
      const isTrap = trapRemaining > 0; if (isTrap) trapRemaining--;
      queue.push({ ...slot, isTrap });
    }
  }
  return queue;
}

async function runGeneration(queue, difficulty, userId, hashSet, supabase, apiKey) {
  const questions = [], errors = [];
  for (const slot of queue) {
    let ok = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await generateQuestion({ topicName: slot.name, subtopic: slot.subtopic, area: slot.area, difficulty, isTrap: slot.isTrap, apiKey });
        const { valid, errors: ve } = validateQuestion(raw, slot.name);
        if (!valid) { if (attempt === MAX_RETRIES) errors.push({ topic: slot.name, errors: ve }); continue; }

        const record = prepareRecord(raw, { topicName: slot.name, subtopic: slot.subtopic, area: slot.area, difficulty, userId });
        if (hashSet.has(record.content_hash)) { if (attempt === MAX_RETRIES) errors.push({ topic: slot.name, errors: ['Duplicata'] }); continue; }
        hashSet.add(record.content_hash);

        const { data: inserted, error: dbErr } = await supabase.from('lp_questions').insert(record).select().single();
        if (dbErr?.code === '23505') { if (attempt === MAX_RETRIES) errors.push({ topic: slot.name, errors: ['Hash duplicado'] }); continue; }
        if (dbErr) throw new Error(dbErr.message);

        questions.push(inserted); ok = true; break;
      } catch (err) { if (attempt === MAX_RETRIES) errors.push({ topic: slot.name, errors: [err.message] }); }
    }
    if (!ok && !errors.find(e => e.topic === slot.name)) errors.push({ topic: slot.name, errors: ['Falha'] });
  }
  return { questions, errors };
}

function pct(a, b) { return b > 0 ? parseFloat(((a / b) * 100).toFixed(1)) : 0; }
