-- ClubInzet — profiles + tasks (Supabase → SQL Editor → Run)
-- Idempotent: veilig opnieuw draaien.
--
-- LET OP: Als je al een tabel public.tasks had met user_id → auth.users,
-- moet je die eerst droppen of migreren; dit script wijzigt geen bestaande FK.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  task_type text,
  duration_minutes int,
  points numeric,
  created_at timestamptz default now()
);

create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Users can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read all tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;

create policy "Users can read all tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "Users can insert own tasks"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Automatisch profiel bij nieuwe auth-user (anders faalt task-insert op FK naar profiles)
create or replace function public.handle_clubinzet_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
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

-- Bestaande gebruikers nog geen profiel: eenmalig backfill (optioneel)
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- PostgREST: schema-cache verversen (anders vaak: "Could not find the table public.tasks in the schema cache")
notify pgrst, 'reload schema';
