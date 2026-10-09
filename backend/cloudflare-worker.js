// Super BomberBoyz – felles toppliste som Cloudflare Worker + D1 (alternativ til Supabase).
// Oppsett: wrangler d1 create bomberboyz-top  →  kjør SCHEMA under  →  bind som env.DB  →  wrangler deploy.
// bbx-config.js: { provider: 'worker', url: 'https://<worker>.workers.dev', key: 'x' }
//
// SCHEMA:
//   create table players (name_key text primary key, name text not null, wins int default 0, games int default 0,
//                         kills int default 0, updated_at int);
//   create table rounds (room text, round int, ip text, created_at int, primary key (room, round));
//   create index rounds_ip on rounds (ip, created_at);
const ORIGINS = ['https://bomberboyz.no', 'https://www.bomberboyz.no'];
const cors = o => ({ 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' });
const json = (o, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors(o), 'Content-Type': 'application/json' } });
const clean = n => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 12);

export default {
  async fetch(req, env) {
    const url = new URL(req.url), o = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });
    if (req.method === 'GET' && url.pathname === '/top') {
      const lim = Math.min(100, Math.max(1, +url.searchParams.get('limit') || 10));
      const { results } = await env.DB.prepare(
        'select name, wins, games, kills from players where games >= 3 order by wins desc, cast(wins as real) / max(games, 1) desc, kills desc limit ?').bind(lim).all();
      return new Response(JSON.stringify(results), { headers: { ...cors(o), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
    }
    if (req.method === 'POST' && url.pathname === '/round') {
      if (!ORIGINS.includes(o)) return json(o, { error: 'origin' }, 403);
      const ip = req.headers.get('CF-Connecting-IP') || 'ukjent', now = Date.now();
      let b; try { b = await req.json(); } catch { return json(o, { error: 'json' }, 400); }
      const ps = Array.isArray(b.p_players) ? b.p_players : [];
      const room = String(b.p_room || ''), round = b.p_round | 0;
      if (!/^[A-Z0-9]{4,8}$/.test(room) || round < 1 || round > 1000 || ps.length < 2 || ps.length > 8) return json(o, { error: 'ugyldig' }, 400);
      const names = ps.map(p => clean(p.name));
      const wins = ps.filter(p => p.win).length, kills = ps.reduce((s, p) => s + Math.max(0, p.kills | 0), 0);
      if (new Set(names.map(n => n.toLowerCase())).size !== ps.length || wins > 1 || kills > ps.length - 1) return json(o, { error: 'umulig' }, 400);
      const recent = await env.DB.prepare('select count(*) n from rounds where ip = ? and created_at > ?').bind(ip, now - 600000).first();
      if (recent.n >= 30) return json(o, { error: 'for mange' }, 429);
      const roomRecent = await env.DB.prepare('select count(*) n from rounds where room = ? and created_at > ?').bind(room, now - 15000).first();
      if (roomRecent.n > 0) return json(o, { error: 'for raskt' }, 429);
      try { await env.DB.prepare('insert into rounds (room, round, ip, created_at) values (?, ?, ?, ?)').bind(room, round, ip, now).run(); }
      catch { return json(o, { error: 'duplikat' }, 409); }
      const stmts = [];
      ps.forEach((p, i) => {
        const n = names[i]; if (!n || /^(spiller( ?\d+)?|robo-.*)$/i.test(n)) return;
        stmts.push(env.DB.prepare(`insert into players (name_key, name, wins, games, kills, updated_at) values (?, ?, ?, 1, ?, ?)
          on conflict(name_key) do update set name = excluded.name, wins = wins + excluded.wins, games = games + 1, kills = kills + excluded.kills, updated_at = excluded.updated_at`)
          .bind(n.toLowerCase(), n, p.win ? 1 : 0, Math.min(7, Math.max(0, p.kills | 0)), now));
      });
      if (stmts.length) await env.DB.batch(stmts);
      return json(o, { ok: true });
    }
    return json(o, { error: 'not found' }, 404);
  },
};
