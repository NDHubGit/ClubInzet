-- Parent UX: vorige vrijwilliger op open taak + inbox-events voor banners

alter table public.tasks
  add column if not exists previous_assignee_id uuid references public.profiles (id) on delete set null;

comment on column public.tasks.previous_assignee_id is 'Laatste vrijwilliger die de taak heeft vrijgegeven (decline)';

create table if not exists public.task_flow_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  task_id uuid references public.tasks (id) on delete cascade,
  message text not null,
  for_user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz default now() not null
);

create index if not exists task_flow_events_created_at_idx on public.task_flow_events (created_at desc);
create index if not exists task_flow_events_for_user_idx on public.task_flow_events (for_user_id, created_at desc);

comment on table public.task_flow_events is 'MVP UI-notificaties: pool_broadcast (iedereen) of assigned_you (één user)';

alter table public.task_flow_events enable row level security;

drop policy if exists "task_flow_events_select" on public.task_flow_events;
create policy "task_flow_events_select"
  on public.task_flow_events for select to authenticated
  using (for_user_id is null or for_user_id = auth.uid());

notify pgrst, 'reload schema';
