# CLAUDE.md

Guidance voor Claude Code bij het werken in deze repo.

## Project

Emotie-bibliotheek: een Nederlandstalige PWA met twee onderdelen:

1. **Emotie-logger ("Kwadrant")** — log emoties met één tik in vier kwadranten
   (Beuken · Bouwen · Wegkwijnen · Ontspannen), met kalme inzichten. De
   originele vanilla-JS-versie staat in `legacy/` als referentie.
2. **Dagplanner** (in ontwikkeling) — een tijdlijn per dag plus een inbox voor
   ongeplande taken.

### Migratie in uitvoering

De app wordt gemigreerd van een **vanilla-JS + `localStorage` PWA** (nu in
`legacy/`) naar **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase**.
De dagplanner is de eerste feature die native in de nieuwe stack wordt gebouwd;
de emotie-logger wordt daarna gemigreerd. Migreer bestaande logica bij voorkeur
mét behoud van het bestaande visuele systeem (OKLCH-kwadrantkleuren, donkere
shell) — die tokens staan in `app/globals.css`.

## Dagplanner-feature

Doel: taken vastleggen en inplannen. Je vangt taken op in een **inbox** en
plant ze in op een **tijdlijn** (dag-view). Inplannen = een taak een datum en
starttijd geven.

### Kernconventie: inbox en tijdlijn delen één `tasks`-tabel

Inbox en tijdlijn zijn géén aparte tabellen. Ze delen bewust de tabel `tasks`.
Het `status`-veld bepaalt waar een taak thuishoort:

- `status = 'inbox'` → ongepland; `date` en `start_time` zijn `null`.
- `status = 'scheduled'` → ingepland; `date` en `start_time` zijn gevuld.

**Inplannen** is dus een status-update naar `'scheduled'` plus het invullen van
`date` en `start_time` — geen verplaatsing tussen tabellen. Een DB-constraint
(`tasks_scheduled_has_datetime`) bewaakt dat een `scheduled`-taak altijd een
datum en tijd heeft.

### Datamodel — tabel `tasks`

| kolom              | type          | bijzonderheden                                   |
| ------------------ | ------------- | ------------------------------------------------ |
| `id`               | uuid          | primary key, default `gen_random_uuid()`         |
| `user_id`          | uuid          | not null, → `auth.users(id)`                     |
| `title`            | text          | not null                                         |
| `notes`            | text          | nullable                                         |
| `status`           | text          | not null, default `'inbox'` — `'inbox'`/`'scheduled'` |
| `date`             | date          | null bij inbox-items                             |
| `start_time`       | time          | null bij inbox-items                             |
| `duration_minutes` | integer       | nullable, > 0                                    |
| `color`            | text          | not null, default `'coral'`                      |
| `completed`        | boolean       | not null, default `false`                        |
| `created_at`       | timestamptz   | not null, default `now()`                        |
| `updated_at`       | timestamptz   | not null, default `now()` (trigger houdt bij)    |

**RLS**: aan; gebruikers kunnen uitsluitend hun eigen rijen lezen en schrijven
(`auth.uid() = user_id` op select/insert/update/delete).

TypeScript-types voor dit model staan in `lib/supabase/types.ts`.

## Projectstructuur

```
middleware.ts           sessie-refresh + route-bescherming
app/                    Next.js App Router
  layout.tsx            root-layout + PWA-metadata
  globals.css           Tailwind + design-tokens (OKLCH-kwadrantkleuren)
  page.tsx              landing / navigatie
  login/page.tsx        /login — e-mail + wachtwoord (signInWithPassword / signUp)
  auth/callback/route.ts  wisselt de bevestigings-code om voor een sessie
  planner/page.tsx      /planner — dag-tijdlijn (beschermd)
  inbox/page.tsx        /inbox   — ongeplande taken (beschermd)
components/planner/     dagplanner-componenten (timeline, inbox-list, …)
components/auth/        sign-out-button, …
lib/supabase/           client.ts (browser), server.ts (SSR),
                        middleware.ts (session-refresh), types.ts
public/                 statische assets (iconen, manifest)
supabase/migrations/    SQL-migraties
legacy/                 originele vanilla-JS PWA (referentie voor migratie)
```

## Authenticatie

E-mail + wachtwoord login via Supabase Auth (`@supabase/ssr`):

- `/login` heeft één formulier met een schakelaar tussen **inloggen**
  (`signInWithPassword`) en **registreren** (`signUp`). Foutcodes van Supabase
  worden vertaald naar Nederlandse meldingen (verkeerd wachtwoord, onbekend
  account, bestaand account, zwak wachtwoord, rate limit).
- De sessie wordt door de browser-client (`createBrowserClient`) in **cookies**
  bewaard, niet in geheugen. Daardoor blijft de sessie behouden na een reload en
  in PWA-/standalone-context op mobiel, en kan de middleware haar server-side
  lezen.
- `/auth/callback` wisselt de `code` (PKCE) om voor een sessie
  (`exchangeCodeForSession`). Nog steeds nodig wanneer **e-mailbevestiging** in
  Supabase aanstaat: `signUp` stuurt dan een bevestigingslink naar
  `/auth/callback` en levert pas een sessie na bevestiging.
- `middleware.ts` ververst de sessie op elke request en beschermt `/planner` en
  `/inbox`: niet-ingelogd → redirect naar `/login?next=<pad>`.
- Uitloggen via `components/auth/sign-out-button.tsx` (`signOut` + redirect).

Supabase-dashboard: onder **Authentication → Providers → Email** staat of
**Confirm email** aan/uit staat. Staat het uit, dan is een gebruiker na `signUp`
meteen ingelogd; staat het aan, dan moet de bevestigingslink gevolgd worden. Zet
onder **URL Configuration** de redirect URL `http://localhost:3000/**` (en later
de productie-URL) op de allowlist voor die bevestigingslink.

## Commando's

```bash
npm install        # dependencies
npm run dev        # dev-server (http://localhost:3000)
npm run build      # productie-build
npm run lint       # eslint
```

## Supabase-migraties

Schemawijzigingen worden beheerd als genummerde SQL-bestanden in
`supabase/migrations/` (bijv. `0001_create_tasks.sql`). Voer ze uit via de
Supabase CLI (`supabase db push`) of door de SQL in de Supabase SQL-editor te
plakken. Schrijf migraties idempotent waar mogelijk (`if not exists`, `create
or replace`). Genereer types opnieuw na een schemawijziging:
`supabase gen types typescript` → `lib/supabase/types.ts`.

Environment: kopieer `.env.example` naar `.env.local` en vul
`NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` in.
