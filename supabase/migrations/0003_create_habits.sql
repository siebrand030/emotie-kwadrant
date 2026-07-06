-- Habits-module: `habits`, `habit_logs`, `habit_metrics`.
--
-- Habits zijn geen losse bestemming maar een vervolgstap op de bestaande
-- dagelijkse check-in. Twee schema_types:
--   - 'daily'         → elke dag relevant (bijv. fysio-oefening)
--   - 'weekly_count'  → een target aantal keer per (maandag-zondag) week
--     (bijv. krachttraining 2x, hardlopen 1x)
--
-- `missed` wordt bewust NIET als losse status door de gebruiker gezet: een
-- dag zonder log voor een dagelijkse habit telt achteraf als gemist. Dat
-- wordt berekend bij lezen (in lib/habits.ts), niet gematerialiseerd — vandaar
-- dat `habit_logs.status` alleen 'done' en 'skipped' kent.

create table if not exists public.habits (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,

  name                      text not null,
  description               text,
  schedule_type             text not null
                              check (schedule_type in ('daily', 'weekly_count')),
  weekly_target             int, -- alleen bij weekly_count (bijv. 2 voor krachttraining)

  track_metric              boolean not null default false, -- true voor fysio (graden)
  metric_label              text, -- bijv. 'Externe rotatie rechts (graden)'
  metric_prompt_interval_days int not null default 7,

  sort_order                int not null default 0,
  is_active                 boolean not null default true,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint habits_weekly_target_only_for_weekly_count
    check (schedule_type = 'weekly_count' or weekly_target is null)
);

comment on table public.habits is
  'Habit-definities (dagelijks of wekelijks aantal keer), optioneel gekoppeld aan een metric.';

create index if not exists habits_user_id_idx on public.habits (user_id);

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
  before update on public.habits
  for each row
  execute function public.set_updated_at();

alter table public.habits enable row level security;

create policy "Gebruikers lezen eigen habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen habits aan"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen habits"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- `habit_logs`: één registratie per habit per dag. Skips zijn volwaardige
-- data (met reden), geen leeg gat. 'missed' wordt afgeleid, niet opgeslagen.
create table if not exists public.habit_logs (
  id            uuid primary key default gen_random_uuid(),
  habit_id      uuid not null references public.habits (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,

  log_date      date not null,
  status        text not null check (status in ('done', 'skipped')),
  skip_reason   text check (skip_reason in (
                  'geen_tijd', 'vergeten', 'pijn_of_moe', 'geen_zin',
                  'niet_van_toepassing', 'anders'
                )),
  note          text, -- optionele korte notitie, ook bij 'done'

  created_at    timestamptz not null default now(),

  unique (habit_id, log_date)
);

comment on table public.habit_logs is
  'Eén registratie per habit per dag (done/skipped + optionele reden/notitie). Missed wordt afgeleid, niet opgeslagen.';

create index if not exists habit_logs_user_id_idx on public.habit_logs (user_id);
create index if not exists habit_logs_habit_log_date_idx on public.habit_logs (habit_id, log_date);
create index if not exists habit_logs_user_log_date_idx on public.habit_logs (user_id, log_date);

alter table public.habit_logs enable row level security;

create policy "Gebruikers lezen eigen habit-logs"
  on public.habit_logs for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen habit-logs aan"
  on public.habit_logs for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen habit-logs"
  on public.habit_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen habit-logs"
  on public.habit_logs for delete
  using (auth.uid() = user_id);

-- `habit_metrics`: numerieke metingen gekoppeld aan een habit (fysio: graden
-- externe rotatie). Los van habit_logs omdat de meetfrequentie afwijkt van de
-- dagelijkse registratie.
create table if not exists public.habit_metrics (
  id            uuid primary key default gen_random_uuid(),
  habit_id      uuid not null references public.habits (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,

  measured_on   date not null,
  value         numeric not null,

  created_at    timestamptz not null default now()
);

comment on table public.habit_metrics is
  'Numerieke metingen gekoppeld aan een habit (bijv. graden externe rotatie), gevisualiseerd als lijngrafiek.';

create index if not exists habit_metrics_user_id_idx on public.habit_metrics (user_id);
create index if not exists habit_metrics_habit_measured_on_idx on public.habit_metrics (habit_id, measured_on);

alter table public.habit_metrics enable row level security;

create policy "Gebruikers lezen eigen habit-metrics"
  on public.habit_metrics for select
  using (auth.uid() = user_id);

create policy "Gebruikers maken eigen habit-metrics aan"
  on public.habit_metrics for insert
  with check (auth.uid() = user_id);

create policy "Gebruikers wijzigen eigen habit-metrics"
  on public.habit_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gebruikers verwijderen eigen habit-metrics"
  on public.habit_metrics for delete
  using (auth.uid() = user_id);

-- Seed: de drie starthabits. Per gebruiker die al bestaat op het moment van
-- migreren; nieuwe gebruikers krijgen deze niet automatisch (beheer-UI volgt
-- in fase 3). `on conflict do nothing` zou een unique constraint vereisen die
-- we bewust niet willen (naam is geen natuurlijke sleutel) — daarom guarden we
-- met een not-exists-check per gebruiker, zodat deze migratie idempotent blijft.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    if not exists (
      select 1 from public.habits where user_id = u.id and name = 'Fysio-oefening schouder'
    ) then
      insert into public.habits (
        user_id, name, description, schedule_type, track_metric, metric_label,
        metric_prompt_interval_days, sort_order
      ) values (
        u.id,
        'Fysio-oefening schouder',
        'Externe rotatie rechterschouder met weerstandsband',
        'daily',
        true,
        'Externe rotatie rechts (graden)',
        7,
        0
      );
    end if;

    if not exists (
      select 1 from public.habits where user_id = u.id and name = 'Krachttraining'
    ) then
      insert into public.habits (
        user_id, name, schedule_type, weekly_target, sort_order
      ) values (
        u.id, 'Krachttraining', 'weekly_count', 2, 1
      );
    end if;

    if not exists (
      select 1 from public.habits where user_id = u.id and name = 'Hardlopen'
    ) then
      insert into public.habits (
        user_id, name, schedule_type, weekly_target, sort_order
      ) values (
        u.id, 'Hardlopen', 'weekly_count', 1, 2
      );
    end if;
  end loop;
end $$;
