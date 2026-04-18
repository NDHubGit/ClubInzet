-- ClubInzet: auth alignment — created_by, profiles ↔ auth.users, veilige RLS.
-- Idempotent waar mogelijk. Draai na 001–011.

-- ---------------------------------------------------------------------------
-- 1. created_by op tasks (kolom + FK met vaste naam)
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists created_by uuid;

-- Verwijder bestaande FK op created_by (ongeacht systeemnaam) en voeg constraint toe
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'tasks'
      and c.contype = 'f'
      and conkey is not null
      and (
        pg_get_constraintdef(c.oid) ilike '%created_by%references auth.users%'
        or c.conname = 'tasks_created_by_fkey'
      )
  loop
    execute format('alter table public.tasks drop constraint if exists %I', r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'tasks'
      and c.conname = 'tasks_created_by_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_created_by_fkey
      foreign key (created_by) references auth.users (id) on delete set null;
  end if;
end $$;

comment on column public.tasks.created_by is 'auth user die de rij heeft aangemaakt (o.a. handmatige bijdrage)';

-- Bestaande handmatige rijen: created_by gelijkstellen aan user_id indien leeg
update public.tasks
set created_by = user_id
where created_by is null
  and coalesce(source, '') = 'manual';

-- ---------------------------------------------------------------------------
-- 2. Data opschonen vóór strikte FK (wees-profielen zonder auth.user)
-- ---------------------------------------------------------------------------
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- ---------------------------------------------------------------------------
-- 3. profiles strikt gekoppeld aan auth.users
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'f'
      and c.conkey is not null
      and pg_get_constraintdef(c.oid) ilike '%references auth.users%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Ontbrekende profielen voor bestaande auth.users
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, role)
select u.id, u.email, 'user'::text
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. RLS aanzetten
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Policies: bestaande droppen (historische namen)
-- ---------------------------------------------------------------------------
drop policy if exists "tasks_read" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_update_assignee" on public.tasks;
drop policy if exists "Users can read all tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can view own tasks" on public.tasks;
drop policy if exists "tasks_select_club" on public.tasks;
drop policy if exists "tasks_insert_with_creator" on public.tasks;
drop policy if exists "tasks_select_admin_all" on public.tasks;

drop policy if exists "Users can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- ---------------------------------------------------------------------------
-- PROFILES: eigen profiel lezen; admins alle profielen (clubbeheer / labels)
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and lower(trim(coalesce(pr.role, ''))) = 'admin'
    )
  );

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- TASKS: lezen — eigen koppelingen + open pool + admins alles
-- ---------------------------------------------------------------------------
create policy "tasks_select_club"
  on public.tasks
  for select
  to authenticated
  using (
    auth.uid() = created_by
    or auth.uid() = assigned_to
    or auth.uid() = user_id
    or auth.uid() = completed_by
    or (coalesce(status, '') = 'open' and assigned_to is null)
    or exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and lower(trim(coalesce(pr.role, ''))) = 'admin'
    )
  );

-- INSERT: alleen als ingelogde gebruiker de maker is (created_by = jwt)
create policy "tasks_insert_with_creator"
  on public.tasks
  for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and auth.uid() = user_id
  );

-- UPDATE: pool-eigenaar (planning) + assignee (afronden) — zelfde regels als eerdere migraties
create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_update_assignee"
  on public.tasks
  for update
  to authenticated
  using (assigned_to is not null and auth.uid() = assigned_to)
  with check (assigned_to is null or auth.uid() = assigned_to);

notify pgrst, 'reload schema';
