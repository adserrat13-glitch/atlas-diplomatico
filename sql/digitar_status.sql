-- sql/digitar_status.sql
-- Run manually in Supabase SQL Editor.

create table if not exists digitar_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null,
  question text not null,
  score int not null check (score >= 0 and score <= 100),
  last_review timestamptz not null default now(),
  primary key (user_id, deck_name, question)
);

alter table digitar_status enable row level security;

create policy "digitar_status_own_rows" on digitar_status
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
