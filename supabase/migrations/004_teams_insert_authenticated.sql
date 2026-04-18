-- Authenticated users mogen teams aanmaken (development seed / admin)
drop policy if exists "teams_insert_authenticated" on public.teams;
create policy "teams_insert_authenticated"
  on public.teams for insert to authenticated
  with check (true);

notify pgrst, 'reload schema';
