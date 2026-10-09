/* BomberBoyz 2 – original retro bombespill. All grafikk tegnes i kode. */
'use strict';
(() => {
// ---------- Konstanter ----------
const COLS = 13, ROWS = 11, TS = 16, FW = COLS + 2, FH = ROWS + 2, N = COLS * ROWS;
const KICK_SPEED = 7;   // boksehanske: hvor mange ruter i sekundet en dyttet bombe glir
const BOMB_TIME = 2.5, FLAME_TIME = 0.6, BURN_TIME = 0.6, READY_TIME = 1.4, ROUND_LIMIT = 160;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRKEY = { u: 'up', d: 'down', l: 'left', r: 'right' };
const COLORS = [
  { c: '#e8483c', n: 'Rød' }, { c: '#3c7ae8', n: 'Blå' },
  { c: '#f0c020', n: 'Gul' }, { c: '#a050e0', n: 'Lilla' }];
const STARTS = [[0, 0], [12, 10], [12, 0], [0, 10]];
const PEER_PREFIX = 'bomberboyz2-v1-';
const SD_START = 90, SD_STEP = 0.4;   // «tiden renner ut»: brettet krymper fra 90 s
const SPIRAL = (() => { const o = []; let x0 = 0, y0 = 0, x1 = COLS - 1, y1 = ROWS - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) o.push(y0 * COLS + x);
    for (let y = y0 + 1; y <= y1; y++) o.push(y * COLS + x1);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) o.push(y1 * COLS + x);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) o.push(y * COLS + x0);
    x0++; y0++; x1--; y1--; }
  return o; })();
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const $ = id => document.getElementById(id);

// ---------- Fargehjelp ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function drawRows(ctx, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x]; if (ch === '.' || !pal[ch]) continue;
    ctx.fillStyle = pal[ch]; ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}

// ---------- Fliser (egen pikselgrafikk) ----------
const SPR = {};
function bevelBlock(face, hi, lo, edge) {
  const c = mk(TS, TS), x = c.getContext('2d');
  x.fillStyle = edge; x.fillRect(0, 0, 16, 16);
  x.fillStyle = lo; x.fillRect(0, 0, 15, 15);
  x.fillStyle = hi; x.fillRect(0, 0, 14, 14);
  x.fillStyle = face; x.fillRect(2, 2, 12, 12);
  x.fillStyle = shade(face, 0.12); x.fillRect(3, 3, 9, 2);       // lys glans
  x.fillStyle = shade(face, -0.08); x.fillRect(3, 11, 10, 2);    // mørk underkant
  x.fillStyle = hi; x.fillRect(2, 2, 1, 1);
  return c;
}
function buildTiles() {
  SPR.solid = bevelBlock('#b4b6c0', '#eceef4', '#62646e', '#2a2b33');
  SPR.frame = bevelBlock('#5d6070', '#8a8d9c', '#30323c', '#15161c');
  // mursteinsvegg
  let c = mk(TS, TS), x = c.getContext('2d');
  x.fillStyle = '#4a4c56'; x.fillRect(0, 0, 16, 16);
  for (let r = 0; r < 4; r++) {
    const off = r % 2 ? 4 : 0;
    for (let bx = -8 + off; bx < 16; bx += 8) {
      const y0 = r * 4, x0 = Math.max(0, bx), x1 = Math.min(16, bx + 7);
      if (x1 <= x0) continue;
      x.fillStyle = '#8f919c'; x.fillRect(x0, y0, x1 - x0, 3);
      x.fillStyle = '#b9bbc6'; x.fillRect(x0, y0, x1 - x0, 1);
      x.fillStyle = '#6b6d78'; x.fillRect(x0, y0 + 2, x1 - x0, 1);
    }
  }
  SPR.wall = c;
  // gulv
  c = mk(TS, TS); x = c.getContext('2d');
  x.fillStyle = '#1f7a30'; x.fillRect(0, 0, 16, 16);
  x.fillStyle = '#1c6f2c';
  [[3, 5], [11, 2], [7, 12], [13, 10], [1, 13], [9, 7]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
  x.fillStyle = '#23853a';
  [[5, 9], [12, 14], [2, 2], [14, 5]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
  SPR.floor = c;
  // power-ups: farget kant + eget ikon
  const icons = {
    B: { bg: '#2f5fc0', rows: [
      '......YO..', '.....Y.O..', '....KKK...', '...KKKKK..', '..KWKKKKK.',
      '..KKKKKKK.', '..KKKKKKK.', '...KKKKK..', '....KKK...', '..........'],
      plus: true },
    F: { bg: '#b8301c', rows: [
      '....R.....', '...RR..R..', '...ROR.RR.', '..ROOR.RR.', '..ROYORRR.',
      '.RROYYOOR.', '.ROYYYYOR.', '.ROYWWYOR.', '..ROYYOR..', '...RRRR...'] },
    S: { bg: '#2a8a6a', rows: [
      '.....YYY..', '....YYY...', '...YYY....', '..YYYYYY..', '....YYY...',
      '...YYY....', '..YYY.....', '.YYY......', '.YY.......', '.Y........'] },
    G: { bg: '#6a3cb0', rows: [
      '....RRRR..', '...RWWRRR.', '..RWRRRRRR', 'W.RRRRRRRR', 'WWRRDDDDRR',
      'WWRRRRRRDR', 'W.RRRRRRDR', '..RRRRRRR.', '...DRRRRD.', '....DDDD..'] },
  };
  const ipal = { D: '#8e1a10', K: '#141418', W: '#9aa0c0', Y: '#ffe04a', O: '#ff8a1a', R: '#e03a1a' };
  for (const k in icons) {
    c = mk(TS, TS); x = c.getContext('2d');
    x.fillStyle = '#f0f0f0'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#d8302a'; x.fillRect(1, 1, 14, 14);
    x.fillStyle = icons[k].bg; x.fillRect(2, 2, 12, 12);
    x.fillStyle = shade(icons[k].bg, 0.25); x.fillRect(2, 2, 12, 1); x.fillRect(2, 2, 1, 12);
    drawRows(x, icons[k].rows, k === 'S' ? { Y: '#fff27a' } : ipal, 3, 3);
    if (icons[k].plus) { x.fillStyle = '#ffffff'; x.fillRect(11, 10, 3, 1); x.fillRect(12, 9, 1, 3); }
    SPR['p' + k] = c;
  }
}

// ---------- Robotfigurer (originalt design: kantede roboter med visir) ----------
const ROBOT = [
  '................',
  '....KKKKKKKK....',
  '...KLLLLLLLLK...',
  '..KLCCCCCCCCDK..',
  '.GKC@@@@@@@@DKG.',
  '.GKC########DKG.',
  '.GKC@@@@@@@@DKG.',
  '..KCCCCCCCCCDK..',
  '...KDDDDDDDDK...',
  '....KKKKKKKK....',
  '...KCCCYYCCCK...',
  '..KCCCCYYCCCDK..',
  '..KMCCCCCCCDMK..',
  '...KKKKKKKKKK...'];
const LEGS = [['...KTTK..KTTK...', '...KKKK..KKKK...'], ['..KTTK....KTTK..', '..KKKK....KKKK..']];
const VISOR = {
  down:  ['VVVVVVVV', 'VEEVVEEV', 'VVVVVVVV'],
  left:  ['VVVVVVVV', 'EEVVEEVV', 'VVVVVVVV'],
  right: ['VVVVVVVV', 'VVEEVVEE', 'VVVVVVVV'],
  up:    ['CCCCCCCC', 'KCKCKCKC', 'CCCCCCCC'] };
const robotCache = {};
function robotSprite(slot, dir, frame) {
  const key = slot + dir + frame;
  if (robotCache[key]) return robotCache[key];
  const col = COLORS[slot].c;
  const pal = { K: '#141420', L: shade(col, 0.45), C: col, D: shade(col, -0.35), V: '#1c2430',
    E: '#6ff0ff', G: '#9aa0aa', M: '#c4cad4', Y: '#ffe25a', T: '#3a3a44' };
  const v = VISOR[dir];
  const rows = ROBOT.map(r => r).concat(LEGS[frame]);
  rows[4] = rows[4].replace('@@@@@@@@', v[0]);
  rows[5] = rows[5].replace('########', v[1]);
  rows[6] = rows[6].replace('@@@@@@@@', v[2]);
  const c = mk(TS, TS); drawRows(c.getContext('2d'), rows, pal);
  return (robotCache[key] = c);
}

// ---------- Simulering (kjøres kun hos verten) ----------
class Game {
  constructor(members) {
    this.grid = new Array(N).fill('.');
    const safe = new Set();
    for (const [sx, sy] of STARTS) {
      safe.add(sy * COLS + sx);
      safe.add(sy * COLS + sx + (sx === 0 ? 1 : -1));
      safe.add((sy + (sy === 0 ? 1 : -1)) * COLS + sx);
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      if (x % 2 === 1 && y % 2 === 1) this.grid[i] = '#';
      else if (!safe.has(i) && Math.random() < 0.62) this.grid[i] = 'w';
    }
    this.players = members.map(m => ({
      slot: m.slot, name: m.name, bot: !!m.bot, x: STARTS[m.slot][0], y: STARTS[m.slot][1],
      alive: true, deathT: 0, maxBombs: 1, range: 2, speedLv: 0, glove: false, dir: 'down', moving: false,
      input: { dir: null, bomb: false }, ai: { cd: 0.5 + Math.random() * 0.5, jit: {}, jitT: 0, step: null, from: null } }));
    this.bombs = []; this.bombId = 0; this.flames = new Map(); this.burning = new Map();
    this.kills = [0, 0, 0, 0];
    this.phase = 'play'; this.endT = 0; this.winner = -1; this.time = 0; this.exCount = 0; this.sdIdx = 0;
  }
  cell(x, y) { return (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? '#' : this.grid[y * COLS + x]; }
  bombAt(x, y) { for (const b of this.bombs) if (b.x === x && b.y === y) return b; return null; }
  passable(x, y, p) {
    const c = this.cell(x, y);
    if (c === '#' || c === 'w' || c === 'x') return false;
    const b = this.bombAt(x, y);
    return !(b && !(p && b.pass.has(p.slot)));
  }
  speed(p) { return 3.4 + p.speedLv * 0.55; }
  step(dt) {
    this.time += dt;
    const live = this.time > READY_TIME && this.phase === 'play';
    for (const p of this.players) {
      if (!p.alive) { p.deathT += dt; continue; }
      if (!live) { p.input.bomb = false; p.moving = false; continue; }
      if (p.bot) botThink(this, p, dt); else movePlayer(this, p, dt);
      if (p.input.bomb) { p.input.bomb = false; this.placeBomb(p); }
      const tx = Math.round(p.x), ty = Math.round(p.y), i = ty * COLS + tx, c = this.grid[i];
      if (c === 'B') { p.maxBombs = Math.min(8, p.maxBombs + 1); this.grid[i] = '.'; }
      else if (c === 'F') { p.range = Math.min(8, p.range + 1); this.grid[i] = '.'; }
      else if (c === 'S') { p.speedLv = Math.min(5, p.speedLv + 1); this.grid[i] = '.'; }
      else if (c === 'G') { p.glove = true; this.grid[i] = '.'; }
    }
    for (const b of this.bombs) {
      for (const s of b.pass) {
        const q = this.players.find(p => p.slot === s);
        if (!q || !q.alive || Math.abs(q.x - b.x) >= 0.98 || Math.abs(q.y - b.y) >= 0.98) b.pass.delete(s);
      }
      b.t -= dt;
    }
    this.slideBombs(dt);
    this.explode();
    for (const [i, f] of this.flames) { f.t -= dt; if (f.t <= 0) this.flames.delete(i); }
    for (const [i, w] of this.burning) {
      w.t -= dt; if (w.t <= 0) { this.burning.delete(i); this.grid[i] = w.drop || '.'; }
    }
    while (this.phase === 'play' && this.time > SD_START + this.sdIdx * SD_STEP && this.sdIdx < SPIRAL.length) {
      const i = SPIRAL[this.sdIdx++], x = i % COLS, y = (i / COLS) | 0;
      this.grid[i] = '#'; this.burning.delete(i); this.flames.delete(i);
      this.bombs = this.bombs.filter(b => !(b.x === x && b.y === y));
      for (const p of this.players) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.alive = false; p.deathT = 0; }
    }
    for (const p of this.players) {
      const f = p.alive && this.flames.get(Math.round(p.y) * COLS + Math.round(p.x));
      if (f) { p.alive = false; p.deathT = 0; if (f.o != null && f.o !== p.slot) this.kills[f.o]++; }
    }
    if (this.phase === 'play') {
      const alive = this.players.filter(p => p.alive);
      const done = this.players.length > 1 ? alive.length <= 1 : alive.length === 0;
      if (done || this.time > ROUND_LIMIT) {
        this.endT += dt;
        if (this.endT > 1.5 || this.time > ROUND_LIMIT) {
          this.phase = 'over';
          const a2 = this.players.filter(p => p.alive);
          this.winner = (a2.length === 1 && this.time <= ROUND_LIMIT + 2) ? a2[0].slot : -1;
        }
      }
    }
  }
  // Boksehanske: en dyttet bombe glir rute for rute til den møter vegg, blokk, bombe, spiller eller power-up
  slideFree(b, x, y) {
    if (this.cell(x, y) !== '.') return false;
    if (this.bombs.some(o => o !== b && o.x === x && o.y === y)) return false;
    return !this.players.some(q => q.alive && Math.abs(q.x - x) < 0.8 && Math.abs(q.y - y) < 0.8);
  }
  kick(p, b) {
    if (b.slide || !p.glove || b.pass.has(p.slot)) return;
    const [dx, dy] = DIRS[p.dir];
    if (!this.slideFree(b, b.x + dx, b.y + dy)) return;
    b.slide = p.dir; b.prog = 0;
  }
  slideBombs(dt) {
    for (const b of this.bombs) {
      if (!b.slide) continue;
      const [dx, dy] = DIRS[b.slide];
      // prog er forskyvning fra rutemidten (−0,5 … 0,5); bomben bytter rute halvveis
      if (b.prog >= 0 && !this.slideFree(b, b.x + dx, b.y + dy)) { b.prog = 0; b.slide = null; continue; }
      b.prog += KICK_SPEED * dt;
      if (b.prog >= 0.5) {
        b.x += dx; b.y += dy; b.prog -= 1;
        for (const s of [...b.pass]) b.pass.delete(s);
      }
    }
  }
  placeBomb(p) {
    const tx = Math.round(p.x), ty = Math.round(p.y);
    if (this.bombAt(tx, ty)) return;
    if (this.bombs.filter(b => b.owner === p.slot).length >= p.maxBombs) return;
    const pass = new Set(this.players.filter(q => q.alive && Math.abs(q.x - tx) < 1 && Math.abs(q.y - ty) < 1).map(q => q.slot));
    this.bombs.push({ id: ++this.bombId, x: tx, y: ty, t: BOMB_TIME, range: p.range, owner: p.slot, pass, slide: null, prog: 0 });
  }
  addFlame(x, y, k, o) {
    const i = y * COLS + x, e = this.flames.get(i);
    if (!e) { this.flames.set(i, { k, t: FLAME_TIME, o }); return; }
    e.o = o;
    const ax = s => 'hlr'.includes(s) ? 'h' : ('vud'.includes(s) ? 'v' : 'c');
    if (e.k !== k) e.k = (ax(e.k) === ax(k) && ax(k) !== 'c') ? ax(k) : 'c';
    e.t = FLAME_TIME;
  }
  explode() {
    const q = this.bombs.filter(b => b.t <= 0 || this.flames.has(b.y * COLS + b.x));
    while (q.length) {
      const b = q.shift(), bi = this.bombs.indexOf(b);
      if (bi < 0) continue;
      this.bombs.splice(bi, 1); this.exCount++;
      this.addFlame(b.x, b.y, 'c', b.owner);
      for (const [dx, dy, ax, end] of [[1, 0, 'h', 'r'], [-1, 0, 'h', 'l'], [0, 1, 'v', 'd'], [0, -1, 'v', 'u']]) {
        for (let s = 1; s <= b.range; s++) {
          const x = b.x + dx * s, y = b.y + dy * s, c = this.cell(x, y), i = y * COLS + x;
          if (c === '#' || c === 'x') break;
          if (c === 'w') {
            const r = Math.random();
            this.grid[i] = 'x';
            this.burning.set(i, { t: BURN_TIME, drop: r < 0.12 ? 'B' : r < 0.24 ? 'F' : r < 0.32 ? 'S' : r < 0.39 ? 'G' : null });
            break;
          }
          const ob = this.bombAt(x, y);
          if (ob) { q.push(ob); break; }
          if (c === 'B' || c === 'F' || c === 'S' || c === 'G') { this.grid[i] = '.'; this.addFlame(x, y, end, b.owner); break; }
          this.addFlame(x, y, s === b.range ? end : ax, b.owner);
        }
      }
    }
  }
}

function movePlayer(g, p, dt) {
  const d = p.input.dir;
  if (!d || !DIRS[d]) { p.moving = false; return; }
  p.dir = d; p.moving = true;
  let dist = g.speed(p) * dt;
  const [dx, dy] = DIRS[d], horiz = dx !== 0, s = horiz ? dx : dy;
  let a = horiz ? p.x : p.y, o = horiz ? p.y : p.x;
  const ca = Math.round(a), co = Math.round(o), off = o - co;
  const pass = (al, or) => horiz ? g.passable(al, or, p) : g.passable(or, al, p);
  const put = () => { if (horiz) { p.x = a; p.y = o; } else { p.y = a; p.x = o; } };
  if (Math.abs(off) > 1e-3) {
    let target = null;
    if (pass(ca + s, co)) target = co;
    else { const co2 = co + Math.sign(off); if (pass(ca + s, co2) && pass(ca, co2)) target = co2; }
    if (target === null) { o = co; put(); p.moving = false; return; }
    const diff = target - o, m = Math.min(dist, Math.abs(diff));
    o += Math.sign(diff) * m; dist -= m;
    if (Math.abs(target - o) > 1e-3) { put(); return; }
    o = target;
  }
  let na = a + s * dist;
  if (!pass(ca + s, Math.round(o))) na = s > 0 ? Math.min(na, Math.max(a, ca)) : Math.max(na, Math.min(a, ca));
  a = na; put();
  // Boksehanske: går du rett inn i en bombe, dyttes den videre i gåretningen
  if (p.glove) {
    const ra = Math.round(a), ro = Math.round(o);
    if (Math.abs(o - ro) < 0.2 && Math.abs(a - ra) < 0.05) {
      const b = horiz ? g.bombAt(ra + s, ro) : g.bombAt(ro, ra + s);
      if (b) g.kick(p, b);
    }
  }
}

// ---------- Boter ----------
function blast(g, b) {
  const out = [b.y * COLS + b.x];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let s = 1; s <= b.range; s++) {
      const x = b.x + dx * s, y = b.y + dy * s, c = g.cell(x, y);
      if (c === '#' || c === 'w' || c === 'x') break;
      out.push(y * COLS + x);
      if (g.bombAt(x, y) || 'BFSG'.includes(c)) break;
    }
  }
  return out;
}
function dangerMap(g) {
  const d = new Float32Array(N).fill(Infinity);
  for (const i of g.flames.keys()) d[i] = 0;
  if (g.time > SD_START - 3) for (let k = 0; k < 10 && g.sdIdx + k < SPIRAL.length; k++) d[SPIRAL[g.sdIdx + k]] = 0;
  const bl = g.bombs.map(b => blast(g, b)), eff = g.bombs.map(b => b.t);
  for (let it = 0; it < 3; it++)
    g.bombs.forEach((b, i) => g.bombs.forEach((o, j) => {
      if (i !== j && bl[i].includes(o.y * COLS + o.x)) eff[j] = Math.min(eff[j], eff[i]);
    }));
  bl.forEach((tiles, i) => tiles.forEach(t => { d[t] = Math.min(d[t], eff[i]); }));
  return d;
}
function bfs(g, p, sx, sy, danger, sp) {
  const dist = new Int16Array(N).fill(-1), first = new Int16Array(N).fill(-1), order = [];
  const s0 = sy * COLS + sx; dist[s0] = 0; order.push(s0);
  for (let h = 0; h < order.length; h++) {
    const i = order[h], x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, ni = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || dist[ni] >= 0) continue;
      if (!g.passable(nx, ny, null)) continue;
      const arrive = (dist[i] + 1) / sp;
      const dz = danger[ni];
      if (dz !== Infinity && !(dz > arrive + 0.45 || dz + FLAME_TIME + 0.1 < arrive)) continue;
      dist[ni] = dist[i] + 1; first[ni] = i === s0 ? ni : first[i]; order.push(ni);
    }
  }
  return { dist, first, order };
}
function enemyInLine(g, p, tx, ty) {
  for (const q of g.players) {
    if (q === p || !q.alive) continue;
    const qx = Math.round(q.x), qy = Math.round(q.y);
    if (qx !== tx && qy !== ty) continue;
    const dd = Math.abs(qx - tx) + Math.abs(qy - ty);
    if (dd > p.range) continue;
    const b = blast(g, { x: tx, y: ty, range: p.range });
    if (b.includes(qy * COLS + qx)) return true;
  }
  return false;
}
function botDecide(g, p, tx, ty) {
  const ai = p.ai, here = ty * COLS + tx, sp = g.speed(p);
  const danger = dangerMap(g);
  const r = bfs(g, p, tx, ty, danger, sp);
  let goal = -1, first = r.first;
  if (danger[here] !== Infinity) {
    for (const i of r.order) if (danger[i] === Infinity) { goal = i; break; }
    if (goal < 0) { let bt = -1; for (const i of r.order) if (danger[i] > bt) { bt = danger[i]; goal = i; } }
  } else {
    let mine = 0; for (const b of g.bombs) if (b.owner === p.slot) mine++;
    let wallNear = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.cell(tx + dx, ty + dy) === 'w') wallNear = true;
    const foe = enemyInLine(g, p, tx, ty);
    const nearFoe = g.players.some(q => q !== p && q.alive && Math.abs(Math.round(q.x) - tx) + Math.abs(Math.round(q.y) - ty) <= 2);
    if (ai.cd <= 0 && mine < p.maxBombs && !g.bombAt(tx, ty) && (foe || (wallNear && Math.random() < 0.7) || (nearFoe && Math.random() < 0.5))) {
      const fake = { x: tx, y: ty, t: BOMB_TIME, range: p.range, owner: p.slot, pass: new Set([p.slot]) };
      g.bombs.push(fake);
      const d2 = dangerMap(g), r2 = bfs(g, p, tx, ty, d2, sp);
      g.bombs.pop();
      let esc = -1;
      for (const i of r2.order) if (d2[i] === Infinity && r2.dist[i] / sp < BOMB_TIME - 0.8) { esc = i; break; }
      ai.cd = 0.3 + Math.random() * 0.5;
      if (esc >= 0) { p.input.bomb = true; goal = esc; first = r2.first; }
    }
    if (goal < 0) {
      let best = -1e9;
      for (const i of r.order) {
        if (danger[i] !== Infinity) continue;
        const x = i % COLS, y = (i / COLS) | 0, c = g.grid[i];
        let sc = -r.dist[i] * 0.9;
        if (c === 'B' || c === 'F' || c === 'S' || c === 'G') sc += 9;
        let walls = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.cell(x + dx, y + dy) === 'w') walls++;
        sc += walls * 2.2;
        if (enemyInLine(g, p, x, y)) sc += 5;
        let md = 99;
        for (const q of g.players) if (q !== p && q.alive) md = Math.min(md, Math.abs(Math.round(q.x) - x) + Math.abs(Math.round(q.y) - y));
        sc += Math.max(0, 6 - md) * 0.9;
        if (ai.jit[i] === undefined) ai.jit[i] = Math.random() * 3;
        sc += ai.jit[i];
        if (sc > best) { best = sc; goal = i; }
      }
      // ingen vegger igjen i nærheten: oppsøk nærmeste motstander
      if (best < 1) {
        let bd = 1e9;
        for (const q of g.players) if (q !== p && q.alive) {
          const qi = Math.round(q.y) * COLS + Math.round(q.x);
          if (r.dist[qi] > 0 && r.dist[qi] < bd && danger[qi] === Infinity) { bd = r.dist[qi]; goal = qi; }
        }
      }
    }
  }
  if (goal < 0 || goal === here) return -1;
  return first[goal] >= 0 ? first[goal] : -1;
}
function botThink(g, p, dt) {
  const ai = p.ai; ai.cd -= dt; ai.jitT -= dt;
  if (ai.jitT <= 0) { ai.jit = {}; ai.jitT = 2 + Math.random() * 2; }
  let move = g.speed(p) * dt;
  p.input.dir = null;
  for (let guard = 0; guard < 3 && move > 1e-6; guard++) {
    if (ai.step == null) {
      const tx = Math.round(p.x), ty = Math.round(p.y); p.x = tx; p.y = ty;
      ai.from = ty * COLS + tx;
      const st = botDecide(g, p, tx, ty);
      if (p.input.bomb) { p.input.bomb = false; g.placeBomb(p); }
      if (st < 0) { p.moving = false; return; }
      ai.step = st;
    }
    let sx = ai.step % COLS, sy = (ai.step / COLS) | 0;
    if (!g.passable(sx, sy, p) && !(Math.abs(p.x - sx) < 0.5 && Math.abs(p.y - sy) < 0.5)) {
      if (ai.from != null && ai.from !== ai.step) { ai.step = ai.from; sx = ai.step % COLS; sy = (ai.step / COLS) | 0; }
      else { ai.step = null; p.moving = false; return; }
    }
    const dx = sx - p.x, dy = sy - p.y, d = Math.abs(dx) + Math.abs(dy);
    if (d > 1e-6) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    p.moving = true;
    if (d <= move) { p.x = sx; p.y = sy; move -= d; ai.step = null; }
    else { p.x += Math.sign(dx) * Math.min(move, Math.abs(dx)); p.y += Math.sign(dy) * Math.min(move, Math.abs(dy)); move = 0; }
  }
}

// ---------- Tilstand som sendes over nett ----------
function snapshot(g) {
  return {
    t: 's', ph: g.phase, g: g.grid.join(''), tm: +g.time.toFixed(2), ex: g.exCount, w: g.winner,
    b: g.bombs.map(b => { const d = b.slide ? DIRS[b.slide] : [0, 0];
      return [b.x, b.y, +b.t.toFixed(2), +(d[0] * b.prog).toFixed(3), +(d[1] * b.prog).toFixed(3), b.id]; }),
    f: [...g.flames].map(([i, f]) => [i, f.k, +f.t.toFixed(2)]),
    x: [...g.burning].map(([i, w]) => [i, +w.t.toFixed(2)]),
    p: g.players.map(p => [p.slot, +p.x.toFixed(3), +p.y.toFixed(3), p.alive ? 1 : 0, p.dir[0],
      p.moving ? 1 : 0, +p.deathT.toFixed(2), p.maxBombs, p.range, p.speedLv, p.name, p.bot ? 1 : 0, p.glove ? 1 : 0, g.kills[p.slot] || 0]),
    sc: room.scores.slice(), rn: room.round, lb: boardArr(),
  };
}

// ---------- Tegning ----------
const cv = $('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const disp = {}; // glattede posisjoner per spiller
const dispB = {}; // glattede posisjoner per bombe
function circle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) c.fillRect(x, y, 1, 1);
  }
}
function drawBomb(px, py, t, now) {
  const pulse = Math.sin(now * (t < 0.8 ? 30 : 12)) > 0 ? 0.6 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 3, py + 13, 11, 2);
  circle(ctx, px + 8, py + 9, 5.6 + pulse, '#141418');
  circle(ctx, px + 6.5, py + 7.5, 1.8, '#3a3c4a');
  ctx.fillStyle = '#8890aa'; ctx.fillRect(px + 5, py + 6, 1, 1);
  ctx.fillStyle = '#5a5e6e'; ctx.fillRect(px + 10, py + 3, 2, 2);          // hette
  ctx.fillStyle = '#c08850'; ctx.fillRect(px + 12, py + 2, 1, 1); ctx.fillRect(px + 13, py + 1, 1, 1);
  const sparks = ['#ffffff', '#ffe04a', '#ff8a1a'];
  const k = Math.floor(now * 20) % 3;
  ctx.fillStyle = sparks[k]; ctx.fillRect(px + 14, py, 1, 1);
  ctx.fillStyle = sparks[(k + 1) % 3]; ctx.fillRect(px + 13, py, 1, 1); ctx.fillRect(px + 14, py + 1, 1, 1);
  if (k === 0) { ctx.fillStyle = '#ffe04a'; ctx.fillRect(px + 15, py + 1, 1, 1); ctx.fillRect(px + 12, py, 1, 1); }
}
function drawFlame(px, py, k, t, now) {
  const life = Math.max(0, Math.min(1, t / FLAME_TIME));
  const w = life > 0.25 ? 1 : life / 0.25;            // krymper mot slutten
  const fl = (Math.floor(now * 30) % 2);
  const layers = [[7 * w, '#e8401a'], [5.5 * w, '#ff9020'], [3.5 * w, '#ffe04a'], [1.6 * w, '#fffbe0']];
  for (const [hw0, col] of layers) {
    const hw = Math.max(0, Math.round(hw0 + (fl && hw0 > 5 ? 0.5 : 0)));
    if (hw <= 0) continue;
    ctx.fillStyle = col;
    const cx = px + 8, cy = py + 8;
    const H = (x0, x1) => ctx.fillRect(x0, cy - hw, x1 - x0, hw * 2);
    const V = (y0, y1) => ctx.fillRect(cx - hw, y0, hw * 2, y1 - y0);
    if (k === 'h') H(px, px + 16);
    else if (k === 'v') V(py, py + 16);
    else if (k === 'c') { H(px, px + 16); V(py, py + 16); ctx.fillRect(cx - hw - 1, cy - hw - 1, hw * 2 + 2, hw * 2 + 2); }
    else if (k === 'r') { H(px, px + 12); ctx.fillRect(px + 12, cy - hw + 1, 2, hw * 2 - 2); }
    else if (k === 'l') { H(px + 4, px + 16); ctx.fillRect(px + 2, cy - hw + 1, 2, hw * 2 - 2); }
    else if (k === 'd') { V(py, py + 12); ctx.fillRect(cx - hw + 1, py + 12, hw * 2 - 2, 2); }
    else if (k === 'u') { V(py + 4, py + 16); ctx.fillRect(cx - hw + 1, py + 2, hw * 2 - 2, 2); }
  }
  // gnister i kanten
  if (w > 0.6) {
    ctx.fillStyle = '#ffd040';
    const s = (px * 7 + py * 13 + Math.floor(now * 15)) % 16;
    ctx.fillRect(px + s, py + (s * 5) % 16, 1, 1);
  }
}
function render(s, now, dt) {
  if (!s) return;
  ctx.imageSmoothingEnabled = false;
  for (let fy = 0; fy < FH; fy++) for (let fx = 0; fx < FW; fx++) {
    if (fx === 0 || fy === 0 || fx === FW - 1 || fy === FH - 1) ctx.drawImage(SPR.frame, fx * TS, fy * TS);
  }
  const g = s.g;
  const tall = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? true : '#wx'.includes(g[y * COLS + x]);
  const burnT = {}; for (const [i, t] of s.x) burnT[i] = t;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = g[y * COLS + x], px = (x + 1) * TS, py = (y + 1) * TS;
    if (c === '#') { ctx.drawImage(SPR.solid, px, py); continue; }
    if (c === 'w') { ctx.drawImage(SPR.wall, px, py); continue; }
    ctx.drawImage(SPR.floor, px, py);
    ctx.fillStyle = 'rgba(0,30,8,0.45)';
    if (tall(x, y - 1)) ctx.fillRect(px, py, 16, 3);
    if (tall(x - 1, y)) ctx.fillRect(px, py + (tall(x, y - 1) ? 3 : 2), 3, 16 - (tall(x, y - 1) ? 3 : 2));
    if (c === 'x') {
      const t = burnT[y * COLS + x] || 0, life = t / BURN_TIME;
      ctx.globalAlpha = life; ctx.drawImage(SPR.wall, px, py); ctx.globalAlpha = 1;
      const fl = Math.floor(now * 24) % 2;
      ctx.fillStyle = fl ? '#ff9020' : '#e8401a';
      for (let i = 0; i < 10; i++) {
        const a = (i * 37 + Math.floor(now * 20) * 11) % 16, b = (i * 53 + Math.floor(now * 20) * 7) % 16;
        ctx.fillRect(px + a, py + b, 2, 2);
      }
      ctx.fillStyle = 'rgba(255,200,60,' + (0.5 * life).toFixed(2) + ')'; ctx.fillRect(px + 2, py + 2, 12, 12);
    } else if (c === 'B' || c === 'F' || c === 'S' || c === 'G') ctx.drawImage(SPR['p' + c], px, py);
  }
  const seen = new Set();
  for (const [bx, by, t, ox = 0, oy = 0, id] of s.b) {
    let x = bx + ox, y = by + oy;
    if (id != null) {   // glatt glidning hos klienter (snapshot kommer 20 ganger i sekundet)
      seen.add(id);
      let d = dispB[id];
      if (!d || Math.abs(d.x - x) > 2 || Math.abs(d.y - y) > 2) d = dispB[id] = { x, y };
      const k = net.role === 'client' ? Math.min(1, dt * 18) : 1;
      d.x += (x - d.x) * k; d.y += (y - d.y) * k; x = d.x; y = d.y;
    }
    drawBomb(Math.round((x + 1) * TS), Math.round((y + 1) * TS), t, now);
  }
  for (const id in dispB) if (!seen.has(+id)) delete dispB[id];
  for (const [i, k, t] of s.f) drawFlame((i % COLS + 1) * TS, (((i / COLS) | 0) + 1) * TS, k, t, now);
  const ps = s.p.slice().sort((a, b) => (disp[a[0]] ? disp[a[0]].y : a[2]) - (disp[b[0]] ? disp[b[0]].y : b[2]));
  for (const p of ps) {
    const [slot, x, y, alive, dch, moving, deathT] = p;
    let d = disp[slot];
    if (!d || Math.abs(d.x - x) > 2 || Math.abs(d.y - y) > 2) d = disp[slot] = { x, y };
    const k = net.role === 'client' ? Math.min(1, dt * 18) : 1;
    d.x += (x - d.x) * k; d.y += (y - d.y) * k;
    const px = Math.round((d.x + 1) * TS), py = Math.round((d.y + 1) * TS);
    if (!alive) {
      if (deathT > 1.1) continue;
      if (Math.floor(deathT * 12) % 2) continue;
      const sz = Math.max(2, Math.round(16 * (1 - deathT / 1.1)));
      ctx.drawImage(robotSprite(slot, 'down', 0), px + (16 - sz) / 2, py + (16 - sz), sz, sz);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 3, py + 13, 10, 3);
    const frame = moving ? (Math.floor(now * 8) % 2) : 0;
    ctx.drawImage(robotSprite(slot, DIRKEY[dch] || 'down', frame), px, py - 2 - (frame ? 1 : 0));
    if (slot === mySlot) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 7, py - 5, 2, 1); ctx.fillRect(px + 6, py - 6, 4, 1); }
  }
  const warn = s.ph === 'play' && s.tm > SD_START - 3 && s.tm < SD_START + 1;
  if (s.ph === 'play' && (s.tm < READY_TIME + 0.6 || warn)) {
    const txt = warn ? 'BRETTET KRYMPER!' : s.tm < READY_TIME ? 'KLAR …' : 'KJØR!';
    ctx.font = (warn ? 'bold 16px' : 'bold 22px') + ' "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(txt, cv.width / 2, cv.height / 2);
    ctx.fillStyle = '#ffd23a'; ctx.fillText(txt, cv.width / 2, cv.height / 2);
  }
}

// ---------- Lyd ----------
// Musikk og lydeffekter ligger i bbx.js (BBX).

// ---------- Input ----------
const keyStack = []; let bombSeq = 0;
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function pushDir(d) { const i = keyStack.indexOf(d); if (i >= 0) keyStack.splice(i, 1); keyStack.push(d); }
function popDir(d) { const i = keyStack.indexOf(d); if (i >= 0) keyStack.splice(i, 1); }
function curDir() { return keyStack.length ? keyStack[keyStack.length - 1] : null; }
const inGame = () => $('game').classList.contains('on');
window.addEventListener('keydown', e => {
  if (!inGame() || e.target.tagName === 'INPUT') return;
  if (KEYMAP[e.code]) { pushDir(KEYMAP[e.code]); e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'Enter') { if (!e.repeat) bombSeq++; e.preventDefault(); }
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) popDir(KEYMAP[e.code]); });
window.addEventListener('blur', () => { keyStack.length = 0; });
document.querySelectorAll('.dpad button').forEach(b => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); pushDir(d); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => popDir(d)));
});
$('tbomb').addEventListener('pointerdown', e => { e.preventDefault(); bombSeq++; });
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

// ---------- Rom og nettverk ----------
const net = { role: 'none', peer: null, conns: new Map(), hostConn: null };
const room = { code: '', members: [], scores: [0, 0, 0, 0], phase: 'lobby', board: {}, lb: [], round: 0 };
// Rommets toppliste: verten teller seire/runder/drap per navn så lenge rommet lever
function boardArr() {
  return Object.values(room.board).sort((a, b) => b.w - a.w || b.k - a.k || a.g - b.g).map(e => [e.n, e.w, e.g, e.k, e.b ? 1 : 0]);
}
function boardRows(lb) {
  return (lb || []).map(([n, w, g, k, b]) => {
    const m = room.members.find(m => m.name === n);
    return { n, w, g, k, b: !!b, c: m ? COLORS[m.slot].c : null, me: !!(m && m.slot === mySlot && !m.bot) };
  });
}
function boardPanel(lb, title) {
  const d = document.createElement('div'); d.className = 'bbx-board';
  const h = document.createElement('h2'); h.textContent = title; d.appendChild(h);
  d.appendChild(BBX.table(boardRows(lb))); return d;
}
function hostScoreRound(g) {
  for (const p of g.players) {
    const e = room.board[p.name] || (room.board[p.name] = { n: p.name, w: 0, g: 0, k: 0, b: !!p.bot });
    e.g++; if (g.winner === p.slot) e.w++; e.k += g.kills[p.slot] || 0;
  }
  room.lb = boardArr();
}
let mySlot = 0, game = null, lastSnap = null, lastEx = 0;

function isDefaultName(n) { return /^spiller( ?\d+)?$/i.test(String(n || '').trim()); }
function myName() {
  let n = ($('name').value || '').trim().slice(0, 12);
  // Tomt felt gir standardnavnet, men det lagres ikke – feltet skal ikke fylles med «Spiller» neste gang
  try { if (n && !isDefaultName(n)) localStorage.setItem('bk-name', n); else localStorage.removeItem('bk-name'); } catch (e) { }
  return n || 'Spiller';
}
function show(id) { if (id === 'menu') BBX.renderMenu(); document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function menuErr(t) { $('menuErr').textContent = t || ''; }
function genCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]; return s; }
function parseCode(v) {
  v = (v || '').trim();
  const m = v.match(/[?&]rom=([A-Za-z0-9]+)/);
  if (m) v = m[1];
  v = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v.length >= 4 && v.length <= 8 ? v : '';
}
function shareUrl() { return location.origin + location.pathname + '?rom=' + room.code; }

function resetNet() {
  try { if (net.peer) net.peer.destroy(); } catch (e) { }
  net.role = 'none'; net.peer = null; net.conns.clear(); net.hostConn = null;
  game = null; lastSnap = null; room.members = []; room.scores = [0, 0, 0, 0]; room.phase = 'lobby'; room.code = ''; room.board = {}; room.lb = []; room.round = 0;
  for (const k in disp) delete disp[k];
}
function leave(msg) {
  resetNet(); show('menu'); menuErr(msg || '');
  if (location.search) history.replaceState(null, '', location.pathname);
}

// --- Vert ---
function freeSlot() { for (let s = 0; s < 4; s++) if (!room.members.some(m => m.slot === s)) return s; return -1; }
function lobbyMsg() { return { t: 'lobby', lb: boardArr(), code: room.code, phase: room.phase, members: room.members.map(m => ({ slot: m.slot, name: m.name, bot: !!m.bot })) }; }
function broadcast(msg) { for (const c of net.conns.values()) { if (c.open) { try { c.send(msg); } catch (e) { } } } }
function hostLobbyUpdate() { broadcast(lobbyMsg()); renderLobby(); }

function startHosting(offline) {
  resetNet();
  net.role = 'host'; mySlot = 0;
  room.members = [{ slot: 0, name: myName(), bot: false, me: true }];
  if (offline) {
    room.code = '';
    for (let i = 0; i < 3; i++) addBot();
    startRound();
    return;
  }
  menuErr('Lager rom …');
  const tryOpen = (attempt) => {
    const code = genCode();
    const peer = new Peer(PEER_PREFIX + code, { debug: 1 });
    net.peer = peer;
    peer.on('open', () => {
      room.code = code; menuErr('');
      history.replaceState(null, '', '?rom=' + code);
      show('lobby'); renderLobby();
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && attempt < 5) { peer.destroy(); tryOpen(attempt + 1); return; }
      if (e.type === 'peer-unavailable') return;
      if (!room.code) { leave('Klarte ikke å lage rom (' + e.type + '). Sjekk nettet og prøv igjen.'); }
      else console.warn('PeerJS-feil', e);
    });
    peer.on('disconnected', () => { if (net.peer === peer && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) { } }, 1000); });
    peer.on('connection', conn => {
      conn.on('data', d => hostOnData(conn, d));
      conn.on('close', () => hostDrop(conn));
      conn.on('error', () => hostDrop(conn));
    });
  };
  tryOpen(0);
}
function addBot() {
  const s = freeSlot(); if (s < 0) return;
  room.members.push({ slot: s, name: 'Robo-' + COLORS[s].n, bot: true });
  room.members.sort((a, b) => a.slot - b.slot);
}
function hostOnData(conn, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hello') {
    if (net.conns.has(conn.peer)) return;
    let s = freeSlot();
    if (s < 0) {
      const bot = room.members.filter(m => m.bot).pop();
      if (bot && room.phase !== 'play') { room.members = room.members.filter(m => m !== bot); s = freeSlot(); }
    }
    if (s < 0) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
    const name = String(d.name || '').trim().slice(0, 12) || ('Spiller ' + (s + 1));
    room.members.push({ slot: s, name, bot: false, conn, peerId: conn.peer, input: { dir: null }, lastBs: 0 });
    room.members.sort((a, b) => a.slot - b.slot);
    net.conns.set(conn.peer, conn);
    conn.send({ t: 'welcome', slot: s });
    hostLobbyUpdate();
    if (room.phase !== 'lobby' && game) conn.send(snapshot(game));
  } else if (d.t === 'in') {
    const m = room.members.find(m => m.peerId === conn.peer); if (!m) return;
    const dir = DIRS[d.d] ? d.d : null;
    m.input.dir = dir;
    const p = game && game.players.find(p => p.slot === m.slot);
    if (p) { p.input.dir = dir; if (typeof d.b === 'number' && d.b > m.lastBs) p.input.bomb = true; }
    if (typeof d.b === 'number') m.lastBs = Math.max(m.lastBs, d.b);
  }
}
function hostDrop(conn) {
  if (!net.conns.has(conn.peer)) return;
  net.conns.delete(conn.peer);
  const m = room.members.find(m => m.peerId === conn.peer);
  if (m) {
    room.members = room.members.filter(x => x !== m);
    const p = game && game.players.find(p => p.slot === m.slot);
    if (p && p.alive) { p.alive = false; p.deathT = 0; }
    room.scores[m.slot] = 0;
  }
  hostLobbyUpdate();
}
function startRound() {
  if (room.members.length < 2) { $('lobbyErr').textContent = 'Dere må være minst to. Legg til en bot eller vent på venner.'; return; }
  $('lobbyErr').textContent = '';
  game = new Game(room.members);
  for (const m of room.members) if (m.peerId) m.lastBs = m.lastBs || 0;
  room.phase = 'play'; room.round++; scored = false; localBs = bombSeq;
  for (const k in disp) delete disp[k];
  show('game'); $('over').classList.remove('on');
  lastSnap = snapshot(game);
  broadcast(lobbyMsg()); broadcast(lastSnap);
}
let scored = false, localBs = 0, sendAcc = 0;
function hostTick(dt) {
  if (!game) return;
  const me = game.players.find(p => p.slot === 0);
  if (me) { me.input.dir = curDir(); if (bombSeq > localBs) { localBs = bombSeq; me.input.bomb = true; } }
  let left = Math.min(dt, 0.25);
  while (left > 0) { const h = Math.min(left, 1 / 60); game.step(h); left -= h; }
  if (game.phase === 'over' && !scored) { scored = true; if (game.winner >= 0) room.scores[game.winner]++; hostScoreRound(game); room.phase = 'over'; }
  lastSnap = snapshot(game);
  sendAcc += dt;
  if (sendAcc >= 0.05) { sendAcc = 0; if (net.conns.size) broadcast(lastSnap); }
}

// --- Klient ---
let joinTimer = null, lastSent = '', lastSentT = 0;
function joinRoom(code) {
  if (!code) { menuErr('Skriv inn en gyldig romkode eller lenke.'); return; }
  resetNet();
  net.role = 'client'; room.code = code;
  menuErr('Kobler til rom ' + code + ' …');
  const peer = new Peer({ debug: 1 });
  net.peer = peer;
  clearTimeout(joinTimer);
  joinTimer = setTimeout(() => { if (net.role === 'client' && !net.hostConn?.open) leave('Fikk ikke kontakt med rom ' + code + '. Sjekk koden, eller prøv igjen.'); }, 20000);
  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
    net.hostConn = conn;
    conn.on('open', () => { conn.send({ t: 'hello', name: isDefaultName(myName()) ? '' : myName() }); });
    conn.on('data', clientOnData);
    conn.on('close', () => { if (net.role === 'client') leave('Forbindelsen til verten ble brutt.'); });
    conn.on('error', () => { });
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') leave('Fant ikke rom ' + code + '. Er koden riktig, og er verten fortsatt i rommet?');
    else if (net.role === 'client' && !net.hostConn?.open) leave('Tilkoblingsfeil (' + e.type + '). Prøv igjen.');
  });
}
function clientOnData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'welcome') { clearTimeout(joinTimer); mySlot = d.slot; menuErr(''); show('lobby'); }
  else if (d.t === 'full') leave('Rommet er fullt (maks fire spillere).');
  else if (d.t === 'lobby') {
    room.members = d.members; room.phase = d.phase; room.code = d.code; room.lb = d.lb || room.lb;
    if (d.phase === 'lobby') { show('lobby'); }
    renderLobby();
  } else if (d.t === 's') {
    lastSnap = d; room.scores = d.sc || room.scores; room.lb = d.lb || room.lb;
    if (!inGame() && room.members.some(m => m.slot === mySlot)) { for (const k in disp) delete disp[k]; show('game'); }
  }
}
function clientTick() {
  if (!net.hostConn || !net.hostConn.open) return;
  const msg = { t: 'in', d: curDir(), b: bombSeq };
  const key = msg.d + '|' + msg.b, now = performance.now();
  if (key !== lastSent || now - lastSentT > 250) {
    lastSent = key; lastSentT = now;
    try { net.hostConn.send(msg); } catch (e) { }
  }
}

// ---------- UI ----------
function slotIcon(slot) {
  const c = mk(16, 16); c.getContext('2d').drawImage(robotSprite(slot, 'down', 0), 0, 0);
  c.style.width = '40px'; c.style.height = '40px'; return c;
}
function renderLobby() {
  const host = net.role === 'host';
  $('lobbyCode').textContent = room.code || '—';
  $('lobbyTitle').textContent = host ? 'Ditt rom – del koden med venner' : 'Du er med i rom';
  $('shareLink').value = room.code ? shareUrl() : '';
  $('btnShare').style.display = navigator.share ? '' : 'none';
  const el = $('slots'); el.innerHTML = '';
  for (let s = 0; s < 4; s++) {
    const m = room.members.find(m => m.slot === s);
    const div = document.createElement('div'); div.className = 'slot' + (m ? '' : ' empty');
    div.appendChild(slotIcon(s));
    const t = document.createElement('div');
    t.innerHTML = m ? `<div class="nm"></div><div class="tag">${m.bot ? 'Bot' : (s === 0 ? 'Vert' : 'Spiller')}${s === mySlot && !m.bot ? ' · deg' : ''}</div>`
      : `<div class="nm">Ledig plass</div><div class="tag">Venter …</div>`;
    if (m) t.querySelector('.nm').textContent = m.name;
    div.appendChild(t); el.appendChild(div);
  }
  const rb = $('roomBoard'); rb.innerHTML = '';
  if (room.lb && room.lb.length) rb.appendChild(boardPanel(room.lb, 'BESTE I ROMMET'));
  $('hostCtl').style.display = host ? '' : 'none';
  $('btnStart').style.display = host ? '' : 'none';
  $('waitTxt').style.display = host ? 'none' : '';
  $('btnAddBot').disabled = room.members.length >= 4;
  $('btnDelBot').disabled = !room.members.some(m => m.bot);
  $('btnStart').disabled = room.members.length < 2;
  $('btnStart').textContent = room.members.length < 2 ? 'Start (trenger minst 2)' : 'Start';
}
let hudKey = '', overKey = '';
function updateHud(s) {
  const key = JSON.stringify(s.p.map(p => [p[0], p[3], p[7], p[8], p[9], p[10], p[12]]));
  if (key !== hudKey) {
    hudKey = key; const hud = $('hud'); hud.innerHTML = '';
    for (const p of s.p) {
      const d = document.createElement('div'); d.className = 'hp' + (p[3] ? '' : ' dead');
      d.innerHTML = `<i style="background:${COLORS[p[0]].c}"></i><b></b><span>💣${p[7]} 🔥${p[8]} ⚡${p[9]}${p[12] ? ' 🥊' : ''}</span>`;
      d.querySelector('b').textContent = p[10] + (p[0] === mySlot ? ' (deg)' : '');
      hud.appendChild(d);
    }
  }
  $('netInfo').textContent = net.role === 'host' && room.code ? 'Rom ' + room.code : net.role === 'client' ? 'Rom ' + room.code : 'Mot boter';
  const ov = $('over');
  if (s.ph === 'over') {
    const k = s.w + '|' + JSON.stringify(s.sc) + JSON.stringify(s.lb) + net.role;
    if (k !== overKey || !ov.classList.contains('on')) {
      overKey = k;
      const wp = s.p.find(p => p[0] === s.w);
      $('wintxt').textContent = wp ? (wp[0] === mySlot ? 'Du vant runden! 🏆' : wp[10] + ' vant runden!') : 'Uavgjort!';
      const tb = $('score'); tb.innerHTML = '';
      const rows = s.lb && s.lb.length ? s.lb : s.p.map(p => [p[10], s.w === p[0] ? 1 : 0, 1, p[13] || 0, p[11]]);
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.appendChild(boardPanel(rows, room.code ? 'BESTE I ROMMET' : 'STILLING')); tr.appendChild(td); tb.appendChild(tr);
      $('overHost').style.display = net.role === 'host' ? '' : 'none';
      $('btnToLobby').style.display = net.role === 'host' && room.code ? '' : 'none';
      $('overWait').style.display = net.role === 'host' ? 'none' : '';
      ov.classList.add('on');
    }
  } else ov.classList.remove('on');
}

$('btnCreate').onclick = () => startHosting(false);
$('btnSolo').onclick = () => startHosting(true);
$('btnJoin').onclick = () => joinRoom(parseCode($('joinCode').value));
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnJoinInvite').onclick = () => joinRoom(parseCode($('inviteCode').textContent));
$('btnAddBot').onclick = () => { addBot(); hostLobbyUpdate(); };
$('btnDelBot').onclick = () => {
  const b = room.members.filter(m => m.bot).pop();
  if (b) { room.members = room.members.filter(m => m !== b); room.scores[b.slot] = 0; hostLobbyUpdate(); }
};
$('btnStart').onclick = () => startRound();
$('btnAgain').onclick = () => startRound();
$('btnToLobby').onclick = () => { game = null; room.phase = 'lobby'; show('lobby'); hostLobbyUpdate(); };
$('btnLeaveLobby').onclick = () => leave('');
$('btnQuit').onclick = () => { if (confirm('Vil du avslutte spillet?')) leave(''); };
$('btnCopy').onclick = async () => {
  const v = $('shareLink').value;
  try { await navigator.clipboard.writeText(v); } catch (e) { $('shareLink').select(); document.execCommand('copy'); }
  $('btnCopy').textContent = 'Kopiert!'; setTimeout(() => $('btnCopy').textContent = 'Kopier lenke', 1500);
};
$('btnShare').onclick = () => { navigator.share({ title: 'BomberBoyz 2', text: 'Bli med på BomberBoyz 2! Romkode: ' + room.code, url: shareUrl() }).catch(() => { }); };

// Navn og invitasjon fra lenke
try { const saved = localStorage.getItem('bk-name') || ''; $('name').value = isDefaultName(saved) ? '' : saved; } catch (e) { }
// Lagret navn markeres når feltet får fokus, så det du skriver erstatter det med en gang
$('name').addEventListener('focus', e => { const el = e.target; setTimeout(() => { if (document.activeElement === el) el.select(); }, 0); });
const inviteCode = parseCode(new URLSearchParams(location.search).get('rom') || '');
if (inviteCode) { $('invitePanel').style.display = ''; $('inviteCode').textContent = inviteCode; $('joinCode').value = inviteCode; }

// ---------- Hovedløkke ----------
buildTiles();
let lastT = performance.now(), simLast = performance.now();
setInterval(() => {   // simulering/nett går også når fanen ikke tegner
  const now = performance.now(), dt = (now - simLast) / 1000; simLast = now;
  if (net.role === 'host') hostTick(dt);
  else if (net.role === 'client') clientTick();
}, 1000 / 60);
function frame() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (inGame() && lastSnap) {
    render(lastSnap, now / 1000, dt);
    updateHud(lastSnap);
    lastEx = lastSnap.ex;
  }
  if (lastSnap !== audSnap) { audioEvents(audSnap, lastSnap); audSnap = lastSnap; }
  BBX.music(!inGame() ? 'menu' : lastSnap && lastSnap.ph === 'play' && lastSnap.tm >= READY_TIME ? 'battle' : null);
  requestAnimationFrame(frame);
}
let audSnap = null, recorded = '';
function audioEvents(a, s) {
  if (!s || !s.p) return;
  if (a && (a.rn !== s.rn || s.tm < a.tm)) a = null;   // ny runde
  const pt = a ? a.tm : -1;
  if (s.ph === 'play') {
    if (pt < 0.05 && s.tm >= 0.05 || pt < 0.7 && s.tm >= 0.7) BBX.sfx('count');
    if (pt < READY_TIME && s.tm >= READY_TIME) BBX.sfx('go');
  }
  if (!a) return;
  const ids = new Set(a.b.map(b => b[5]));
  const prevSlide = new Map(a.b.map(b => [b[5], b[3] || b[4]]));
  for (const b of s.b) {
    if (!ids.has(b[5])) BBX.sfx('place');
    else if ((b[3] || b[4]) && !prevSlide.get(b[5])) BBX.sfx('kick');
  }
  if (s.ex > a.ex) BBX.sfx('boom');
  const burn = new Set(a.x.map(x => x[0]));
  if (s.x.some(x => !burn.has(x[0]))) BBX.sfx('wall');
  for (const p of s.p) {
    const q = a.p.find(q => q[0] === p[0]); if (!q) continue;
    if (q[3] && !p[3]) BBX.sfx('death');
    if (p[3] && (p[7] > q[7] || p[8] > q[8] || p[9] > q[9] || (p[12] && !q[12]))) BBX.sfx('pickup');
  }
  if (a.ph === 'play' && s.ph === 'over') {
    BBX.jingle(s.w >= 0 ? 'win' : 'draw');
    const key = room.code + '|' + net.role + '|' + s.rn;
    if (recorded !== key) {
      recorded = key;
      const players = s.p.map(p => ({ name: p[10], bot: !!p[11], win: s.w === p[0], kills: p[13] || 0 }));
      BBX.recordLocal(players);
      if (net.role === 'host' && room.code) BBX.submitGlobal(room.code, s.rn, players);
    }
  }
}
requestAnimationFrame(frame);

// Lesetilgang for testing
window.bomberboyz = { get snap() { return lastSnap; }, get game() { return game; }, get role() { return net.role; }, get slot() { return mySlot; }, get members() { return room.members; } };
})();
