-- Tabela do caderno de revisão (resumos de erros gerados por IA ao fim de um simulado)
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS simulado_notebook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  pct integer NOT NULL,
  total integer NOT NULL,
  correct integer NOT NULL,
  bullets jsonb NOT NULL,
  wrong_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE simulado_notebook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notebook entries"
  ON simulado_notebook
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_simulado_notebook_user_created
  ON simulado_notebook(user_id, created_at DESC);
