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
  due_date        text,
  start_time      text,                   -- horário de início da tarefa (HH:MM)
  due_time        text,                   -- horário de término / prazo (HH:MM)
  reminder_offset  integer default null,
  reminder_anchor  text default 'start',  -- referência do lembrete: 'start' (início) ou 'end' (término)
  recurrence       text default 'none',   -- 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  recurrence_days  integer[],             -- dias da semana (0=Dom..6=Sáb) quando recurrence='custom'
  reminder_send_at timestamptz,           -- UTC absoluto do push (calculado pelo cliente)
  reminder_sent_at timestamptz,           -- preenchido após o servidor enviar o push
  completed        boolean default false,
  completed_at timestamptz,
  week_day     integer,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── Migração para bancos existentes (execute no SQL Editor se já criou a tabela) ──
-- alter table public.tasks add column if not exists start_time text;
-- alter table public.tasks add column if not exists reminder_anchor text default 'start';
-- alter table public.tasks add column if not exists recurrence text default 'none';
-- alter table public.tasks add column if not exists recurrence_days integer[];

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

-- ── Subscriptions de push (Web Push API) ────────────────────────────────────
create table if not exists public.push_subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth_key   text not null,
  updated_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────
alter table public.tasks      enable row level security;
alter table public.subtasks   enable row level security;
alter table public.user_stats enable row level security;

-- Tasks: usuário só vê/edita as próprias
drop policy if exists "tasks_own" on public.tasks;
create policy "tasks_own" on public.tasks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subtasks: usuário só vê subtasks das próprias tarefas
drop policy if exists "subtasks_own" on public.subtasks;
create policy "subtasks_own" on public.subtasks
  for all using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

-- Push subscriptions: usuário só acessa as próprias
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User stats: usuário só acessa os próprios stats
drop policy if exists "stats_own" on public.user_stats;
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
-- (ignora se já estiver na publicação)
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.subtasks;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_stats;
exception when others then null;
end $$;

-- ── Função para a Edge Function send-reminders ────────────────────────────────
-- Retorna tarefas com lembrete vencendo nos próximos 60 segundos (ou atrasado até 2 min)
create or replace function public.get_due_reminder_tasks()
returns table(
  task_id  uuid,
  title    text,
  priority text,
  due_time text,
  endpoint text,
  p256dh   text,
  auth_key text
)
language sql
security definer
as $$
  select
    t.id       as task_id,
    t.title,
    t.priority,
    t.due_time,
    ps.endpoint,
    ps.p256dh,
    ps.auth_key
  from public.tasks t
  join public.push_subscriptions ps on ps.user_id = t.user_id
  where
    t.completed         = false
    and t.reminder_send_at is not null
    and t.reminder_sent_at is null
    and t.reminder_send_at between (now() - interval '2 minutes') and (now() + interval '1 minute');
$$;

-- ── Cron job: chama send-reminders a cada minuto ──────────────────────────────
-- Execute isso UMA VEZ no SQL Editor do Supabase:
--
-- select cron.schedule(
--   'forje-send-reminders',
--   '* * * * *',
--   $$
--     select net.http_post(
--       url    := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--     ) as request_id;
--   $$
-- );
