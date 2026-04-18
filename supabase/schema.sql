-- ClubInzet — draai dit in de Supabase SQL Editor (nieuw project).
-- Auth: zorg dat Email provider aan staat (magic link + wachtwoord).

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  team_id uuid references public.teams (id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null,
  duration_minutes numeric not null,
  points numeric not null,
  flagged boolean default false not null,
  flag_reason text,
  created_at timestamptz default now() not null
);

create index if not exists tasks_user_id_created_at_idx on public.tasks (user_id, created_at desc);
create index if not exists profiles_team_id_idx on public.profiles (team_id);

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- Teams: iedere ingelogde gebruiker mag lezen
create policy "teams_read" on public.teams for select to authenticated using (true);

-- Profielen: lezen voor klassement; eigen rij aanmaken/bewerken
create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Taken: alle leden mogen lezen (aggregatie klassement); alleen eigen inserts
create policy "tasks_read" on public.tasks for select to authenticated using (true);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check (auth.uid() = user_id);

-- Standaardteams (eenmalig; veilig bij her-run)
insert into public.teams (name)
select v
from (values ('Team A'), ('Team B'), ('Team C')) as t(v)
where not exists (select 1 from public.teams x where x.name = t.v);

-- Profielrij wordt aangemaakt/geüpdatet vanuit de app (auth callback + dashboard).
