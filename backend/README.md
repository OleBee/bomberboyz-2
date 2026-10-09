# Shared leaderboard – setup

The game is static (GitHub Pages), so a shared list needs a small free database.
The client code is done. The list is switched on by filling in `bbx-config.js`.

## Recommended: Supabase (free)
1. Create an account at https://supabase.com and a new project (Free, region e.g. Stockholm/Frankfurt).
2. SQL Editor → paste `supabase.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **publishable key** (or the "anon public" key).
4. Fill in `bbx-config.js`:
   `global: { provider: 'supabase', url: 'https://xxxx.supabase.co', key: 'sb_publishable_…' }`

The key is public on purpose. The tables are locked (RLS without policies), and the browser can only read
`leaderboard_top` and call `submit_round()`. Free projects pause after a week without traffic and must then be woken up in Supabase.

## Alternative: Cloudflare Worker + D1 (free, never pauses)
See `cloudflare-worker.js`. Needs a Cloudflare account and `wrangler deploy`.
Use `provider: 'worker'`, `url: 'https://<worker>.workers.dev'`, `key: 'x'`.

## Cheating and abuse
- Only the host submits, and only rooms with at least two humans (not solo vs bots).
- The server checks 2–8 players, at most one winner, at most (players − 1) kills, names 1–12 characters, no duplicate names.
- The same round can't be submitted twice. Max one round per room per 15 s, max 30 rounds per IP per 10 min, max 120 per minute in total.
- Default names and bots don't count. You need at least three rounds to show up.
- The server's error messages and default-name filter are in Norwegian (unchanged in the database). The browser maps the messages to English and sends the English default names ("Player", "Player 2") in their Norwegian form ("Spiller", "Spiller 2") so the server still skips them.
- The game runs on the host, so a determined cheater can still send fake results within the limits. Names aren't protected (anyone can call themselves "Ole").
