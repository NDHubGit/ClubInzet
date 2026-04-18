-- ClubInzet: uitgebreid verenigings- en planningsmodel (Supabase SQL Editor of migrate)

-- ---- profiles ----
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists active boolean default true not null;
alter table public.profiles add column if not exists volunteer_type text default 'algemeen';
alter table public.profiles add column if not exists max_tasks_per_month integer default 10 not null;
alter table public.profiles add column if not exists unavailable_dates jsonb default '[]'::jsonb not null;
alter table public.profiles add column if not exists preferred_tasks jsonb default '[]'::jsonb not null;

comment on column public.profiles.volunteer_type is 'ouder | speler | senior | bestuur | algemeen';
comment on column public.profiles.unavailable_dates is 'JSON array van YYYY-MM-DD strings';
comment on column public.profiles.preferred_tasks is 'JSON array van task_type waarden';

-- ---- teams ----
alter table public.teams add column if not exists age_group text;
alter table public.teams add column if not exists category text default 'overig';
alter table public.teams add column if not exists active boolean default true not null;

comment on column public.teams.category is 'jeugd | senioren | mini | overig';

-- ---- team_members ----
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  relation_type text not null,
  created_at timestamptz default now() not null,
  unique (team_id, profile_id)
);

create index if not exists team_members_profile_id_idx on public.team_members (profile_id);
create index if not exists team_members_team_id_idx on public.team_members (team_id);

comment on column public.team_members.relation_type is 'speler | ouder | trainer | leider';

alter table public.team_members enable row level security;

drop policy if exists "team_members_read" on public.team_members;
create policy "team_members_read"
  on public.team_members for select to authenticated using (true);

drop policy if exists "team_members_insert_own" on public.team_members;
create policy "team_members_insert_own"
  on public.team_members for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "team_members_update_own" on public.team_members;
create policy "team_members_update_own"
  on public.team_members for update to authenticated
  using (auth.uid() = profile_id);

-- ---- tasks uitbreiding ----
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists start_time time without time zone;
alter table public.tasks add column if not exists end_time time without time zone;
alter table public.tasks add column if not exists priority text default 'normaal' not null;
alter table public.tasks add column if not exists status text default 'open' not null;
alter table public.tasks add column if not exists planning_explanation text;

comment on column public.tasks.priority is 'laag | normaal | hoog';
comment on column public.tasks.status is 'open | ingepland | bevestigd | voltooid';

create index if not exists tasks_task_date_idx on public.tasks (task_date);
create index if not exists tasks_assigned_to_task_date_idx on public.tasks (assigned_to, task_date);

notify pgrst, 'reload schema';
