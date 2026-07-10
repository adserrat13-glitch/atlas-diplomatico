-- Run manually in Supabase SQL Editor.
-- Perguntas Discursivas: perguntas abertas com correcao por IA.
-- As perguntas vivem nos CSVs em pergutnas/ (lidos direto pelo client, como TPS/FLASHCARDS).
-- O banco guarda apenas o progresso do usuario, identificado por deck_name + question.

create table if not exists discursivas_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null,
  question text not null,
  user_answer text not null,
  score int not null check (score >= 0 and score <= 100),
  approved boolean not null,
  correct_points jsonb not null default '[]',
  missing_points jsonb not null default '[]',
  errors jsonb not null default '[]',
  feedback text,
  time_spent_seconds int,
  attempt_number int not null default 1,
  created_at timestamptz not null default now()
);
alter table discursivas_attempts enable row level security;
drop policy if exists "discursivas_attempts_own_rows" on discursivas_attempts;
create policy "discursivas_attempts_own_rows" on discursivas_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_discursivas_attempts_user_deck_question
  on discursivas_attempts(user_id, deck_name, question);

create table if not exists discursivas_review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null,
  question text not null,
  next_review_at timestamptz not null default now(),
  last_score int,
  streak int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_name, question)
);
alter table discursivas_review_state enable row level security;
drop policy if exists "discursivas_review_state_own_rows" on discursivas_review_state;
create policy "discursivas_review_state_own_rows" on discursivas_review_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Se a versao anterior (com discursivas_questions) ja foi aplicada, remova a tabela obsoleta:
-- drop table if exists discursivas_questions cascade;

-- Checkpoint de posicao no deck (mesmo padrao de simulado_checkpoints), para
-- retomar "de onde parei" em decks longos (ex: 1435 perguntas).
create table if not exists discursivas_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null,
  current_index integer not null,
  total_questions integer not null,
  saved_at timestamptz default now(),
  unique(user_id, deck_name)
);
alter table discursivas_checkpoints enable row level security;
drop policy if exists "discursivas_checkpoints_own_rows" on discursivas_checkpoints;
create policy "discursivas_checkpoints_own_rows" on discursivas_checkpoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_discursivas_checkpoints_user_deck
  on discursivas_checkpoints(user_id, deck_name);
