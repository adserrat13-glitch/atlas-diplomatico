-- A tabela `sessions` (usada por simulados.html) nunca tinha a coluna
-- subjects_breakdown, então addSession() em supabase.js gravava só o campo
-- `subject` (matéria dominante da sessão), e as metas por matéria em
-- simulados.html (que leem subjects_breakdown) ficavam zeradas para as
-- matérias que não foram a dominante da sessão.
-- Executar no Supabase → SQL Editor do projeto Atlas Diplomático.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS subjects_breakdown jsonb;
