/* Super BomberBoyz – lyd, musikk og toppliste. Felles for / og /legacy/.
   All musikk og alle lydeffekter er originale og lages med Web Audio mens spillet kjører
   (ingen lydfiler, ingen lånte melodier). */
'use strict';
window.BBX = (() => {
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  };

  // =====================================================================
  // Lyd
  // =====================================================================
  const LEVELS = [0.25, 0.5, 0.85];
  const snd = Object.assign({ vol: 0.5, muted: false }, store.get('bk-sound', {}));
  let ctx = null, master = null, musicBus = null, sfxBus = null, pulse = null, noiseBuf = null;
  let want = null, cur = null, seqTimer = null;
  const dbg = { started: false, music: null, sfx: {}, jingles: [] };

  function noteHz(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n); if (!m) return 0;
    const midi = (+m[3] + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function makePulse(duty) {   // 25 % pulsbølge – den klassiske «chiptune»-klangen
    const N = 32, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) { re[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI); im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI); }
    return ctx.createPeriodicWave(re, im);
  }
  function applyVol() {
    if (!master) return;
    master.gain.setTargetAtTime(snd.muted ? 0 : snd.vol * 0.6, ctx.currentTime, 0.03);
  }
  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
      pulse = makePulse(0.25);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVol();
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => { });
    dbg.started = true;
    if (want && !cur) startMusic(want);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, init, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => { }); else ctx.resume().catch(() => { });
  });
  const live = () => ctx && ctx.state === 'running';

  function tone(t, f, dur, g, wave, dest, f2) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    if (wave === 'pulse') o.setPeriodicWave(pulse); else o.type = wave;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.006);
    a.gain.setValueAtTime(g * 0.75, t + Math.max(0.01, dur * 0.4));
    a.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(a); a.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, g, freq, type, dest, freq2) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), a = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(a); a.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- Musikk (egne komposisjoner) ----------
  // Én token per sekstendel: tone (A4), «-» holder forrige tone, «.» er pause.
  // Trommer: k = stortromme, s = skarptromme, h = hihat, o = åpen hihat.
  const SONGS = {
    battle: { bpm: 150, loop: true, tracks: [
      { w: 'pulse', g: 0.30, n: `
        E5 - A5 - C6 - B5 A5 G5 - E5 - . . D5 E5
        F5 - A5 - C6 - A5 F5 G5 - A5 - . . G5 F5
        G5 - B5 - D6 - C6 B5 A5 - G5 - . . E5 G5
        G#5 - - - B5 - - - E6 - D6 - C6 - B5 -
        A5 . A5 C6 . A5 E5 . A5 . G5 A5 - - . .
        F5 . F5 A5 . F5 C5 . F5 . E5 F5 - - . .
        D5 - F5 - A5 - D6 - C6 - A5 - F5 - D5 -
        E5 - G#5 - B5 - E6 - D6 C6 B5 A5 G#5 - E5 -` },
      { w: 'square', g: 0.10, n: `
        A3 . . . C4 . . . E4 . . . C4 . . .
        A3 . . . C4 . . . F4 . . . C4 . . .
        B3 . . . D4 . . . G4 . . . D4 . . .
        B3 . . . E4 . . . G#4 . . . E4 . . .
        A3 . . . C4 . . . E4 . . . C4 . . .
        A3 . . . C4 . . . F4 . . . C4 . . .
        A3 . . . D4 . . . F4 . . . D4 . . .
        G#3 . . . B3 . . . E4 . . . B3 . . .` },
      { w: 'triangle', g: 0.55, n: `
        A2 . A3 . A2 . A3 . A2 . A3 . A2 . G2 .
        F2 . F3 . F2 . F3 . F2 . F3 . F2 . E2 .
        G2 . G3 . G2 . G3 . G2 . G3 . G2 . F#2 .
        E2 . E3 . E2 . E3 . E2 . E3 . D3 . B2 .
        A2 . A3 . A2 . A3 . A2 . A3 . A2 . G2 .
        F2 . F3 . F2 . F3 . F2 . F3 . F2 . E2 .
        D2 . D3 . D2 . D3 . D2 . D3 . D2 . C3 .
        E2 . E3 . E2 . E3 . E2 E2 E3 . G#2 . B2 .` },
      { d: 'k.h.s.h.k.k.s.hh k.h.s.h.k.h.s.ho' },
    ] },
    menu: { bpm: 112, loop: true, tracks: [
      { w: 'pulse', g: 0.24, n: `
        C5 - E5 G5 - E5 C5 - D5 - E5 - G5 - - -
        A4 - C5 E5 - C5 A4 - B4 - C5 - E5 - - -
        F4 - A4 C5 - A4 F4 - G4 - A4 - C5 - D5 -
        E5 - D5 - B4 - G4 - D5 - - - . . . .
        C5 - E5 G5 - E5 C5 - D5 - E5 - G5 - A5 -
        A4 - C5 E5 - C5 A4 - B4 - C5 - E5 - - -
        F4 - A4 C5 - F5 E5 - D5 - C5 - A4 - B4 -
        C5 - - - G4 - - - C5 - - - . . . .` },
      { w: 'triangle', g: 0.5, n: `
        C3 . G3 . C4 . G3 . C3 . G3 . C4 . G3 .
        A2 . E3 . A3 . E3 . A2 . E3 . A3 . E3 .
        F2 . C3 . F3 . C3 . G2 . D3 . G3 . D3 .
        G2 . D3 . G3 . D3 . G2 . B2 . D3 . B2 .
        C3 . G3 . C4 . G3 . C3 . G3 . C4 . G3 .
        A2 . E3 . A3 . E3 . A2 . E3 . A3 . E3 .
        F2 . C3 . F3 . C3 . G2 . D3 . G3 . D3 .
        C3 . G3 . C4 . G3 . C3 . . . . . . .` },
      { d: 'k...h...s...h... k...h...s...h.hh' },
    ] },
    win: { bpm: 180, loop: false, tracks: [
      { w: 'pulse', g: 0.3, n: 'C5 E5 G5 C6 - . G5 C6 - . E6 - - - D6 E6 G6 - - - - - - - . . . .' },
      { w: 'square', g: 0.1, n: 'E4 G4 C5 E5 - . C5 E5 - . G5 - - - F5 G5 C6 - - - - - - - . . . .' },
      { w: 'triangle', g: 0.55, n: 'C3 . C3 . C3 . G2 . G2 . C3 - - - G2 - C3 - - - - - - - . . . .' },
    ] },
    draw: { bpm: 140, loop: false, tracks: [
      { w: 'pulse', g: 0.28, n: 'G5 - F5 - E5 - D#5 - D5 - C#5 - C5 - - - - - . . . .' },
      { w: 'triangle', g: 0.5, n: 'C3 - - - B2 - - - A#2 - - - A2 - - - - - - - . . . .' },
    ] },
  };
  function parse(song) {
    if (song.parsed) return song.parsed;
    const tracks = song.tracks.map(tr => {
      if (tr.d) return { drum: tr.d.replace(/\s+/g, '').split('') };
      const tok = tr.n.trim().split(/\s+/), ev = {};
      for (let i = 0; i < tok.length; i++) {
        if (tok[i] === '.' || tok[i] === '-') continue;
        let len = 1; while (tok[i + len] === '-') len++;
        ev[i] = { f: noteHz(tok[i]), len };
      }
      return { ev, steps: tok.length, w: tr.w, g: tr.g };
    });
    const steps = Math.max(...tracks.map(t => t.drum ? t.drum.length : t.steps));
    return (song.parsed = { tracks, steps, sd: 60 / song.bpm / 4 });
  }
  function playStep(p, step, t, bus) {
    for (const tr of p.tracks) {
      if (tr.drum) {
        const c = tr.drum[step % tr.drum.length];
        if (c === 'k') { tone(t, 150, 0.12, 0.7, 'sine', bus, 45); }
        else if (c === 's') { noise(t, 0.12, 0.35, 1800, 'bandpass', bus); tone(t, 220, 0.06, 0.2, 'triangle', bus, 120); }
        else if (c === 'h') noise(t, 0.04, 0.12, 7000, 'highpass', bus);
        else if (c === 'o') noise(t, 0.16, 0.12, 6000, 'highpass', bus);
      } else {
        const e = tr.ev[step]; if (e) tone(t, e.f, e.len * p.sd * 0.92, tr.g, tr.w, bus);
      }
    }
  }
  function startMusic(name) {
    stopMusic();
    if (!ctx || !SONGS[name]) return;
    const p = parse(SONGS[name]), bus = ctx.createGain(); bus.connect(musicBus);
    const st = cur = { name, p, bus, step: 0, next: ctx.currentTime + 0.08 };
    dbg.music = name;
    seqTimer = setInterval(() => {
      if (cur !== st || ctx.state !== 'running') return;
      while (st.next < ctx.currentTime + 0.15) {
        playStep(p, st.step, st.next, bus);
        st.next += p.sd; st.step = (st.step + 1) % p.steps;
      }
      if (st.next < ctx.currentTime) st.next = ctx.currentTime + 0.02;   // tatt igjen etter pause
    }, 25);
  }
  function stopMusic() {
    clearInterval(seqTimer); seqTimer = null;
    if (cur) { const b = cur.bus; b.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => b.disconnect(), 400); }
    cur = null; dbg.music = null;
  }
  function music(name) {   // idempotent: kalles hver frame med ønsket låt (eller null)
    if (name === want) return;
    want = name;
    if (!ctx) return;
    if (name) startMusic(name); else stopMusic();
  }
  function jingle(name) {
    dbg.jingles.push(name);
    if (!live()) return;
    stopMusic(); want = null;
    const p = parse(SONGS[name]), bus = ctx.createGain(); bus.connect(musicBus);
    const t0 = ctx.currentTime + 0.05;
    for (let s = 0; s < p.steps; s++) playStep(p, s, t0 + s * p.sd, bus);
    setTimeout(() => bus.disconnect(), (p.steps * p.sd + 1) * 1000);
  }

  // ---------- Lydeffekter ----------
  const SFX = {
    place(t, b) { tone(t, 330, 0.07, 0.35, 'pulse', b, 160); tone(t + 0.05, 140, 0.06, 0.3, 'triangle', b); },
    boom(t, b) { noise(t, 0.6, 0.9, 1400, 'lowpass', b, 120); tone(t, 110, 0.35, 0.8, 'sine', b, 35); noise(t, 0.08, 0.4, 4000, 'highpass', b); },
    wall(t, b) { noise(t, 0.22, 0.35, 2500, 'bandpass', b, 600); noise(t + 0.06, 0.12, 0.2, 1200, 'bandpass', b); },
    pickup(t, b) { ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(t + i * 0.045, noteHz(n), 0.07, 0.28, 'pulse', b)); },
    kick(t, b) { noise(t, 0.06, 0.6, 900, 'lowpass', b); tone(t, 420, 0.12, 0.35, 'pulse', b, 900); },
    death(t, b) { tone(t, 880, 0.7, 0.32, 'pulse', b, 70); tone(t + 0.02, 440, 0.7, 0.18, 'square', b, 50); },
    count(t, b) { tone(t, 880, 0.12, 0.3, 'pulse', b); },
    go(t, b) { tone(t, 1760, 0.28, 0.32, 'pulse', b); tone(t, 880, 0.28, 0.2, 'square', b); },
  };
  const lastSfx = {};
  function sfx(name) {
    dbg.sfx[name] = (dbg.sfx[name] || 0) + 1;
    if (!live() || !SFX[name]) return;
    const now = ctx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < 0.04) return;   // mange like i samme øyeblikk: én lyd holder
    lastSfx[name] = now;
    SFX[name](now + 0.005, sfxBus);
  }

  // ---------- Lydknapp + M-tast ----------
  function sndIcon() { return snd.muted ? '🔇' : snd.vol <= 0.3 ? '🔈' : snd.vol <= 0.6 ? '🔉' : '🔊'; }
  function saveSnd() { store.set('bk-sound', { vol: snd.vol, muted: snd.muted }); applyVol(); const b = $('bbxSnd'); if (b) { b.textContent = sndIcon(); b.title = snd.muted ? 'Lyd av (M)' : 'Lydstyrke ' + Math.round(snd.vol * 100) + ' % (M = av/på)'; } }
  function toggleMute() { snd.muted = !snd.muted; saveSnd(); }
  function cycleVol() {   // 25 % → 50 % → 85 % → av → 25 % …
    if (snd.muted) { snd.muted = false; snd.vol = LEVELS[0]; }
    else { const i = LEVELS.findIndex(v => Math.abs(v - snd.vol) < 0.01); if (i === LEVELS.length - 1 || i < 0) snd.muted = true; else snd.vol = LEVELS[i + 1]; }
    saveSnd();
  }
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    toggleMute();
  });

  // =====================================================================
  // Toppliste
  // =====================================================================
  const LB_KEY = 'bk-top';
  const cleanName = n => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 12);
  function recordLocal(players) {   // players: [{ name, bot, win, kills }]
    const db = store.get(LB_KEY, {});
    for (const p of players) {
      if (p.bot) continue;
      const n = cleanName(p.name); if (!n) continue;
      const k = n.toLowerCase(), e = db[k] || (db[k] = { n, w: 0, g: 0, k: 0 });
      e.n = n; e.g++; if (p.win) e.w++; e.k += p.kills | 0; e.t = Date.now();
    }
    const keys = Object.keys(db);
    if (keys.length > 300) keys.sort((a, b) => (db[a].t || 0) - (db[b].t || 0)).slice(0, keys.length - 300).forEach(k => delete db[k]);
    store.set(LB_KEY, db);
    if (tab === 'local') renderMenu();
  }
  const sortRows = rows => rows.slice().sort((a, b) => b.w - a.w || (b.w / Math.max(1, b.g)) - (a.w / Math.max(1, a.g)) || b.k - a.k || a.g - b.g);
  function localTop(n = 10) { return sortRows(Object.values(store.get(LB_KEY, {}))).slice(0, n); }

  // Felles liste: skrus på i bbx-config.js. Klienten er den samme uansett tilbyder.
  const GC = (window.BBX_CONFIG && window.BBX_CONFIG.global) || {};
  const globalOn = !!(GC.url && GC.key);
  const base = String(GC.url || '').replace(/\/$/, '');
  function hdrs() {   // nye Supabase-nøkler (sb_publishable_…) sendes bare som apikey; gamle anon-JWT også som Bearer
    const h = { 'Content-Type': 'application/json', apikey: GC.key };
    if (!/^sb_/.test(GC.key)) h.Authorization = 'Bearer ' + GC.key;
    return h;
  }
  async function globalTop(n = 10) {
    if (!globalOn) return null;
    const url = GC.provider === 'worker' ? base + '/top?limit=' + n
      : base + '/rest/v1/leaderboard_top?select=name,wins,games,kills&limit=' + n;
    const r = await fetch(url, { headers: GC.provider === 'worker' ? {} : hdrs() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).map(x => ({ n: cleanName(x.name), w: x.wins | 0, g: x.games | 0, k: x.kills | 0 }));
  }
  // Bare verten sender, bare rom med minst to mennesker, og serveren validerer og begrenser.
  async function submitGlobal(room, round, players) {
    if (!globalOn) return;
    const humans = players.filter(p => !p.bot).map(p => ({ name: cleanName(p.name), win: !!p.win, kills: Math.max(0, Math.min(7, p.kills | 0)) }));
    if (humans.length < 2 || !room) return;
    const body = { p_room: String(room).slice(0, 8), p_round: round | 0, p_players: humans };
    try {
      const r = await fetch(GC.provider === 'worker' ? base + '/round' : base + '/rest/v1/rpc/submit_round',
        { method: 'POST', headers: GC.provider === 'worker' ? { 'Content-Type': 'application/json' } : hdrs(), body: JSON.stringify(body) });
      if (!r.ok) console.warn('Toppliste: innsending avvist', r.status);
    } catch (e) { console.warn('Toppliste: fikk ikke sendt resultat', e.message); }
  }

  function table(rows, opts = {}) {
    const t = document.createElement('table'); t.className = 'bbx-tab';
    const head = document.createElement('tr');
    head.innerHTML = '<th>#</th><th>Navn</th><th title="Seire">🏆</th><th title="Runder">Runder</th>' + (opts.kills === false ? '' : '<th title="Drap">💥</th>');
    t.appendChild(head);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr'); if (r.me) tr.className = 'me';
      tr.innerHTML = `<td class="rk r${i + 1}">${i + 1}</td><td class="nm"><span></span></td><td class="w">${r.w}</td><td>${r.g}</td>` + (opts.kills === false ? '' : `<td>${r.k}</td>`);
      const sp = tr.querySelector('.nm span'); sp.textContent = r.n;
      if (r.c) { const i2 = document.createElement('i'); i2.style.background = r.c; tr.querySelector('.nm').prepend(i2); }
      if (r.b) { const b = document.createElement('em'); b.textContent = 'BOT'; tr.querySelector('.nm').appendChild(b); }
      t.appendChild(tr);
    });
    return t;
  }
  let tab = 'local';
  async function renderMenu() {
    const box = $('lbList'); if (!box) return;
    const tabs = $('lbTabs'); if (tabs) tabs.style.display = globalOn ? '' : 'none';
    document.querySelectorAll('#lbTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const me = cleanName(($('name') && $('name').value) || '').toLowerCase();
    const put = (rows, empty) => {
      box.innerHTML = '';
      if (!rows || !rows.length) { const d = document.createElement('div'); d.className = 'bbx-empty'; d.textContent = empty; box.appendChild(d); return; }
      box.appendChild(table(rows.map(r => Object.assign({ me: me && r.n.toLowerCase() === me }, r))));
    };
    if (tab === 'global' && globalOn) {
      box.innerHTML = '<div class="bbx-empty">Henter …</div>';
      try { put(await globalTop(10), 'Ingen resultater ennå.'); }
      catch (e) { box.innerHTML = '<div class="bbx-empty">Fikk ikke hentet den felles listen akkurat nå.</div>'; }
    } else put(localTop(10), 'Ingen kamper på denne enheten ennå. Spill en runde, så dukker du opp her!');
  }
  function setupMenu() {
    document.querySelectorAll('#lbTabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderMenu(); }));
    renderMenu();
  }

  // =====================================================================
  // Stil (SNES-aktige menypaneler) + lydknapp
  // =====================================================================
  const css = `
  #bbxSnd { position:fixed; top:10px; right:10px; z-index:50; width:46px; height:46px; padding:0; font-size:22px; line-height:1;
    background:#7ec8ff; }
  .bbx-board { background: linear-gradient(180deg, #2a3f9a 0%, #1b2766 100%); border:4px solid #f1f1e8;
    outline:4px solid #000; box-shadow: 8px 8px 0 #000; padding:14px 14px 10px; margin:18px 4px 12px; }
  .bbx-board h2 { margin:0 0 10px; font-size:22px; letter-spacing:2px; color:#ffd23a; text-shadow: 3px 3px 0 #c0391b, 5px 5px 0 #000; text-align:center; }
  .bbx-board .hint { color:#dfe6ff; }
  #lbTabs { display:flex; gap:8px; margin-bottom:10px; }
  #lbTabs button { flex:1; font-size:14px; padding:7px 8px; background:#b8bec8; }
  #lbTabs button.on { background:#ffd23a; }
  .bbx-tab { width:100%; border-collapse:collapse; font-size:16px; text-shadow: 2px 2px 0 #000; }
  .bbx-tab th { font-size:12px; letter-spacing:1px; color:#9fd0ff; text-align:right; padding:2px 6px 6px; }
  .bbx-tab th:nth-child(2), .bbx-tab td.nm { text-align:left; }
  .bbx-tab td { padding:6px; text-align:right; border-top:2px solid rgba(255,255,255,.14); font-weight:bold; }
  .bbx-tab tr:nth-child(odd) td { background: rgba(0,0,0,.18); }
  .bbx-tab tr.me td { background: rgba(126,200,255,.28); }
  .bbx-tab tr.me td.nm span { color:#ffe9a0; }
  .bbx-tab td.w { color:#ffd23a; font-size:18px; }
  .bbx-tab td.rk { width:2.2em; text-align:center; color:#dfe6ff; }
  .bbx-tab td.r1 { color:#ffd23a; } .bbx-tab td.r2 { color:#e6ecf5; } .bbx-tab td.r3 { color:#ff9b4a; }
  .bbx-tab td.nm { max-width: 12em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .bbx-tab td.nm i { display:inline-block; width:12px; height:12px; margin-right:6px; vertical-align:-1px; box-shadow:2px 2px 0 #000; }
  .bbx-tab td.nm em { font-style:normal; font-size:10px; background:#b8bec8; color:#111; text-shadow:none; padding:1px 4px; margin-left:6px; vertical-align:2px; }
  .bbx-empty { text-align:center; padding:10px 4px; color:#dfe6ff; font-size:14px; line-height:1.5; }
  #over .bbx-board { margin:10px 0 14px; padding:10px; }
  #over .bbx-board h2 { font-size:16px; }
  #over .bbx-tab { font-size:15px; margin:0; }
  #over .bbx-tab td { text-align:right; border-bottom:none; padding:5px 6px; }
  #over .bbx-tab td.nm { text-align:left; }
  #over .bbx-tab td.rk { text-align:center; }
  #over #score > tr > td { padding:0; border:none; }
  `;
  function mountUi() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'bbxSnd'; b.type = 'button';
    b.addEventListener('click', e => { init(); cycleVol(); e.currentTarget.blur(); });
    document.body.appendChild(b); saveSnd();
    setupMenu();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUi); else mountUi();

  return {
    init, music, jingle, sfx, toggleMute, cycleVol, get sound() { return Object.assign({}, snd); },
    recordLocal, localTop, submitGlobal, globalTop, get globalOn() { return globalOn; }, table, renderMenu,
    get debug() { return Object.assign({ ctx: ctx ? ctx.state : 'none' }, dbg); },
  };
})();
