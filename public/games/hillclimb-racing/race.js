/* Hill Climb Racer – ONLINE RACE (phase 2).
   2-4 racers on the SAME seeded road. Each phone drives its own car; the others are drawn as translucent live "ghost" cars.
   Server (/api/race) = rooms, shared start time, finishing order. Positions go phone → Firestore → phones (≈5 updates/s, smoothed).
   Uses the game's globals (S, VEH, WORLDS, LEVELS, car, run, LV, mode, start, Hf, drawVeh, sfx, say, toast, save, showScr).
   The transport is isolated in `Net` so phase 3 (Bluetooth / hotspot / Wi-Fi) can plug in the same way. */
(function () {
  'use strict';
  var API = '/api/race', SEND_MS = 200, FB = 'https://www.gstatic.com/firebasejs/11.1.0/';
  var COLORS = ['#35c6ff', '#ff5a5a', '#7be08a', '#ffd33d'];
  var R = window.Race = { on: false, hold: function () { return false; } };
  var fb = null, auth = null, fs = null, user = null, skew = 0;
  var code = '', room = null, view = 'menu', msg = '', busy = false;
  var unsubRoom = null, unsubCars = null, sendT = 0, hudT = 0, dogT = 0, tickT = 0;
  var ghosts = {}, me = { fin: false, safe: 0 }, awarded = {}, closing = false, lastStatus = '';
  var $q = function (s) { return document.querySelector(s); };
  var sNow = function () { return Date.now() + skew; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var vname = function (i) { var v = VEH[i]; return (v && (v.n || v.name)) || 'Car'; };
  var fmt = function (ms) { var s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); };

  /* ---------- network: sign-in, API, Firestore ---------- */
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('Could not load online files. Check your internet.')); }; document.head.appendChild(s); }); }
  var Net = {
    init: async function () {
      if (fb) return;
      if (!navigator.onLine) throw new Error('No internet. Online race needs a connection.');
      var res = await fetch(API, { cache: 'no-store' }); var d = await res.json().catch(function () { return {}; });
      if (!res.ok || !d.cfg) throw new Error(d.error || 'Online play is not available right now.');
      skew = d.serverNow - Date.now();
      await loadScript(FB + 'firebase-app-compat.js'); await loadScript(FB + 'firebase-auth-compat.js'); await loadScript(FB + 'firebase-firestore-compat.js');
      fb = window.firebase; fb.initializeApp(d.cfg); auth = fb.auth(); fs = fb.firestore();
      await new Promise(function (ok) { var off = auth.onAuthStateChanged(function (u) { user = u; off(); ok(); }); setTimeout(ok, 6000); });
    },
    call: async function (body) {
      if (!user) throw new Error('Sign in to Afro Zone first, then come back to race.');
      var token = await user.getIdToken(), t0 = Date.now();
      var res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
      var d = await res.json().catch(function () { return {}; });
      if (d && isFinite(d.serverNow)) skew = d.serverNow - (t0 + Date.now()) / 2;
      if (!res.ok) throw new Error(d.error || 'Request failed (' + res.status + ')');
      return d;
    },
    roomRef: function (c) { return fs.collection('raceRooms').doc(c); },
  };

  /* ---------- overlay UI ---------- */
  function css() {
    if ($q('#rc-css')) return; var st = document.createElement('style'); st.id = 'rc-css';
    st.textContent = '#rc{position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;background:rgba(5,10,24,.78);backdrop-filter:blur(6px);font-family:system-ui,Arial,sans-serif;color:#fff;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}' +
      '#rc .p{width:min(94vw,520px);max-height:96vh;overflow:auto;background:linear-gradient(180deg,#16284a,#0b1630);border:2px solid #243a63;border-radius:18px;padding:clamp(12px,3vh,22px);box-shadow:0 10px 40px #000a}' +
      '#rc h1{margin:0 0 6px;font-size:clamp(18px,4.5vh,26px);letter-spacing:2px;text-align:center}#rc .s{opacity:.75;font-size:clamp(11px,2.6vh,14px);text-align:center;margin-bottom:10px}' +
      '#rc .b{display:block;width:100%;margin:8px 0 0;padding:clamp(9px,2.2vh,14px);border-radius:12px;border:2px solid #243a63;background:linear-gradient(180deg,#1d3560,#10203f);color:#fff;font:800 clamp(13px,3vh,17px) system-ui,Arial;letter-spacing:1px;cursor:pointer}' +
      '#rc .b.y{background:linear-gradient(180deg,#ffd33d,#f29a1c);color:#2a1700;border-color:#a35f00}#rc .b[disabled]{opacity:.45}' +
      '#rc input,#rc select{width:100%;box-sizing:border-box;margin-top:8px;padding:10px;border-radius:10px;border:2px solid #243a63;background:#0a1328;color:#fff;font:700 clamp(13px,3vh,16px) system-ui,Arial}#rc input{text-align:center;text-transform:uppercase;letter-spacing:6px}' +
      '#rc .row{display:flex;gap:8px}#rc .row>*{flex:1}#rc .code{font:900 clamp(30px,8vh,48px) monospace;letter-spacing:10px;text-align:center;color:#ffd33d;margin:2px 0 4px}' +
      '#rc .pl{display:flex;align-items:center;gap:10px;margin:6px 0;padding:8px 10px;border-radius:10px;background:#0a1328}#rc .dot{width:14px;height:14px;border-radius:50%}#rc .pl small{opacity:.65;margin-left:auto}' +
      '#rc .err{color:#ff8a8a;text-align:center;font-size:13px;min-height:16px;margin-top:6px}' +
      '#rchud{position:fixed;left:50%;top:calc(max(6px,env(safe-area-inset-top)) + 46px);transform:translateX(-50%);z-index:60;pointer-events:none;font:800 12px system-ui,Arial;color:#fff;min-width:200px;max-width:46vw;background:rgba(5,10,24,.62);border-radius:10px;padding:6px 9px;text-shadow:0 1px 2px #000}' +
      '#rchud .r{display:flex;align-items:center;gap:6px;margin:2px 0}#rchud .bar{flex:1;height:6px;border-radius:3px;background:#ffffff30;overflow:hidden}#rchud .bar i{display:block;height:100%}#rchud .me{color:#ffd33d}' +
      '#rccd{position:fixed;inset:0;z-index:9980;display:flex;align-items:center;justify-content:center;pointer-events:none;font:900 clamp(60px,26vh,200px) Arial;color:#fff;text-shadow:0 6px 0 #1a3a8a,0 0 40px #35c6ff}';
    document.head.appendChild(st);
  }
  function overlay() { var o = $q('#rc'); if (!o) { o = document.createElement('div'); o.id = 'rc'; document.body.appendChild(o); } return o; }
  function closeOverlay() { var o = $q('#rc'); if (o) o.remove(); }
  function render() {
    if (view === 'none') { closeOverlay(); return; }
    css(); var o = overlay(), h = '';
    var err = msg ? '<div class="err">' + esc(msg) + '</div>' : '<div class="err"></div>';
    if (view === 'menu') {
      h = '<h1>ONLINE RACE</h1><div class="s">Race friends on the same road, live. 2 to 4 racers.</div>' +
        '<button class="b y" data-r="create"' + (busy ? ' disabled' : '') + '>CREATE ROOM</button>' +
        '<input id="rcCode" maxlength="5" placeholder="CODE" autocomplete="off" autocapitalize="characters">' +
        '<button class="b" data-r="join"' + (busy ? ' disabled' : '') + '>JOIN WITH CODE</button>' + err + '<button class="b" data-r="back">BACK</button>';
    } else if (view === 'room' && room) {
      var host = room.host === user.uid, pl = room.players.map(function (u, i) {
        return '<div class="pl"><span class="dot" style="background:' + COLORS[i % 4] + '"></span><b>' + esc(room.names[u]) + (u === room.host ? ' ★' : '') + (u === user.uid ? ' (you)' : '') + '</b><small>' + esc(vname(room.veh[u])) + '</small></div>';
      }).join('');
      var wopts = WORLDS.map(function (w, i) { return '<option value="' + i + '"' + (i === room.world ? ' selected' : '') + '>' + esc(w.name || w.n || ('World ' + (i + 1))) + '</option>'; }).join('');
      var lopts = ''; for (var l = 0; l < LEVELS; l++) lopts += '<option value="' + l + '"' + (l === room.level ? ' selected' : '') + '>Level ' + (l + 1) + '</option>';
      var wn = WORLDS[room.world] ? (WORLDS[room.world].name || WORLDS[room.world].n || '') : '';
      h = '<h1>ROOM</h1><div class="code">' + esc(room.code) + '</div><div class="s">Share this code · ' + room.players.length + '/4 racers</div>' + pl +
        (host ? '<div class="row"><select id="rcW">' + wopts + '</select><select id="rcL">' + lopts + '</select></div>' : '<div class="s">Road: ' + esc(wn) + ' · Level ' + (room.level + 1) + '</div>') +
        (host ? '<button class="b y" data-r="start"' + (room.players.length < 2 || busy ? ' disabled' : '') + '>START RACE</button>' : '<div class="s">Waiting for the host to start…</div>') +
        '<button class="b" data-r="share">SHARE CODE</button>' + err + '<button class="b" data-r="leave">LEAVE ROOM</button>';
    } else if (view === 'result' && room) {
      var rs = room.results.slice(), rk = rs.map(function (r, i) {
        return '<div class="pl"><b style="width:26px">' + (i + 1) + '</b><span class="dot" style="background:' + COLORS[Math.max(0, room.players.indexOf(r.uid)) % 4] + '"></span><b>' + esc(room.names[r.uid] || 'Racer') + (r.uid === user.uid ? ' (you)' : '') + '</b><small>' + fmt(r.ms) + '</small></div>';
      }).join('');
      (room.dnf || []).forEach(function (u) { rk += '<div class="pl"><b style="width:26px">–</b><b>' + esc(room.names[u] || 'Racer') + '</b><small>DNF</small></div>'; });
      var mine = rs.findIndex(function (r) { return r.uid === user.uid; }), bonus = mine < 0 ? 0 : [300, 150, 100, 60][Math.min(3, mine)];
      h = '<h1>' + (mine === 0 ? 'YOU WIN!' : mine > 0 ? 'FINISHED #' + (mine + 1) : 'RACE OVER') + '</h1><div class="s">' + (bonus ? '+' + bonus + ' coins' : 'Better luck next time') + '</div>' + rk +
        (room.host === user.uid ? '<button class="b y" data-r="again">RACE AGAIN</button>' : '<div class="s">Waiting for the host to restart…</div>') + err + '<button class="b" data-r="leave">LEAVE ROOM</button>';
    }
    o.innerHTML = '<div class="p">' + h + '</div>';
  }
  var setMsg = function (m) { msg = m || ''; if (view !== 'none') render(); };

  /* ---------- actions ---------- */
  async function guard(fn) { if (busy) return; busy = true; setMsg(''); render(); try { await fn(); } catch (e) { msg = e.message || 'Problem, try again'; } busy = false; if (view !== 'none') render(); }
  var level0 = function () { var w = S.world, p = (S.lp && S.lp[w]) || 0; return { world: w, level: Math.min(LEVELS - 1, p * 10) }; };

  R.open = async function () {
    css(); view = 'menu'; msg = ''; render();
    try { busy = true; render(); await Net.init(); busy = false; if (!user) msg = 'Sign in to Afro Zone first (home screen), then come back to race.'; } catch (e) { busy = false; msg = e.message; }
    render();
  };
  function enterRoom(c) {
    code = c; view = 'room'; room = null; render(); listenRoom();
  }
  function listenRoom() {
    if (unsubRoom) unsubRoom();
    unsubRoom = Net.roomRef(code).onSnapshot(function (s) {
      if (!s.exists) { if (code) { toast('Room closed'); R.leave(true); } return; }
      room = s.data(); onRoom();
    }, function () { /* lost access after leaving: ignore */ });
  }
  function onRoom() {
    var st = room.status;
    if (st === 'wait') { if (R.on) stopRace(); view = 'room'; lastStatus = st; render(); return; }
    if (st === 'race' && !R.on && view !== 'result') { beginRace(); }
    if (st === 'done') { if (R.on) finishAll(); }
    if (view === 'result') render();
    lastStatus = st;
  }
  document.addEventListener('pointerdown', function (ev) {
    var t = ev.target.closest && ev.target.closest('#rc [data-r]'); if (!t || t.disabled) return; var a = t.dataset.r;
    if (a === 'back') { view = 'none'; closeOverlay(); showScr('title'); }
    else if (a === 'create') guard(async function () { var s = level0(), d = await Net.call({ action: 'create', veh: S.veh, world: s.world, level: s.level }); enterRoom(d.code); });
    else if (a === 'join') guard(async function () { var c = ($q('#rcCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 5) throw new Error('Type the 5-letter code'); var d = await Net.call({ action: 'join', code: c, veh: S.veh }); enterRoom(d.code); });
    else if (a === 'start') guard(async function () { await Net.call({ action: 'start', code: code }); });
    else if (a === 'again') guard(async function () { await Net.call({ action: 'again', code: code }); });
    else if (a === 'leave') R.leave(false);
    else if (a === 'share') { var txt = 'Race me in Hill Climb Racer on Afro Zone! Room code: ' + code; if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Code copied'); }); }
  });
  document.addEventListener('change', function (ev) {
    if (!room || (ev.target.id !== 'rcW' && ev.target.id !== 'rcL')) return;
    Net.call({ action: 'track', code: code, world: +$q('#rcW').value, level: +$q('#rcL').value }).catch(function (e) { setMsg(e.message); });
  });

  /* ---------- the race ---------- */
  function beginRace() {
    view = 'none'; closeOverlay(); ghosts = {}; me = { fin: false, safe: 0 }; closing = false;
    start(room.world, room.level);                              // the game's own level start (same seed for everyone)
    R.on = true; R.hold = function () { return sNow() < room.startAt; };
    inp.gas = 0; inp.brake = 0;
    if (unsubCars) unsubCars();
    unsubCars = Net.roomRef(code).collection('cars').onSnapshot(function (qs) {
      qs.docChanges().forEach(function (ch) {
        var u = ch.doc.id; if (u === user.uid || ch.type === 'removed') return; var d = ch.doc.data(), gh = ghosts[u];
        if (!gh) gh = ghosts[u] = { x: d.x, y: d.y, a: d.a, vx: 0, vy: 0, d: 0 };
        if (gh.t != null && d.t > gh.t) { var dt = (d.t - gh.t) / 1000; if (dt > 0.02 && dt < 2) { gh.vx = (d.x - gh.tx) / dt; gh.vy = (d.y - gh.ty) / dt; } }
        gh.tx = d.x; gh.ty = d.y; gh.ta = d.a; gh.t = d.t; gh.rx = performance.now(); gh.s0 = d.s0; gh.s1 = d.s1; gh.w0 = d.w0; gh.w1 = d.w1; gh.v = d.v; gh.g = d.g; gh.f = d.f; gh.d = d.d || 0;
      });
    }, function () {});
    clearInterval(sendT); sendT = setInterval(sendCar, SEND_MS);
    clearInterval(hudT); hudT = setInterval(hud, 250);
    clearInterval(dogT); dogT = setInterval(watch, 400);
    clearInterval(tickT); tickT = setInterval(tick, 150);
    countdown();
  }
  function countdown() {
    var e = $q('#rccd'); if (!e) { e = document.createElement('div'); e.id = 'rccd'; document.body.appendChild(e); }
    var last = -1, iv = setInterval(function () {
      var left = room.startAt - sNow(), n = Math.ceil(left / 1000);
      if (!R.on) { clearInterval(iv); e.remove(); return; }
      if (left <= -700) { clearInterval(iv); e.remove(); return; }
      var txt = left > 0 ? String(Math.min(3, n)) : 'GO!'; if (txt !== last) { last = txt; e.textContent = txt; try { sfx.coin(); } catch (x) {} }
    }, 60);
  }
  function inGorge(x) { var G = (LV && LV.gorges) || []; for (var i = 0; i < G.length; i++) if (x > G[i].a - 90 && x < G[i].b + 90) return true; return false; }
  function tick() {   // remember the last safe spot (upright, on the ground, no water/pit) to respawn at after a crash
    if (!R.on || !car || run.over || R.hold()) return;
    if (car.air < 0.05 && Math.abs(Math.sin(car.a)) < 0.45 && !inGorge(car.x)) me.safe = Math.max(me.safe, car.x - 40);
  }
  function sendCar() {
    if (!R.on || !car || !room) return; var r = function (v) { return Math.round(v * 10) / 10; }, sp = car.sp || [0, 0], ws = car.ws || [0, 0];
    var d = Math.max(0, Math.min(1, car.x / (LV.fin || 1)));
    Net.roomRef(code).collection('cars').doc(user.uid).set({ x: r(car.x), y: r(car.y), a: Math.round(car.a * 100) / 100, s0: r(sp[0]), s1: r(sp[1]), w0: r(ws[0]), w1: r(ws[1]), v: S.veh, g: car.air > 0.12 ? 1 : 0, f: me.fin ? 1 : 0, t: sNow(), d: Math.round(d * 1000) / 1000 }).catch(function () {});
  }
  R.crash = function (why) {   // replaces the game's "run over" screen: you lose time, not the race
    if (!R.on) return false; if (run.over) return true;
    try { navigator.vibrate && navigator.vibrate([60, 40, 90]); } catch (e) {}
    run.over = 'race-crash'; try { sfx.bad(); say('BACK ON TRACK…'); } catch (e) {}
    setTimeout(function () {
      if (!R.on || !car || me.fin) return; var x = Math.max(0, me.safe), v = car.v;
      Object.assign(car, { x: x, y: Hf(x) - (v.wh[0].y + v.R + 12), a: 0, vx: 0, vy: 0, w: 0, air: 0, rot: 0, fl: 0, rotAcc: 0, sp: [0, 0], ws: [0, 0] });
      car.fuel = Math.max(car.fuel, car.st.fuel * 0.5); run.over = ''; run.neckT = 0; cam.x = car.x; cam.y = car.y;
    }, 1300);
    return true;
  };
  R.finished = function () {
    if (!R.on || me.fin) return; me.fin = true; run.over = 'race-finish'; try { sfx.win(); say('FINISH!'); } catch (e) {}
    sendCar();
    (async function tryFinish(n) { try { await Net.call({ action: 'finish', code: code }); } catch (e) { if (n < 3) setTimeout(function () { tryFinish(n + 1); }, 800 * (n + 1)); else toast(e.message); } })(0);
  };
  function rankList() {   // [{name,d,me,fin,col}] best first
    var out = [];
    room.players.forEach(function (u, i) {
      var isMe = u === user.uid, g = ghosts[u], d = isMe ? (car ? Math.max(0, Math.min(1, car.x / (LV.fin || 1))) : 0) : (g ? g.d : 0);
      var fr = room.results.findIndex(function (r) { return r.uid === u; });
      out.push({ name: room.names[u], d: fr >= 0 ? 1 : d, me: isMe, fin: fr >= 0, fr: fr, col: COLORS[i % 4] });
    });
    out.sort(function (a, b) { if (a.fin && b.fin) return a.fr - b.fr; if (a.fin) return -1; if (b.fin) return 1; return b.d - a.d; });
    return out;
  }
  function hud() {
    if (!R.on || !room) return; var e = $q('#rchud'); if (!e) { e = document.createElement('div'); e.id = 'rchud'; document.body.appendChild(e); }
    e.innerHTML = rankList().map(function (r, i) { return '<div class="r' + (r.me ? ' me' : '') + '"><span>' + (i + 1) + '</span><span style="min-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</span><span class="bar"><i style="width:' + Math.round(r.d * 100) + '%;background:' + r.col + '"></i></span><span>' + (r.fin ? '🏁' : Math.round(r.d * 100) + '%') + '</span></div>'; }).join('');
    if (room.firstAt && !closing && sNow() - room.firstAt >= 60000 && room.status === 'race') { closing = true; Net.call({ action: 'close', code: code }).catch(function () { closing = false; }); }
  }
  function watch() {   // the player left the race through the game's own menus → leave the room too
    if (R.on && mode !== 'play' && mode !== 'over' && view !== 'result') R.leave(false);
  }
  function finishAll() {
    if (view === 'result') return; view = 'result'; paused = true;
    var key = code + ':' + (room.round || 1);
    if (!awarded[key]) { awarded[key] = 1; var i = room.results.findIndex(function (r) { return r.uid === user.uid; }); if (i >= 0) { S.coins += [300, 150, 100, 60][Math.min(3, i)]; try { save(); } catch (e) {} } }
    render();
  }
  function stopRace() {   // back to the lobby (rematch) or leaving
    R.on = false; R.hold = function () { return false; };
    [sendT, hudT, dogT, tickT].forEach(clearInterval); if (unsubCars) { unsubCars(); unsubCars = null; }
    var h = $q('#rchud'); if (h) h.remove(); var c = $q('#rccd'); if (c) c.remove();
    ghosts = {}; paused = false; mode = 'menu'; try { $q('#hud').classList.add('hide'); } catch (e) {}
  }
  R.leave = function (silent) {
    var c = code; code = ''; stopRace();
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    if (c && !silent && user) Net.call({ action: 'leave', code: c }).catch(function () {});
    room = null; view = 'none'; closeOverlay(); mode = 'menu'; showScr('title');
  };

  /* ---------- drawing other racers ---------- */
  R.draw = function (cx) {
    if (!R.on) return; var now = performance.now();
    for (var u in ghosts) {
      var gh = ghosts[u]; if (gh.tx == null) continue;
      var age = Math.min(0.35, (now - gh.rx) / 1000), px = gh.tx + gh.vx * age, py = gh.ty + gh.vy * age;
      var k = 0.28; gh.x += (px - gh.x) * k; gh.y += (py - gh.y) * k; gh.a += (gh.ta - gh.a) * k;
      var idx = Math.max(0, room.players.indexOf(u));
      try {
        cx.save(); cx.globalAlpha = 0.62; cx.translate(gh.x, gh.y); cx.rotate(gh.a);
        drawVeh(cx, gh.v | 0, { sp: [gh.s0 || 0, gh.s1 || 0], ws: [gh.w0 || 0, gh.w1 || 0], t: run.t, dx: 0, dy: 0, ha: 0, bl: 0, air: !!gh.g, hard: false, dead: -1 });
        cx.restore();
        cx.save(); cx.globalAlpha = 0.95; cx.font = '800 22px system-ui,Arial'; cx.textAlign = 'center'; cx.lineWidth = 5; cx.strokeStyle = '#0a1328'; cx.fillStyle = COLORS[idx % 4];
        var nm = (room.names[u] || 'Racer'); cx.strokeText(nm, gh.x, gh.y - 80); cx.fillText(nm, gh.x, gh.y - 80); cx.restore();
      } catch (e) { try { cx.restore(); } catch (x) {} }
    }
  };
})();
