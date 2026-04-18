-- Herinnerings-e-mail (24u) apart van assignment notification_sent
alter table public.tasks add column if not exists reminder_email_sent boolean default false not null;

comment on column public.tasks.reminder_email_sent is 'True na versturen 24u herinneringsmail';

notify pgrst, 'reload schema';
