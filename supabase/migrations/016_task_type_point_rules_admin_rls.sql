-- RLS op task_type_point_rules: alleen admins (profiles.role = 'admin') via authenticated role.
-- Serverroutes die SUPABASE_SERVICE_ROLE_KEY gebruiken bypassen RLS (Supabase service_role).
-- Vervangt de brede deny-all policy uit 015 zodat ingelogde admins via PostgREST/JWT wél kunnen muteren indien nodig.

alter table public.task_type_point_rules enable row level security;

drop policy if exists "task_type_point_rules_deny" on public.task_type_point_rules;
drop policy if exists "task_type_point_rules_select_admin" on public.task_type_point_rules;
drop policy if exists "task_type_point_rules_insert_admin" on public.task_type_point_rules;
drop policy if exists "task_type_point_rules_update_admin" on public.task_type_point_rules;
drop policy if exists "task_type_point_rules_delete_admin" on public.task_type_point_rules;

-- SELECT: alleen admins (clubbeheer UI / API met user-JWT)
create policy "task_type_point_rules_select_admin"
  on public.task_type_point_rules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

-- INSERT: alleen admins
create policy "task_type_point_rules_insert_admin"
  on public.task_type_point_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

-- UPDATE: alleen admins
create policy "task_type_point_rules_update_admin"
  on public.task_type_point_rules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

-- DELETE: alleen admins
create policy "task_type_point_rules_delete_admin"
  on public.task_type_point_rules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

notify pgrst, 'reload schema';
