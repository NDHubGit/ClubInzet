-- Admin: taak actief/inactief + configureerbare punten per taaktype (service role API).

alter table public.tasks add column if not exists admin_active boolean default true not null;

comment on column public.tasks.admin_active is
  'false = taak verborgen voor pool/planning (admin deactiveerde).';

create table if not exists public.task_type_point_rules (
  id uuid primary key default gen_random_uuid(),
  task_type text not null unique,
  label text not null default '',
  default_minutes numeric not null default 60,
  basis_points numeric not null default 1,
  description text,
  active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.task_type_point_rules is
  'Standaard duur/punten per taaktype; alleen via admin API (service role), niet direct vanaf client.';

create index if not exists task_type_point_rules_active_idx
  on public.task_type_point_rules (active, task_type);

alter table public.task_type_point_rules enable row level security;

drop policy if exists "task_type_point_rules_deny" on public.task_type_point_rules;

create policy "task_type_point_rules_deny"
  on public.task_type_point_rules
  for all
  to authenticated
  using (false)
  with check (false);

insert into public.task_type_point_rules (task_type, label, default_minutes, basis_points, description, active)
values
  ('bardienst', 'Bardienst', 120, 2, null, true),
  ('training', 'Training', 90, 1.5, null, true),
  ('wedstrijd', 'Wedstrijd', 120, 2, null, true),
  ('schoonmaak', 'Schoonmaak', 60, 1, null, true),
  ('anders', 'Anders', 60, 1, null, true)
on conflict (task_type) do nothing;

notify pgrst, 'reload schema';
