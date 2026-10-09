/* Super BomberBoyz – video- og lydchat (prototype).
   Full mesh av PeerJS MediaConnections mellom alle menneskelige spillere i rommet.
   Spill-løkka og datakanalen til verten er uavhengige av dette. */
'use strict';
window.BBAV = (() => {
const COLORS = ['#e8483c', '#3c7ae8', '#f0c020', '#a050e0'];
const AUDIO_C = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_C = { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 }, facingMode: 'user' };
const OFFER_C = { offerToReceiveAudio: true, offerToReceiveVideo: true };
const MAX_VIDEO_BPS = 250000;
const $ = id => document.getElementById(id);

const S = {
  active: false, peer: null, myId: '', mySlot: 0, local: null, mediaP: null,
  hasA: false, hasV: false, micOn: true, camOn: true, hidden: false, needTap: false,
  members: [], remotes: new Map(), retryAt: new Map(), fails: new Map(), tiles: new Map(),
  actx: null, meters: new Map(), timer: 0, onState: null, icon: null, status: '',
};
const log = (...a) => { if (window.BBAV_DEBUG) console.log('[av]', ...a); };

// ---------- Lokale medier ----------
async function gum(c) { return navigator.mediaDevices.getUserMedia(c); }
async function acquire() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    S.status = 'Kamera og mikrofon er ikke tilgjengelig her. Du ser og hører de andre.';
    return new MediaStream();
  }
  const tries = [
    [{ audio: AUDIO_C, video: VIDEO_C }, ''],
    [{ audio: AUDIO_C }, 'Fikk ikke kamera, bare mikrofon.'],
  ];
  let lastErr = null;
  for (const [c, note] of tries) {
    try { const st = await gum(c); S.status = note; return st; } catch (e) { lastErr = e; log('gUM feilet', e.name); }
  }
  log('gUM sluttfeil', lastErr && lastErr.name);
  S.errName = lastErr ? lastErr.name : '';
  const denied = lastErr && (lastErr.name === 'NotAllowedError' || lastErr.name === 'SecurityError');
  S.status = denied ? 'Du har ikke gitt tilgang til kamera og mikrofon. Spillet virker likevel, og du ser og hører de andre.'
    : 'Fant ikke kamera eller mikrofon. Du ser og hører de andre.';
  return new MediaStream();
}

function start() {
  if (S.active) return S.mediaP;
  S.active = true; S.micOn = true; S.camOn = true; S.needTap = false; S.status = 'Ber om kamera og mikrofon …';
  try { S.actx = S.actx || new (window.AudioContext || window.webkitAudioContext)(); if (S.actx.state === 'suspended') S.actx.resume(); } catch (e) { }
  renderCtl();
  S.mediaP = acquire().then(st => {
    if (!S.active) { st.getTracks().forEach(t => t.stop()); return; }
    S.local = st;
    S.hasA = st.getAudioTracks().length > 0; S.hasV = st.getVideoTracks().length > 0;
    S.micOn = S.hasA; S.camOn = S.hasV;
    renderTiles(); renderCtl(); emitState(); reconcile();
  });
  clearInterval(S.timer); S.timer = setInterval(tick, 100);
  return S.mediaP;
}

function stop() {
  S.active = false;
  for (const r of S.remotes.values()) { r.dead = true; try { r.call.close(); } catch (e) { } }
  S.remotes.clear(); S.retryAt.clear(); S.fails.clear();
  if (S.local) S.local.getTracks().forEach(t => t.stop());
  S.local = null; S.mediaP = null; S.hasA = S.hasV = false; S.members = []; S.peer = null; S.myId = '';
  for (const id of [...S.meters.keys()]) dropMeter(id);
  for (const id of [...S.tiles.keys()]) dropTile(id);
  clearInterval(S.timer); S.timer = 0;
  renderCtl();
}

function state() { return { mic: !!(S.hasA && S.micOn), cam: !!(S.hasV && S.camOn) }; }
function emitState() { if (S.onState) S.onState(state()); }

// ---------- Mesh ----------
function attachPeer(peer) {
  S.peer = peer;
  peer.on('call', call => {
    if (!S.active || peer !== S.peer) { try { call.close(); } catch (e) { } return; }
    log('innkommende samtale fra', call.peer);
    Promise.resolve(S.mediaP).then(() => {
      if (!S.active) { try { call.close(); } catch (e) { } return; }
      wire(call, call.peer);
      call.answer(S.local || new MediaStream());
      watchPc(call, call.peer);
    });
  });
}
function iAmCaller(id) { return S.myId && S.myId < id; }
function callPeer(id) {
  if (!S.peer || S.peer.destroyed || S.peer.disconnected) return;
  log('ringer', id);
  const call = S.peer.call(id, S.local || new MediaStream(), { metadata: { bbav: 1 }, constraints: OFFER_C });
  if (!call) return;
  wire(call, id); watchPc(call, id);
}
function wire(call, id) {
  const old = S.remotes.get(id);
  if (old && old.call !== call) { old.dead = true; try { old.call.close(); } catch (e) { } }
  const r = { call, id, stream: null, t0: Date.now(), dead: false, connected: false };
  S.remotes.set(id, r);
  call.on('stream', st => {
    if (r.dead) return;
    r.stream = st; r.connected = true; S.fails.delete(id); log('strøm fra', id, st.getTracks().map(t => t.kind));
    setTileStream(id, st); capBitrate(call);
  });
  const gone = () => {
    if (r.dead) return; r.dead = true;
    if (S.remotes.get(id) === r) {
      S.remotes.delete(id); setTileStream(id, null);
      const n = (S.fails.get(id) || 0) + (r.connected ? 0 : 1); S.fails.set(id, n);
      S.retryAt.set(id, Date.now() + Math.min(15000, 2000 * Math.pow(2, n)));
    }
  };
  call.on('close', gone); call.on('error', gone);
  r.gone = gone;
}
function watchPc(call, id) {
  const pc = call.peerConnection; if (!pc) return;
  pc.addEventListener('connectionstatechange', () => {
    const r = S.remotes.get(id); if (!r || r.call !== call) return;
    if (pc.connectionState === 'connected') { r.connected = true; capBitrate(call); updateTile(id); }
    if (pc.connectionState === 'failed') { try { call.close(); } catch (e) { } r.gone && r.gone(); }
  });
}
function capBitrate(call) {
  const pc = call.peerConnection; if (!pc || !pc.getSenders) return;
  for (const s of pc.getSenders()) {
    if (!s.track || s.track.kind !== 'video' || !s.getParameters) continue;
    try {
      const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      if (p.encodings[0].maxBitrate === MAX_VIDEO_BPS) continue;
      p.encodings[0].maxBitrate = MAX_VIDEO_BPS; s.setParameters(p).catch(() => { });
    } catch (e) { }
  }
}
function humans() { return S.members.filter(m => !m.bot && m.peerId); }
function reconcile() {
  if (!S.active || !S.local || !S.peer || !S.myId) return;
  const want = new Set(humans().map(m => m.peerId).filter(id => id !== S.myId));
  for (const [id, r] of S.remotes) if (!want.has(id)) { r.dead = true; S.remotes.delete(id); try { r.call.close(); } catch (e) { } }
  for (const id of [...S.retryAt.keys()]) if (!want.has(id)) S.retryAt.delete(id);
  const now = Date.now(), me = state();
  for (const id of want) {
    const r = S.remotes.get(id);
    if (r) {   // vaktbikkje: ingen forbindelse etter 20 s → prøv igjen
      if (!r.connected && now - r.t0 > 20000 && iAmCaller(id)) { try { r.call.close(); } catch (e) { } r.gone(); }
      continue;
    }
    if (!iAmCaller(id)) continue;
    const m = S.members.find(x => x.peerId === id);
    const them = (m && m.av) || { mic: true, cam: true };
    if (!S.hasA && !S.hasV && !them.mic && !them.cam && m && m.av) continue;   // ingen av oss har medier
    if ((S.retryAt.get(id) || 0) > now) continue;
    S.retryAt.delete(id);
    callPeer(id);
  }
  renderTiles();
}
function sync(members, myId, mySlot) {
  S.members = (members || []).map(m => ({ ...m })); S.myId = myId || S.myId; S.mySlot = mySlot;
  reconcile(); renderTiles();
}

// ---------- Av/på ----------
function toggleMic() {
  if (!S.hasA) return;
  S.micOn = !S.micOn;
  S.local.getAudioTracks().forEach(t => { t.enabled = S.micOn; });
  renderCtl(); updateTile('me'); emitState();
}
async function toggleCam() {
  if (!S.local) return;
  if (S.camOn) {
    S.camOn = false;
    for (const t of S.local.getVideoTracks()) { t.stop(); S.local.removeTrack(t); }
    for (const r of S.remotes.values()) for (const tr of transceivers(r, 'video')) { try { tr.sender.replaceTrack(null); } catch (e) { } }
  } else {
    let st;
    try { st = await gum({ video: VIDEO_C }); } catch (e) { S.status = 'Fikk ikke slått på kameraet (' + e.name + ').'; renderCtl(); return; }
    const t = st.getVideoTracks()[0]; S.local.addTrack(t); S.hasV = true; S.camOn = true; S.status = '';
    for (const r of [...S.remotes.values()]) {
      const tr = transceivers(r, 'video').find(x => /send/.test(x.currentDirection || x.direction || ''));
      if (tr) { tr.sender.replaceTrack(t).then(() => capBitrate(r.call)).catch(() => { }); }
      else { try { r.call.close(); } catch (e) { } r.gone && r.gone(); S.retryAt.set(r.id, 0); }   // må forhandles på nytt
    }
  }
  setLocalTile(); renderCtl(); emitState(); reconcile();
}
function transceivers(r, kind) {
  const pc = r.call && r.call.peerConnection; if (!pc || !pc.getTransceivers) return [];
  return pc.getTransceivers().filter(t => t.receiver && t.receiver.track && t.receiver.track.kind === kind && !t.stopped);
}
function toggleHide() { S.hidden = !S.hidden; renderCtl(); for (const id of S.tiles.keys()) updateTile(id); }
function tapForSound() {
  S.needTap = false;
  try { if (S.actx && S.actx.state === 'suspended') S.actx.resume(); } catch (e) { }
  for (const [id, t] of S.tiles) if (id !== 'me') { t.video.muted = false; t.video.play().catch(() => { }); }
  renderCtl();
}

// ---------- Fliser ----------
function memberFor(id) { return id === 'me' ? S.members.find(m => m.peerId === S.myId) || { slot: S.mySlot, name: 'Deg' } : S.members.find(m => m.peerId === id); }
function makeTile(id) {
  const el = document.createElement('div'); el.className = 'vt';
  el.innerHTML = '<video playsinline autoplay></video><div class="vt-av"></div><div class="vt-st"></div>' +
    '<div class="vt-nm"><i></i><span></span></div><div class="vt-mic" title="Mikrofonen er av">🔇</div><div class="vt-lvl"><b></b></div>';
  const video = el.querySelector('video');
  video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  if (id === 'me') { video.muted = true; el.classList.add('me'); }
  const t = { el, video, id, stream: null, slot: -1, lvl: 0 };
  S.tiles.set(id, t);
  return t;
}
function dropTile(id) {
  const t = S.tiles.get(id); if (!t) return;
  try { t.video.pause(); t.video.srcObject = null; } catch (e) { }
  t.el.remove(); S.tiles.delete(id); dropMeter(id);
}
function renderTiles() {
  const box = $('vtiles'); if (!box) return;
  if (!S.active) { box.innerHTML = ''; return; }
  const ids = ['me'].concat(humans().map(m => m.peerId).filter(id => id !== S.myId));
  for (const id of [...S.tiles.keys()]) if (!ids.includes(id)) dropTile(id);
  const ordered = ids.map(id => ({ id, m: memberFor(id) })).sort((a, b) => ((a.m && a.m.slot) || 0) - ((b.m && b.m.slot) || 0));
  for (const { id } of ordered) {
    let t = S.tiles.get(id);
    if (!t) { t = makeTile(id); if (id === 'me') setLocalTile(); else { const r = S.remotes.get(id); if (r && r.stream) setTileStream(id, r.stream); } }
    box.appendChild(t.el);   // flytter i riktig rekkefølge
    updateTile(id);
  }
  box.dataset.n = ordered.length;
}
function setLocalTile() {
  const t = S.tiles.get('me'); if (!t) return;
  t.stream = S.local;
  if (t.video.srcObject !== S.local) t.video.srcObject = S.local;
  t.video.play().catch(() => { });
  if (S.local && S.hasA) addMeter('me', S.local);
  updateTile('me');
}
function setTileStream(id, st) {
  const t = S.tiles.get(id);
  if (!t) { renderTiles(); if (!S.tiles.get(id)) return; return setTileStream(id, st); }
  t.stream = st;
  if (!st) { t.video.srcObject = null; dropMeter(id); updateTile(id); return; }
  if (t.video.srcObject !== st) t.video.srcObject = st;
  t.video.muted = S.needTap;
  const p = t.video.play();
  if (p && p.catch) p.catch(e => {
    if (e && e.name === 'NotAllowedError') { S.needTap = true; t.video.muted = true; t.video.play().catch(() => { }); renderCtl(); }
  });
  if (st.getAudioTracks().length) addMeter(id, st);
  t.video.onresize = () => updateTile(id);
  st.onaddtrack = () => { if (st.getAudioTracks().length) addMeter(id, st); updateTile(id); };
  updateTile(id);
}
function updateTile(id) {
  const t = S.tiles.get(id); if (!t) return;
  const m = memberFor(id), slot = m ? m.slot : 0;
  t.el.style.setProperty('--c', COLORS[slot] || '#888');
  if (t.slot !== slot && S.icon) { const a = t.el.querySelector('.vt-av'); a.innerHTML = ''; a.appendChild(S.icon(slot)); t.slot = slot; }
  t.el.querySelector('.vt-nm span').textContent = (m ? m.name : 'Spiller') + (id === 'me' ? ' (deg)' : '');
  let cam, mic, st = '';
  if (id === 'me') { const s = state(); cam = s.cam; mic = s.mic; if (!S.local) st = 'Starter …'; }
  else {
    const av = (m && m.av) || { mic: true, cam: true }, r = S.remotes.get(id);
    const vt = t.stream && t.stream.getVideoTracks().find(x => x.readyState === 'live');
    cam = !!(av.cam && vt); mic = !!av.mic;
    if (!r) st = 'Kobler til …';
    else if (!r.connected) st = 'Kobler til …';
    else if (!av.cam && !av.mic) st = 'Uten kamera';
  }
  t.el.classList.toggle('cam', !!cam && !S.hidden);
  t.el.classList.toggle('mute', !mic);
  t.el.querySelector('.vt-st').textContent = st;
}

// ---------- Lydnivå (snakker-indikator) ----------
function addMeter(id, st) {
  if (!S.actx || S.meters.has(id)) return;
  const tr = st.getAudioTracks()[0]; if (!tr) return;
  try {
    const src = S.actx.createMediaStreamSource(new MediaStream([tr]));
    const an = S.actx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.3;
    src.connect(an);
    S.meters.set(id, { src, an, buf: new Uint8Array(an.fftSize), lvl: 0, track: tr });
  } catch (e) { log('måler feilet', e); }
}
function dropMeter(id) { const m = S.meters.get(id); if (!m) return; try { m.src.disconnect(); } catch (e) { } S.meters.delete(id); }
function tick() {
  if (!S.active) return;
  if (S.actx && S.actx.state === 'suspended' && !S.needTap) { /* venter på trykk */ }
  for (const [id, m] of S.meters) {
    const t = S.tiles.get(id); if (!t) continue;
    if (m.track.readyState === 'ended') { dropMeter(id); continue; }
    m.an.getByteTimeDomainData(m.buf);
    let sum = 0; for (let i = 0; i < m.buf.length; i++) { const v = (m.buf[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / m.buf.length);
    const on = id === 'me' ? S.micOn : !t.el.classList.contains('mute');
    const lvl = on ? Math.min(1, rms * 6) : 0;
    m.lvl = Math.max(lvl, m.lvl * 0.8);
    t.el.style.setProperty('--lvl', m.lvl.toFixed(2));
    t.el.classList.toggle('talk', m.lvl > 0.12);
    t.lvl = m.lvl;
  }
  if (Math.random() < 0.05) reconcile();   // ca. hvert 2. sekund
}

// ---------- Kontroller ----------
function renderCtl() {
  const bar = $('avbar'); if (!bar) return;
  bar.classList.toggle('on', S.active);
  bar.classList.toggle('hid', S.hidden);
  const mic = $('avMic'), cam = $('avCam'), hide = $('avHide');
  mic.disabled = !S.hasA; cam.disabled = !S.local || (!S.hasV && !S.camOn && !navigator.mediaDevices);
  mic.classList.toggle('off', !(S.hasA && S.micOn)); mic.innerHTML = (S.hasA && S.micOn) ? '🎤 <span>Mikrofon på</span>' : '🔇 <span>Mikrofon av</span>';
  const camOn = S.hasV && S.camOn;
  cam.classList.toggle('off', !camOn); cam.innerHTML = camOn ? '📷 <span>Kamera på</span>' : '🚫 <span>Kamera av</span>';
  hide.classList.toggle('off', S.hidden); hide.innerHTML = S.hidden ? '👁 <span>Vis video</span>' : '🙈 <span>Skjul video</span>';
  $('avTap').style.display = S.needTap ? '' : 'none';
  $('avStatus').textContent = S.status || '';
}
function init(opts) {
  S.icon = opts && opts.icon;
  $('avMic').onclick = toggleMic; $('avCam').onclick = toggleCam; $('avHide').onclick = toggleHide; $('avTap').onclick = tapForSound;
  // iOS: første trykk hvor som helst låser opp lyden
  window.addEventListener('pointerdown', () => { if (S.needTap) tapForSound(); else if (S.actx && S.actx.state === 'suspended') S.actx.resume(); }, { passive: true });
  renderCtl();
}

return {
  init, start, stop, attachPeer, sync, state,
  set onState(f) { S.onState = f; },
  get debug() {
    const out = {};
    for (const [id, t] of S.tiles) {
      const st = t.stream;
      out[id] = { w: t.video.videoWidth, h: t.video.videoHeight, a: st ? st.getAudioTracks().length : 0, v: st ? st.getVideoTracks().length : 0,
        live: st ? st.getTracks().filter(x => x.readyState === 'live').length : 0, lvl: +(t.lvl || 0).toFixed(2), paused: t.video.paused, muted: t.video.muted };
    }
    return { active: S.active, myId: S.myId, hasA: S.hasA, hasV: S.hasV, mic: S.micOn, cam: S.camOn, remotes: [...S.remotes.keys()], errName: S.errName, connected: [...S.remotes.values()].filter(r => r.connected).length, tiles: out, status: S.status };
  },
};
})();
