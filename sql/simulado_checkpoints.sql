-- Tabela para persistência de progresso mid-session de simulados longos (≥250 questões)
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS simulado_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  current_index integer NOT NULL,
  total_questions integer NOT NULL,
  answers jsonb NOT NULL,
  queue_ids integer[] NOT NULL,
  mode text NOT NULL,
  timer_seconds integer NOT NULL DEFAULT 0,
  saved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, deck_name)
);

ALTER TABLE simulado_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkpoints"
  ON simulado_checkpoints
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_deck
  ON simulado_checkpoints(user_id, deck_name);
