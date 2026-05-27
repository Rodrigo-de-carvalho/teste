-- ============================================================
-- FORGE — Schema SQL
-- Cole isso no Supabase: Dashboard → SQL Editor → Run
-- ============================================================

-- ── Tabela de tarefas ────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  notes        text default '',
  priority     text default 'medium' check (priority in ('critical','high','medium','low')),
  project      text default 'Geral',
  due_date     text,
  due_time     text,
  completed    boolean default false,
  completed_at timestamptz,
  week_day     integer,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── Tabela de subtarefas ─────────────────────────────────────
create table if not exists public.subtasks (
  id      uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  title   text not null,
  done    boolean default false
);

-- ── Stats do usuário ─────────────────────────────────────────
create table if not exists public.user_stats (
  id              uuid primary key references auth.users(id) on delete cascade,
  xp              integer default 0,
  level           integer default 1,
  streak          integer default 0,
  last_active_date text,
  total_focus_sec integer default 0,
  today_focus_sec integer default 0,
  focus_task_id   uuid references public.tasks(id) on delete set null
);

-- ── Row Level Security ───────────────────────────────────────
alter table public.tasks      enable row level security;
alter table public.subtasks   enable row level security;
alter table public.user_stats enable row level security;

-- Tasks: usuário só vê/edita as próprias
create policy "tasks_own" on public.tasks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subtasks: usuário só vê subtasks das próprias tarefas
create policy "subtasks_own" on public.subtasks
  for all using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

-- User stats: usuário só acessa os próprios stats
create policy "stats_own" on public.user_stats
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Trigger: cria stats automaticamente no signup ───────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_stats (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trigger: atualiza updated_at automaticamente ─────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ── Habilitar Realtime nas tabelas ────────────────────────────
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.subtasks;
alter publication supabase_realtime add table public.user_stats;
