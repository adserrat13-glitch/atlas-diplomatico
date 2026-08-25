-- Marca questões erradas como "resolvidas" quando acertadas na sessão
-- "Refazer todas as erradas", pra sumirem da lista permanentemente até
-- errarem de novo (nesse caso reaparecem via sessions.wrong_items).
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS simulado_wrong_resolved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck text NOT NULL,
  question_text text NOT NULL,
  resolved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, deck, question_text)
);

ALTER TABLE simulado_wrong_resolved ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own resolved wrong items"
  ON simulado_wrong_resolved
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wrong_resolved_user_deck
  ON simulado_wrong_resolved(user_id, deck);
