-- Normaliseer taakstatussen: assigned → claimed, no_show → missed (idempotent).

update public.tasks
set status = 'claimed'
where lower(coalesce(status, '')) = 'assigned';

update public.tasks
set status = 'missed'
where lower(coalesce(status, '')) = 'no_show';
