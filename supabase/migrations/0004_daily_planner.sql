-- Dagplanner v2: braindump + tijdlijn + losse inbox, drie tabellen i.p.v. de
-- oude gedeelde `tasks`-tabel.
--
-- - `daily_plans`   : één rij per gebruiker per datum. Het bestaan van deze
--                     rij betekent "vandaag is de dagplanning al gestart" en
--                     stuurt de auto-redirect naar /planner op de startpagina.
-- - `plan_items`    : braindump- en tijdlijn-items, altijd gekoppeld aan een
--                     daily_plan. `status` bepaalt braindump (unscheduled) vs
--                     tijdlijn (scheduled). Kolomnamen zijn bewust
--                     `planned_*` (niet `start_time`/`duration_minutes`) zodat
--                     een latere avondreflectie `actual_*`-kolommen of een
--                     aparte `reflections`-tabel kan toevoegen zonder de
--                     oorspronkelijke planning te overschrijven.
-- - `inbox_items`   : losse, datumloze gedachten — expliciet geen onderdeel
--                     van de dagplanning of de latere plan-vs-realiteit-
--                     vergelijking.

drop table if exists public.tasks;

-- --- daily_plans ---

create table if not exists public.daily_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  created_at  timestamptz not null default now(),

  unique (user_id, date)
);

comment on table public.daily_plans is
  'Eén rij per gebruiker per datum: markeert dat de dagplanning voor die dag is gestart.';

alter table public.daily_plans enable row level security;

create policy "Gebruikers lezen eigen dagplanningen"
  on public.daily_plans for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen dagplanningen aan"
  on public.daily_plans for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen dagplanningen"
  on public.daily_plans for delete
  using (auth.uid() = user_id);

-- --- plan_items ---

create table if not exists public.plan_items (
  id                      uuid primary key default gen_random_uuid(),
  daily_plan_id           uuid not null references public.daily_plans (id) on delete cascade,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  title                   text not null,
  notes                   text,
  status                  text not null default 'unscheduled'
                            check (status in ('unscheduled', 'scheduled')),
  planned_start_time      time,        -- null bij unscheduled (braindump)
  planned_duration_minutes integer check (planned_duration_minutes is null or planned_duration_minutes > 0),
  sort_order              integer not null default 0, -- volgorde in de braindump-lijst
  color                   text not null default 'coral',
  completed               boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Consistentie: een ingepland item heeft altijd een starttijd en duur.
  constraint plan_items_scheduled_has_time check (
    status <> 'scheduled' or (planned_start_time is not null and planned_duration_minutes is not null)
  )
);

comment on table public.plan_items is
  'Braindump- en tijdlijn-items van een dagplanning. status bepaalt braindump (unscheduled) vs tijdlijn (scheduled).';

create index if not exists plan_items_daily_plan_id_idx on public.plan_items (daily_plan_id);
create index if not exists plan_items_user_id_idx on public.plan_items (user_id);

drop trigger if exists plan_items_set_updated_at on public.plan_items;
create trigger plan_items_set_updated_at
  before update on public.plan_items
  for each row
  execute function public.set_updated_at();

alter table public.plan_items enable row level security;

create policy "Gebruikers lezen eigen plan-items"
  on public.plan_items for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen plan-items aan"
  on public.plan_items for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen plan-items"
  on public.plan_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen plan-items"
  on public.plan_items for delete
  using (auth.uid() = user_id);

-- --- inbox_items ---

create table if not exists public.inbox_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

comment on table public.inbox_items is
  'Losse, datumloze gedachten. Geen onderdeel van een dagplanning of de plan-vs-realiteit-vergelijking.';

create index if not exists inbox_items_user_id_idx on public.inbox_items (user_id);

alter table public.inbox_items enable row level security;

create policy "Gebruikers lezen eigen inbox-items"
  on public.inbox_items for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen inbox-items aan"
  on public.inbox_items for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen inbox-items"
  on public.inbox_items for delete
  using (auth.uid() = user_id);
