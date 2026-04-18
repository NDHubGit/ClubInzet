-- =============================================================================
-- ClubInzet — tables
-- =============================================================================

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  team_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_type text not null,
  duration_minutes integer not null,
  points numeric not null,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- indexes
-- =============================================================================

create index if not exists idx_users_team_id on public.users (team_id);
create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_tasks_created_at on public.tasks (created_at desc);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.teams enable row level security;
alter table public.users enable row level security;
alter table public.tasks enable row level security;

-- =============================================================================
-- policies — teams
-- =============================================================================

drop policy if exists "teams_select_authenticated" on public.teams;
create policy "teams_select_authenticated"
  on public.teams
  for select
  to authenticated
  using (true);

-- =============================================================================
-- policies — users
-- =============================================================================

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

-- =============================================================================
-- policies — tasks
-- =============================================================================

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- trigger — nieuwe auth.user → public.users
-- =============================================================================

create or replace function public.handle_clubinzet_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, first_name, last_name)
  values (new.id, new.email, null, null)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_clubinzet_auth_user_created on auth.users;
create trigger on_clubinzet_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_clubinzet_new_user();

-- =============================================================================
-- seed — teams (optioneel)
-- =============================================================================

insert into public.teams (name)
select v
from (values ('Team A'), ('Team B'), ('Team C')) as t(v)
where not exists (select 1 from public.teams x where x.name = t.v);
