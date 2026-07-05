# Deployen

De app is **Next.js (App Router) + Supabase** met server-side auth: `middleware.ts`
beschermt routes, server-components lezen de sessie uit cookies, en er is een
auth-callback-route. Dat vereist een **server-runtime**.

**GitHub Pages werkt hiervoor niet** — dat serveert alleen statische bestanden en
draait geen server. Gebruik daarom Vercel (of een andere host met Next.js-SSR
zoals Netlify/Cloudflare). De oude vanilla-PWA in `legacy/` was wél statisch en
kon op Pages; de nieuwe stack niet.

## Vercel

1. Ga naar [vercel.com](https://vercel.com) → **Add New… → Project** en importeer
   de repo `siebrand030/emotie-kwadrant`. Framework wordt automatisch herkend als
   **Next.js** (build `next build`, root = repo-root — niets aanpassen).
2. Zet onder **Environment Variables** (voor Production, Preview én Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Beide vind je in Supabase → **Project Settings → API** (het zijn publieke
   `anon`/publishable-waarden, geen secrets).
3. **Deploy.** Je krijgt een URL zoals `https://<project>.vercel.app`.

## Supabase — magic-link redirect toestaan

De magic-link gebruikt `window.location.origin`, dus hij werkt automatisch op
elke host zodra die op de allowlist staat. Zet in Supabase →
**Authentication → URL Configuration**:

- **Site URL**: `https://<project>.vercel.app`
- **Redirect URLs**: voeg `https://<project>.vercel.app/**` toe (en houd
  `http://localhost:3000/**` voor lokaal draaien).

Zonder deze allowlist weigert Supabase de magic-link-redirect en kun je niet
inloggen.

## Let op: de oude Pages-site

De repo-Pages staat op `main`-root en serveert nu de vanilla-PWA. Zodra de
Next.js-migratie naar `main` is gemerged, staat daar geen statische site meer en
stopt `https://<user>.github.io/emotie-kwadrant/` met werken. Je kunt Pages dan
uitzetten (repo **Settings → Pages**) — de echte app draait op Vercel.
