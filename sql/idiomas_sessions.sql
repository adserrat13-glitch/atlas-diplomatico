-- ============================================================
-- Tutor de Idiomas CACD — tabela de sessões (inglês & espanhol)
-- Rode este SQL no Supabase → SQL Editor.
-- ============================================================

create table if not exists public.idiomas_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  lang       text not null check (lang in ('en','es')),
  mode       text not null,
  prompt     jsonb not null default '{}'::jsonb,  -- exercício gerado
  answer     text  not null default '',           -- resposta do candidato
  score      integer,                             -- nota 0-100
  feedback   jsonb not null default '{}'::jsonb,  -- correção completa
  created_at timestamptz not null default now()
);

create index if not exists idiomas_sessions_user_idx
  on public.idiomas_sessions (user_id, created_at desc);

-- ── Row Level Security: cada usuário só vê/grava as próprias sessões ──
alter table public.idiomas_sessions enable row level security;

drop policy if exists "idiomas_select_own" on public.idiomas_sessions;
create policy "idiomas_select_own"
  on public.idiomas_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "idiomas_insert_own" on public.idiomas_sessions;
create policy "idiomas_insert_own"
  on public.idiomas_sessions for insert
  with check (auth.uid() = user_id);
