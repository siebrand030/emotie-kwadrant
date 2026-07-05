-- Emotie-logger: tabel `checkins`.
--
-- Een check-in legt vast in welk kwadrant (`quadrant`) én welke specifieke
-- emotie de gebruiker zat, met een tijdstip, optioneel 6 factoren (1-5) en een
-- notitie. Alle inzichten (weekverdeling, dagdelen, tijdlijn) worden afgeleid
-- uit deze rijen — er is geen aparte opslag.
--
-- Migratie van de vanilla-versie (localStorage `emokwadrant.entries.v1`). Oude
-- localStorage-data wordt NIET overgezet. Zelfde patroon als `tasks`: RLS op
-- user_id, updated_at-trigger en indexen.

create table if not exists public.checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Kwadrant: interne key uit de legacy-app (labels: Beuken/Bouwen/
  -- Wegkwijnen/Ontspannen).
  quadrant    text not null
                check (quadrant in ('forceren', 'bouwen', 'wegzakken', 'opladen')),
  -- Specifieke emotie uit laag 2 (vrij tekstveld; de set kan evolueren).
  emotion     text not null,
  -- Moment van loggen (tik op het kwadrant). Wordt door de client meegegeven.
  logged_at   timestamptz not null default now(),

  -- Laag 3: 6 factoren, elk 1-5 of null (= niet ingesteld).
  factor_slaap     smallint check (factor_slaap    is null or factor_slaap    between 1 and 5),
  factor_stress    smallint check (factor_stress   is null or factor_stress   between 1 and 5),
  factor_eten      smallint check (factor_eten     is null or factor_eten     between 1 and 5),
  factor_wiet      smallint check (factor_wiet     is null or factor_wiet     between 1 and 5),
  factor_alcohol   smallint check (factor_alcohol  is null or factor_alcohol  between 1 and 5),
  factor_planning  smallint check (factor_planning is null or factor_planning between 1 and 5),

  note        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.checkins is
  'Emotie-check-ins (kwadrant + emotie + factoren + notitie). Inzichten worden hieruit afgeleid.';

-- Indexen voor de meest voorkomende queries (eigen check-ins, chronologisch).
create index if not exists checkins_user_id_idx on public.checkins (user_id);
create index if not exists checkins_user_logged_at_idx on public.checkins (user_id, logged_at);

-- updated_at automatisch bijwerken bij elke wijziging. Dezelfde functie als in
-- 0001; create or replace houdt deze migratie idempotent en zelfstandig.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checkins_set_updated_at on public.checkins;
create trigger checkins_set_updated_at
  before update on public.checkins
  for each row
  execute function public.set_updated_at();

-- Row Level Security: gebruikers zien en muteren uitsluitend hun eigen rijen.
alter table public.checkins enable row level security;

create policy "Gebruikers lezen eigen check-ins"
  on public.checkins for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen check-ins aan"
  on public.checkins for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen check-ins"
  on public.checkins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen check-ins"
  on public.checkins for delete
  using (auth.uid() = user_id);
