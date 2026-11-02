-- Agenda de repetição espaçada por questão dos simulados
-- step = degrau na escada de intervalos (js/srs.js), lapses = total de erros
-- payload = cópia dos dados da questão, para a revisão geral não baixar todos os CSVs
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS simulado_srs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck text NOT NULL,
  question_text text NOT NULL,
  step integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  last_review date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, deck, question_text)
);

ALTER TABLE simulado_srs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own srs cards"
  ON simulado_srs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_simulado_srs_user_due
  ON simulado_srs(user_id, due_date);
