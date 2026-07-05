-- Dagplanner: tabel `tasks`.
--
-- Inbox en tijdlijn delen bewust één tabel. Het `status`-veld bepaalt de plek:
--   'inbox'     -> ongepland; date/start_time zijn null
--   'scheduled' -> ingepland; date en start_time zijn gevuld
-- Inplannen is dus een status-update naar 'scheduled' plus het invullen van
-- date en start_time (geen aparte tabel/verplaatsing van rijen).

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  notes             text,
  status            text not null default 'inbox'
                      check (status in ('inbox', 'scheduled')),
  date              date,        -- null bij inbox-items
  start_time        time,        -- null bij inbox-items
  duration_minutes  integer check (duration_minutes is null or duration_minutes > 0),
  color             text not null default 'coral',
  completed         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Consistentie: een ingeplande taak heeft altijd een datum en starttijd.
  constraint tasks_scheduled_has_datetime check (
    status <> 'scheduled' or (date is not null and start_time is not null)
  )
);

comment on table public.tasks is
  'Taken voor de dagplanner. Inbox en tijdlijn delen deze tabel via het status-veld.';

-- Indexen voor de meest voorkomende queries (eigen taken, per dag, per status).
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_user_date_idx on public.tasks (user_id, date);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);

-- updated_at automatisch bijwerken bij elke wijziging.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

-- Row Level Security: gebruikers zien en muteren uitsluitend hun eigen rijen.
alter table public.tasks enable row level security;

create policy "Gebruikers lezen eigen taken"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen taken aan"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen taken"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen taken"
  on public.tasks for delete
  using (auth.uid() = user_id);
