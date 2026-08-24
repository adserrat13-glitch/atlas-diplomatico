-- Sincroniza entre dispositivos o streak de metas diárias e os troféus (patches) conquistados
-- Substitui os localStorage keys metas_history_v1 e metas_deck_bonus_v1 em simulados.html
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

-- ── META STREAK (um registro por dia em que a meta diária foi batida) ──
CREATE TABLE IF NOT EXISTS meta_streak (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  level integer NOT NULL,
  patch_file text NOT NULL,
  via text NOT NULL DEFAULT 'streak' CHECK (via IN ('streak', 'deck')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE meta_streak ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meta streak"
  ON meta_streak
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_streak_user
  ON meta_streak(user_id);

-- ── DECK TROPHIES (um registro por deck completado em um dia) ──
CREATE TABLE IF NOT EXISTS deck_trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  deck_name text NOT NULL,
  pct integer NOT NULL,
  level integer NOT NULL,
  patch_file text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, deck_name)
);

ALTER TABLE deck_trophies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deck trophies"
  ON deck_trophies
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deck_trophies_user
  ON deck_trophies(user_id);
