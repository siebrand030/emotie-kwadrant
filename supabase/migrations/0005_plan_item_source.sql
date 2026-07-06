-- Kleur wordt herkomst i.p.v. vrije keuze per item: een plan-item krijgt zijn
-- kleur nu afgeleid van `source` (zie lib/task-colors.ts), niet meer van een
-- los `color`-veld. Zo zie je in één oogopslag hoeveel van je oorspronkelijke
-- braindump-planning nog overeind staat versus wat je later ad hoc hebt
-- toegevoegd. `calendar` staat alvast in de constraint klaar voor een latere
-- Google Calendar-koppeling (nog niet gebouwd).

alter table public.plan_items
  add column if not exists source text not null default 'planned'
    check (source in ('planned', 'adhoc', 'calendar'));

alter table public.plan_items drop column if exists color;
