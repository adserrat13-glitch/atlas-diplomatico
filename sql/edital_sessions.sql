-- Tabela para sessões da Central de Análise por Edital (módulo isolado,
-- não usado pela Central TPS / analise-tps.html — tabela própria, sem
-- interferência na tabela `sessions`).
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS edital_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edital_id text NOT NULL,
  prova_key text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'completed',
  date date NOT NULL DEFAULT current_date,
  total integer NOT NULL,
  correct integer NOT NULL,
  wrong integer NOT NULL,
  time_seconds integer NOT NULL DEFAULT 0,
  subjects_breakdown jsonb,
  wrong_items jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, prova_key)
);

ALTER TABLE edital_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own edital sessions"
  ON edital_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_edital_sessions_user_edital
  ON edital_sessions(user_id, edital_id);

-- Se a tabela já existir de uma versão anterior, adicionar as colunas novas:
ALTER TABLE edital_sessions ADD COLUMN IF NOT EXISTS prova_key text NOT NULL DEFAULT '';
ALTER TABLE edital_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE edital_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- Preenche prova_key com um valor único por linha existente antes de aplicar o UNIQUE:
UPDATE edital_sessions SET prova_key = id::text WHERE prova_key = '';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edital_sessions_user_id_prova_key_key'
  ) THEN
    ALTER TABLE edital_sessions ADD CONSTRAINT edital_sessions_user_id_prova_key_key UNIQUE (user_id, prova_key);
  END IF;
END $$;
