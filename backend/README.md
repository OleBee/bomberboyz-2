# Felles toppliste – oppsett

Spillet er statisk (GitHub Pages), så en felles liste trenger en liten gratis database.
Klientkoden er ferdig. Listen slås på ved å fylle inn `bbx-config.js`.

## Anbefalt: Supabase (gratis)
1. Lag konto på https://supabase.com og et nytt prosjekt (Free, region f.eks. Stockholm/Frankfurt).
2. SQL Editor → lim inn `supabase.sql` → Run.
3. Project Settings → API: kopier **Project URL** og **publishable key** (eller «anon public» key).
4. Fyll inn i `bbx-config.js`:
   `global: { provider: 'supabase', url: 'https://xxxx.supabase.co', key: 'sb_publishable_…' }`

Nøkkelen er offentlig med vilje. Tabellene er låst (RLS uten policies), og nettleseren kan bare lese
`leaderboard_top` og kalle `submit_round()`. Gratisprosjekter pauses etter en uke uten trafikk og må da vekkes i Supabase.

## Alternativ: Cloudflare Worker + D1 (gratis, pauses aldri)
Se `cloudflare-worker.js`. Krever Cloudflare-konto og `wrangler deploy`.
Bruk `provider: 'worker'`, `url: 'https://<worker>.workers.dev'`, `key: 'x'`.

## Juks og misbruk
- Bare verten sender inn, bare rom med minst to mennesker (ikke solo mot boter).
- Serveren sjekker 2–8 spillere, maks én vinner, maks (spillere − 1) drap, navn 1–12 tegn, ingen like navn.
- Samme runde kan ikke sendes to ganger. Maks én runde per rom per 15 s, maks 30 runder per IP per 10 min, maks 120 per minutt totalt.
- Standardnavn («Spiller», «Spiller 2») og boter telles ikke. Man må ha spilt minst tre runder for å vises.
- Spillet kjører hos verten, så en bestemt jukser kan fortsatt sende falske resultater innenfor grensene. Navn er ikke beskyttet (hvem som helst kan kalle seg «Ole»).
