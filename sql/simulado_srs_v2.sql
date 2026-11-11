-- Repetição espaçada v2: só volta o que ainda não está fixado (ver js/srs.js)
-- status: learning (aprendendo) → review (checagem) → mastered (dominada, due_date 2999-12-31)
-- Executar uma vez no Supabase SQL Editor do projeto Atlas Diplomático.
-- Backup: simulado_srs_backup_v1 guarda a agenda como estava antes.

CREATE TABLE IF NOT EXISTS simulado_srs_backup_v1 AS TABLE simulado_srs;
ALTER TABLE simulado_srs_backup_v1 ENABLE ROW LEVEL SECURITY; -- sem policy: fora do alcance da API

-- 1. Novas colunas
ALTER TABLE simulado_srs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'learning',
  ADD COLUMN IF NOT EXISTS subject_code text,
  ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_grade text;

CREATE INDEX IF NOT EXISTS idx_simulado_srs_user_status_due
  ON simulado_srs(user_id, status, due_date);

-- 2. Matéria vinda do payload
UPDATE simulado_srs SET subject_code = payload->>'subjectCode'
WHERE subject_code IS NULL AND payload->>'subjectCode' IS NOT NULL;

-- 3. Questões sem erro (acertadas ou presumidas sabidas): uma checagem só, entre 45 e 120 dias
UPDATE simulado_srs
SET status = 'review', step = 4, streak = 0,
    due_date = current_date + 45 + floor(random() * 76)::int
WHERE lapses = 0 AND status = 'learning';

-- 4. Erros do histórico de sessões que ainda não estão na agenda.
--    Ficam de fora decks de línguas (o "answer" deles é o lado do botão, não o conteúdo):
--    esses são importados ao abrir o baralho, com os dados completos do CSV.
INSERT INTO simulado_srs (user_id, deck, question_text, step, lapses, reps, due_date, last_review,
                          payload, status, subject_code, streak)
SELECT w.user_id, w.deck, w.q,
       CASE WHEN r.question_text IS NOT NULL THEN 1 ELSE 0 END,
       w.n, 0, current_date, NULL,
       jsonb_build_object('correct', w.answer, 'justification', NULL, 'section', '',
                          'subjectCode', w.subject_code, 'subjectLabel', '', 'tags', '[]'::jsonb),
       'learning', w.subject_code, 0
FROM (
  SELECT s.user_id, s.deck, i->>'q' AS q, count(*) AS n,
         (array_agg(i->>'answer' ORDER BY s.created_at DESC))[1] AS answer,
         (array_agg(i->>'subjectCode' ORDER BY s.created_at DESC))[1] AS subject_code
  FROM sessions s, jsonb_array_elements(coalesce(s.wrong_items, '[]'::jsonb)) i
  WHERE i->>'q' IS NOT NULL AND s.deck IS NOT NULL
    AND i->>'answer' IN ('CERTO', 'ERRADO')
    AND s.deck <> 'Revisão geral'
    AND s.deck NOT LIKE 'LINGUAS - %'
    AND s.deck NOT LIKE 'INGLES - %'
  GROUP BY 1, 2, 3
) w
LEFT JOIN simulado_wrong_resolved r
  ON r.user_id = w.user_id AND r.deck = w.deck AND r.question_text = w.q
ON CONFLICT (user_id, deck, question_text) DO NOTHING;

-- 5. Espalha o acumulado vencido em 14 dias, mais erradas primeiro
WITH d AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY lapses DESC, due_date, random()) - 1 AS rn,
         count(*) OVER (PARTITION BY user_id) AS n
  FROM simulado_srs
  WHERE status <> 'mastered' AND due_date <= current_date
)
UPDATE simulado_srs s
SET due_date = current_date + floor(d.rn * 14.0 / d.n)::int
FROM d WHERE s.id = d.id;

-- 6. Log de revisões, para medir a retenção real
CREATE TABLE IF NOT EXISTS simulado_srs_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  deck text NOT NULL,
  subject_code text,
  grade text NOT NULL,
  was_review boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE simulado_srs_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own srs log" ON simulado_srs_log;
CREATE POLICY "Users manage own srs log"
  ON simulado_srs_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_simulado_srs_log_user_date
  ON simulado_srs_log(user_id, review_date);
