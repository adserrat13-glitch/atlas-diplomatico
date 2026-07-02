-- ============================================================
-- Questões CESPE/CEBRASPE — Inglês (e futuramente Espanhol)
-- Rode este SQL no Supabase → SQL Editor.
-- ============================================================

create table if not exists public.idiomas_cespe_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  lang             text not null check (lang in ('en','es')),
  mode             text not null,           -- 'isolated' | 'text-based'
  difficulty       text not null,           -- 'easy' | 'medium' | 'hard' | 'cacd'
  total_questions  integer not null,
  correct_count    integer not null default 0,
  score            integer,                 -- 0-100
  questions_data   jsonb not null default '[]',  -- array de questões geradas
  user_answers     jsonb not null default '{}',  -- {0: true, 1: false, ...}
  created_at       timestamptz not null default now()
);

create index if not exists idiomas_cespe_user_idx
  on public.idiomas_cespe_sessions (user_id, created_at desc);

alter table public.idiomas_cespe_sessions enable row level security;

drop policy if exists "cespe_select_own" on public.idiomas_cespe_sessions;
create policy "cespe_select_own"
  on public.idiomas_cespe_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "cespe_insert_own" on public.idiomas_cespe_sessions;
create policy "cespe_insert_own"
  on public.idiomas_cespe_sessions for insert
  with check (auth.uid() = user_id);
