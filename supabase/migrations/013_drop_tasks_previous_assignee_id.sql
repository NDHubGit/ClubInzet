-- Verwijder ongebruikte kolom (geen app-logica meer).
alter table public.tasks drop column if exists previous_assignee_id;
