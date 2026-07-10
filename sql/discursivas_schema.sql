-- Run manually in Supabase SQL Editor.
-- Perguntas Discursivas: perguntas abertas com correcao por IA.

create table if not exists discursivas_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  reference_answer text not null,
  created_at timestamptz not null default now(),
  unique (category, question)
);
alter table discursivas_questions enable row level security;
drop policy if exists "discursivas_questions_read" on discursivas_questions;
create policy "discursivas_questions_read" on discursivas_questions
  for select using (auth.role() = 'authenticated');

create table if not exists discursivas_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references discursivas_questions(id) on delete cascade,
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

create index if not exists idx_discursivas_attempts_user_question
  on discursivas_attempts(user_id, question_id);

create table if not exists discursivas_review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references discursivas_questions(id) on delete cascade,
  next_review_at timestamptz not null default now(),
  last_score int,
  streak int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table discursivas_review_state enable row level security;
drop policy if exists "discursivas_review_state_own_rows" on discursivas_review_state;
create policy "discursivas_review_state_own_rows" on discursivas_review_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
