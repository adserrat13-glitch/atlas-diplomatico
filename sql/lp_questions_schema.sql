-- ============================================================
-- Módulo: Questões CESPE/CEBRASPE — Língua Portuguesa CACD
-- ============================================================

-- Tópicos carregados do arquivo do usuário
CREATE TABLE IF NOT EXISTS lp_topics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  name          text NOT NULL,
  subtopic      text,
  weight        numeric(5,4) NOT NULL DEFAULT 0.05,
  area          text,          -- ex: "Morfossintaxe", "Semântica"
  source_file   text,
  created_at    timestamptz DEFAULT now()
);

-- Banco de questões geradas (histórico + deduplicação)
CREATE TABLE IF NOT EXISTS lp_questions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid,
  topic_id              uuid REFERENCES lp_topics(id) ON DELETE SET NULL,
  topic_name            text NOT NULL,
  subtopic              text,
  area                  text,
  statement             text NOT NULL,
  answer                boolean NOT NULL,  -- true = Certo, false = Errado
  explanation           text NOT NULL,
  grammar_justification text NOT NULL,
  difficulty            text NOT NULL CHECK (difficulty IN ('easy','medium','hard','cacd')),
  keywords              text[],
  recurrence_degree     int CHECK (recurrence_degree BETWEEN 1 AND 5),
  is_trap               boolean DEFAULT false,
  content_hash          text UNIQUE NOT NULL,  -- SHA-256 do enunciado normalizado
  created_at            timestamptz DEFAULT now()
);

-- Simulados (agrupamento de questões)
CREATE TABLE IF NOT EXISTS lp_simulados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  title        text NOT NULL,
  question_ids uuid[] NOT NULL,
  config       jsonb,
  created_at   timestamptz DEFAULT now()
);

-- Respostas dos usuários
CREATE TABLE IF NOT EXISTS lp_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  question_id  uuid NOT NULL REFERENCES lp_questions(id) ON DELETE CASCADE,
  simulado_id  uuid REFERENCES lp_simulados(id) ON DELETE SET NULL,
  user_answer  boolean NOT NULL,
  is_correct   boolean NOT NULL,
  answered_at  timestamptz DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_lp_topics_user ON lp_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_questions_user ON lp_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_questions_topic ON lp_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_lp_questions_hash ON lp_questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_lp_answers_user ON lp_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_answers_question ON lp_answers(question_id);

-- RLS: cada usuário vê apenas seus próprios dados
ALTER TABLE lp_topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_answers   ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_topics_user    ON lp_topics    USING (user_id = auth.uid());
CREATE POLICY lp_questions_user ON lp_questions USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY lp_simulados_user ON lp_simulados USING (user_id = auth.uid());
CREATE POLICY lp_answers_user   ON lp_answers   USING (user_id = auth.uid());
