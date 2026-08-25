-- Tabela para persistência do deck de revisão futura (questões erradas 2x+, por matéria)
-- Executar no Supabase SQL Editor do projeto Atlas Diplomático

CREATE TABLE IF NOT EXISTS simulado_review_future (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_code text NOT NULL,
  subject_label text,
  question_text text NOT NULL,
  correct_answer text NOT NULL,
  section text,
  tags jsonb,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, subject_code, question_text)
);

ALTER TABLE simulado_review_future ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own future review items"
  ON simulado_review_future
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_review_future_user_subject
  ON simulado_review_future(user_id, subject_code);
