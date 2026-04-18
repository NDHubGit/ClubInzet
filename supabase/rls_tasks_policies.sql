-- ClubInzet: RLS voor public.tasks
-- Draai in SQL Editor na aanmaken van de tabel.
-- Pas namen aan als je policies al anders heet.

alter table public.tasks enable row level security;

-- Leaderboard: alle ingelogde gebruikers mogen rijen lezen
drop policy if exists "tasks_select_authenticated" on public.tasks;
drop policy if exists "tasks_read" on public.tasks;
drop policy if exists "Users can read all tasks" on public.tasks;

create policy "tasks_select_authenticated"
  on public.tasks
  for select
  to authenticated
  using (true);

-- Alleen eigen taken invoegen (user_id = auth.uid())
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;

create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Eigen taken bijwerken
drop policy if exists "tasks_update_own" on public.tasks;

create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
