-- Tabela para sessões da Central de Análise por Edital (módulo isolado,
-- não usado pela Central TPS / analise-tps.html — tabela própria, sem
-- interferência na tabela `sessions`).
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS edital_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edital_id text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  total integer NOT NULL,
  correct integer NOT NULL,
  wrong integer NOT NULL,
  time_seconds integer NOT NULL DEFAULT 0,
  subjects_breakdown jsonb,
  wrong_items jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE edital_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own edital sessions"
  ON edital_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_edital_sessions_user_edital
  ON edital_sessions(user_id, edital_id);
