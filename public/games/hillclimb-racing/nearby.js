/* Hill Climb Racer – NEARBY RACE (phase 3): two phones, NO internet.
   A direct phone-to-phone WebRTC link over the same Wi-Fi or one phone's hotspot. There is no server: the phones swap two short
   codes (shown as QR codes, or copy/paste text) once to connect, then race exactly like the online race (Race handles the race,
   this file only handles the link). Browsers cannot use Bluetooth between two phones, so Wi-Fi / hotspot is the offline option. */
(function () {
  'use strict';
  var N = window.Nearby = {};
  var pc = null, ctl = null, car = null, role = '', me = '', peer = '', room = null, qrHost = '', qrAns = '', scan = null, stage = '', up = false;
  var $q = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var HOST = 'HOST', GUEST = 'GUEST';

  /* ---------- codes (compressed SDP, base64url) ---------- */
  var b64 = function (u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var unb64 = function (t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function pipe(u8, T) { var st = new Blob([u8]).stream().pipeThrough(new T('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer()); }
  async function pack(kind, sdp) {
    var raw = new TextEncoder().encode(JSON.stringify({ k: kind, s: sdp }));
    if (window.CompressionStream) return 'z' + b64(await pipe(raw, CompressionStream));
    return 'r' + b64(raw);
  }
  async function unpack(code) {
    code = String(code || '').replace(/\s+/g, ''); if (code.length < 20) throw new Error('That code is too short');
    var u = unb64(code.slice(1)); if (code[0] === 'z') { if (!window.DecompressionStream) throw new Error('This phone cannot read that code'); u = await pipe(u, DecompressionStream); }
    var o = JSON.parse(new TextDecoder().decode(u)); if (!o || !o.s) throw new Error('Not a race code'); return o;
  }

  /* ---------- the link ---------- */
  function newPC() {
    pc = new RTCPeerConnection({ iceServers: [] });   // no STUN/TURN: local network candidates only (works with no internet)
    pc.onconnectionstatechange = function () { var s = pc && pc.connectionState; if ((s === 'failed' || s === 'closed' || s === 'disconnected') && up) lost(); else if (s === 'failed') say('Could not connect. Make sure both phones are on the same Wi-Fi / hotspot, then try again.'); };
  }
  function gathered() { return new Promise(function (ok) { if (pc.iceGatheringState === 'complete') return ok(); var t = setTimeout(ok, 3000); pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); }); }
  function wire() {
    var hi = function () { if (role !== 'guest' || hi.done) return; hi.done = 1; send({ t: 'hello', veh: S.veh }); for (var i = 0; i < 4; i++) setTimeout(function () { var n = Math.random(); pings[n] = Date.now(); send({ t: 'ping', n: n }); }, 150 * (i + 1)); };
    ctl.onopen = hi; if (ctl.readyState === 'open') hi();
    ctl.onmessage = function (e) { try { onMsg(JSON.parse(e.data)); } catch (x) {} };
    ctl.onclose = function () { if (up) lost(); };
    car.onmessage = function (e) { try { var d = JSON.parse(e.data); Race.ui.car(d.u, d.c); } catch (x) {} };
  }
  var send = function (o) { try { if (ctl && ctl.readyState === 'open') ctl.send(JSON.stringify(o)); } catch (e) {} };
  function lost() { if (!up) return; up = false; try { toast('The other phone disconnected'); } catch (e) {} Race.leave(true); }
  function say(m) { Race.ui.msg(m); }

  function roomDoc(guestName, guestVeh) {
    var r = { code: 'NEARBY', host: HOST, players: [HOST], names: {}, veh: {}, world: S.world, level: Math.min(LEVELS - 1, ((S.lp && S.lp[S.world]) || 0) * 10), status: 'wait', startAt: null, firstAt: null, results: [], dnf: [], round: 1 };
    r.names[HOST] = 'Host'; r.veh[HOST] = hostVeh;
    if (guestName) { r.players.push(GUEST); r.names[GUEST] = 'Guest'; r.veh[GUEST] = guestVeh; }
    return r;
  }
  var hostVeh = 0;
  function onMsg(m) {
    if (m.t === 'hello' && role === 'host') { room = roomDoc(true, m.veh | 0); up = true; send({ t: 'room', room: room }); Race.ui.enter(room); }
    else if (m.t === 'room') { room = m.room; if (!up) { up = true; Race.ui.enter(room); } else Race.ui.room(room); }
    else if (m.t === 'start') { room = m.room; room.startAt = Date.now() + m.in - (rtt / 2); Race.ui.room(room); }
    else if (m.t === 'fin') { addResult(m.u, m.ms); }
    else if (m.t === 'again') { room = m.room; Race.ui.room(room); }
    else if (m.t === 'ping') send({ t: 'pong', n: m.n });
    else if (m.t === 'pong') { var r = Date.now() - pings[m.n]; rtt = rtt ? Math.min(rtt, r) : r; }
    else if (m.t === 'bye') lost();
  }
  var rtt = 0, pings = {};
  function addResult(u, ms) {
    if (!room || room.results.some(function (r) { return r.uid === u; })) return;
    room.results.push({ uid: u, ms: ms }); room.results.sort(function (a, b) { return a.ms - b.ms; }); room.results.forEach(function (r, i) { r.place = i + 1; });
    if (room.firstAt == null) room.firstAt = Date.now();
    if (room.status === 'race' && room.players.every(function (p) { return room.results.some(function (r) { return r.uid === p; }); })) room.status = 'done';
    Race.ui.room(room);
  }
  // what Race calls instead of the server
  var api = {
    sendCar: function (uid, pkt) { try { if (car && car.readyState === 'open') car.send(JSON.stringify({ u: uid, c: pkt })); } catch (e) {} },
    close: function () { var was = up; up = false; if (was) send({ t: 'bye' }); try { ctl && ctl.close(); car && car.close(); pc && pc.close(); } catch (e) {} pc = ctl = car = null; stopScan(); },
    call: async function (b) {
      if (!room) throw new Error('Not connected');
      if (b.action === 'track') { if (role !== 'host') throw new Error('Only the host picks the road'); room.world = b.world | 0; room.level = b.level | 0; send({ t: 'room', room: room }); Race.ui.room(room); }
      else if (b.action === 'start') {
        if (role !== 'host') throw new Error('Only the host can start'); if (room.players.length < 2) throw new Error('Waiting for the other phone');
        room.status = 'race'; room.results = []; room.dnf = []; room.firstAt = null; var wait = 4000; room.startAt = Date.now() + wait; send({ t: 'start', in: wait, room: room }); Race.ui.room(room);
      }
      else if (b.action === 'finish') { var ms = Date.now() - room.startAt; send({ t: 'fin', u: me, ms: ms }); addResult(me, ms); }
      else if (b.action === 'close') { if (room.status === 'race') { room.status = 'done'; room.dnf = room.players.filter(function (p) { return !room.results.some(function (r) { return r.uid === p; }); }); Race.ui.room(room); } }
      else if (b.action === 'again') { if (role !== 'host') throw new Error('Only the host can restart'); room.status = 'wait'; room.startAt = null; room.firstAt = null; room.results = []; room.dnf = []; room.round = (room.round || 1) + 1; send({ t: 'again', room: room }); Race.ui.room(room); }
      return {};
    },
  };

  /* ---------- pairing screens ---------- */
  function qrSvg(text) {
    if (!window.qrcode) return '<div class="s">QR not available, use the text code below.</div>';
    try { var q = qrcode(0, 'L'); q.addData(text); q.make(); var n = q.getModuleCount(), cell = 4, svg = q.createSvgTag({ cellSize: cell, margin: 4, scalable: true }); return '<div style="background:#fff;border-radius:10px;padding:4px;width:min(60vh,300px);margin:6px auto">' + svg.replace('<svg', '<svg style="width:100%;height:auto;display:block"') + '</div>'; }
    catch (e) { return '<div class="s">Code too long for a QR. Use the text code below.</div>'; }
  }
  var canScan = function () { return !!(window.BarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); };
  N.html = function (v, err) {
    var back = '<button class="b" data-n="cancel">BACK</button>';
    if (v === 'nmenu') return '<h1>NEARBY RACE</h1><div class="s">Two phones, no internet. Both phones must be on the <b>same Wi-Fi</b>, or one phone shares its <b>hotspot</b> and the other joins it. Race 1 vs 1.</div>' +
      '<button class="b y" data-n="host">HOST A RACE</button><button class="b" data-n="join">JOIN A RACE</button>' + err + back;
    if (v === 'nhost') return '<h1>HOST</h1>' + (qrHost ? '<div class="s"><b>Step 1.</b> The other phone taps JOIN and scans this (or pastes the text code).</div>' + qrSvg(qrHost) +
      '<button class="b" data-n="copyhost">COPY / SHARE TEXT CODE</button><div class="s" style="margin-top:10px"><b>Step 2.</b> Scan the answer from the other phone, or paste it here:</div>' +
      (canScan() ? '<button class="b" data-n="scan">SCAN ANSWER</button>' : '') + '<textarea id="nIn" rows="2" style="width:100%;box-sizing:border-box;margin-top:8px;border-radius:10px;background:#0a1328;color:#fff;border:2px solid #243a63;padding:8px" placeholder="Paste the answer code"></textarea><button class="b y" data-n="connect">CONNECT</button>' : '<div class="s">Preparing…</div>') + (scan ? '<video id="nVid" playsinline muted style="width:100%;border-radius:10px;margin-top:8px"></video>' : '') + err + back;
    if (v === 'njoin') return '<h1>JOIN</h1>' + (qrAns ? '<div class="s"><b>Step 2.</b> Show this to the host phone: they scan it (or paste the text code). The race opens by itself.</div>' + qrSvg(qrAns) + '<button class="b" data-n="copyans">COPY / SHARE TEXT CODE</button>' :
      '<div class="s"><b>Step 1.</b> Scan the host\'s QR, or paste the host\'s text code:</div>' + (canScan() ? '<button class="b y" data-n="scan">SCAN HOST QR</button>' : '') + '<textarea id="nIn" rows="2" style="width:100%;box-sizing:border-box;margin-top:8px;border-radius:10px;background:#0a1328;color:#fff;border:2px solid #243a63;padding:8px" placeholder="Paste the host code"></textarea><button class="b" data-n="connect">CONTINUE</button>') + (scan ? '<video id="nVid" playsinline muted style="width:100%;border-radius:10px;margin-top:8px"></video>' : '') + err + back;
    return '';
  };
  function stopScan() { if (scan) { scan.stop = true; try { scan.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} scan = null; } }
  async function startScan() {
    stopScan(); try {
      var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); scan = { stream: stream, stop: false };
      Race.ui.setView(stage); var v = $q('#nVid'); if (!v) return; v.srcObject = stream; await v.play();
      var det = new BarcodeDetector({ formats: ['qr_code'] }), me2 = scan;
      (async function loop() { while (scan === me2 && !me2.stop) { try { var r = await det.detect(v); if (r && r.length) { var val = r[0].rawValue; stopScan(); gotCode(val); return; } } catch (e) {} await new Promise(function (ok) { setTimeout(ok, 220); }); } })();
    } catch (e) { stopScan(); say('Camera not available. Paste the text code instead.'); }
  }
  async function gotCode(text) {
    try {
      var o = await unpack(text);
      if (stage === 'njoin' && o.k === 'o') {
        newPC(); pc.ondatachannel = function (e) { if (e.channel.label === 'ctl') ctl = e.channel; else car = e.channel; if (ctl && car) wire(); };
        await pc.setRemoteDescription({ type: 'offer', sdp: o.s }); await pc.setLocalDescription(await pc.createAnswer()); await gathered();
        qrAns = await pack('a', pc.localDescription.sdp); say(''); Race.ui.setView('njoin');
      } else if (stage === 'nhost' && o.k === 'a') { await pc.setRemoteDescription({ type: 'answer', sdp: o.s }); say('Connecting…'); }
      else throw new Error(stage === 'njoin' ? 'That is not the host code' : 'That is not the answer code');
    } catch (e) { say(e.message || 'Could not read that code'); }
  }
  async function begin(kind) {
    Race.ui.useP2P(api, kind === 'host' ? HOST : GUEST); role = kind; me = kind === 'host' ? HOST : GUEST; hostVeh = S.veh; qrHost = qrAns = ''; room = null; rtt = 0; up = false;
    stage = kind === 'host' ? 'nhost' : 'njoin'; Race.ui.setView(stage);
    if (!window.RTCPeerConnection) return say('This phone cannot do nearby play (no WebRTC).');
    if (kind === 'host') {
      try {
        newPC(); ctl = pc.createDataChannel('ctl'); car = pc.createDataChannel('car', { ordered: false, maxRetransmits: 0 }); wire();
        await pc.setLocalDescription(await pc.createOffer()); await gathered(); qrHost = await pack('o', pc.localDescription.sdp); Race.ui.setView('nhost');
      } catch (e) { say('Could not start: ' + (e.message || e)); }
    }
  }
  var share = function (txt) { if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { try { toast('Code copied'); } catch (e) {} }); };
  document.addEventListener('pointerdown', function (ev) {
    var t = ev.target.closest && ev.target.closest('#rc [data-n]'); if (!t) return; var a = t.dataset.n;
    if (a === 'menu') Race.ui.setView('nmenu');
    else if (a === 'host') begin('host'); else if (a === 'join') begin('guest');
    else if (a === 'cancel') { stopScan(); api.close(); Race.open(); }
    else if (a === 'scan') startScan();
    else if (a === 'copyhost') share(qrHost); else if (a === 'copyans') share(qrAns);
    else if (a === 'connect') { var el = $q('#nIn'); if (el && el.value.trim()) gotCode(el.value.trim()); else say('Paste the code first'); }
  });
  N._state = function () { return { qrHost: qrHost, qrAns: qrAns, rtt: rtt, up: up }; }; N._api = api; N._unpack = unpack; N._pack = pack;
})();
