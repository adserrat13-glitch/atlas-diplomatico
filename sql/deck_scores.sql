-- Tabela para sincronizar entre dispositivos a % de acerto da última tentativa de cada deck
-- Usada para colorir o balão do deck em simulados.html (vermelho -> amarelo -> verde)
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS deck_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  pct integer NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, deck_name)
);

ALTER TABLE deck_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deck scores"
  ON deck_scores
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deck_scores_user
  ON deck_scores(user_id);
