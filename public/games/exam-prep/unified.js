/* ExamPro unified companion screens. Uses the existing static bank and progress; no API or question-bank replacement. */
(function () {
  'use strict';
  var KEY = 'examprep.static.v1', PLAN = 'exampro.plan.v1';
  var nav = document.getElementById('bnav'), app = document.getElementById('app');
  if (!nav || !app) return;
  var panel = document.createElement('section');
  panel.id = 'ep-unified-panel';
  panel.hidden = true;
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', 'ExamPro learning dashboard');
  app.parentNode.insertBefore(panel, app.nextSibling);
    var tabs = [
    ['progress', '📊', 'Progress'],
    ['plan', '📋', 'Study plan'],
    ['profile', '👤', 'Profile']
  ];
  tabs.forEach(function (tab) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ep-unified-tab'; b.dataset.panel = tab[0];
    b.textContent = tab[1] + ' ' + tab[2]; b.addEventListener('click', function () { open(tab[0]); });
    nav.appendChild(b);
  });
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pct(n) { return Math.max(0, Math.min(100, Math.round(n || 0))); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function getProgress() { return read(KEY, {}); }
  function meter(v) { return '<div class="ep-unified-meter" role="progressbar" aria-valuenow="' + pct(v) + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct(v) + '%"></span></div>'; }
  function heading(kicker, title, desc) { return '<div class="ep-unified-hero"><span>' + kicker + '</span><h1>' + title + '</h1><p>' + desc + '</p></div>'; }
  function progress() {
    var p = getProgress(), answered = p.answered || 0, accuracy = answered ? 100 * (p.correct || 0) / answered : 0;
    var xp = p.xp || 0, lv = Math.floor(Math.sqrt(xp / 50)) + 1, low = 50 * (lv - 1) * (lv - 1), high = 50 * lv * lv;
    var mistakes = Object.keys(p.mistakes || {}).reduce(function (sum, key) { return sum + Object.keys(p.mistakes[key] || {}).length; }, 0);
    var scores = Object.keys(p.best || {}).sort(function (a,b) { return (p.best[b] || 0) - (p.best[a] || 0); }).slice(0, 12);
    var html = heading('YOUR JOURNEY', 'My progress', 'Every question is a step forward.');
    html += '<div class="ep-unified-stats"><div>🎯<b>' + pct(accuracy) + '%</b><small>Accuracy</small></div><div>🔥<b>' + (p.streak || 0) + '</b><small>Day streak</small></div><div>⭐<b>' + xp + '</b><small>XP earned</small></div><div>📝<b>' + mistakes + '</b><small>To review</small></div></div>';
    html += '<section class="ep-unified-card"><h2>Level ' + lv + '</h2><p>' + (xp - low) + ' of ' + (high - low) + ' XP toward your next level</p>' + meter(100 * (xp - low) / (high - low)) + '<h2>Today\'s goal</h2><p>' + (p.day === today() ? (p.today || 0) : 0) + ' of 20 questions</p>' + meter((p.day === today() ? (p.today || 0) : 0) * 5) + '</section>';
    html += '<section class="ep-unified-card"><h2>Best scores</h2>' + (scores.length ? scores.map(function (key) { return '<div class="ep-unified-score"><span>' + escapeHtml(key.replace(/[-_]/g, ' ').replace(':', ' · ')) + '</span><b>' + pct(p.best[key]) + '%</b></div>'; }).join('') : '<p>Complete a quiz to see your results here.</p>') + '</section>';
    return html;
  }
  var tasks = [['Review formulas', 'Review your notes for 5 minutes'], ['Practice questions', 'Answer 10 questions'], ['Take a mock exam', 'Try a timed paper'], ['Fix mistakes', 'Learn from missed answers']];
  function plan() {
    var saved = read(PLAN, {}), done = saved.day === today() && Array.isArray(saved.done) ? saved.done.filter(function (i) { return Number.isInteger(i) && i >= 0 && i < tasks.length; }) : [];
    var p = getProgress(), weak = Object.keys(p.mistakes || {}).map(function (id) { return { id: id, count: Object.keys(p.mistakes[id] || {}).length }; }).sort(function (a,b) { return b.count - a.count; }).filter(function (x) { return x.count > 0; });
    var html = heading('STAY CONSISTENT', 'My study plan', 'Four small steps for today.');
    html += '<section class="ep-unified-card"><h2>Today\'s checklist</h2><p>' + done.length + ' of 4 completed · resets daily</p>' + meter(done.length * 25);
    html += tasks.map(function (t, i) { return '<label class="ep-unified-task"><input type="checkbox" data-task="' + i + '"' + (done.indexOf(i) >= 0 ? ' checked' : '') + '><span><b>' + t[0] + '</b><small>' + t[1] + '</small></span></label>'; }).join('');
    return html + '</section><button type="button" class="ep-unified-action" id="ep-unified-study">Explore subjects →</button>';
  }
  function profile() {
    var p = getProgress(), xp = p.xp || 0, lv = Math.floor(Math.sqrt(xp / 50)) + 1;
    return heading('YOUR SPACE', 'My profile', 'Your learning journey, all in one place.') +
      '<section class="ep-unified-card ep-unified-profile"><div class="ep-unified-avatar">🎓</div><h2>ExamPro student</h2><p>Level ' + lv + ' · ' + xp + ' XP</p><div class="ep-unified-stats"><div>🔥<b>' + (p.streak || 0) + '</b><small>Streak</small></div><div>📚<b>' + (p.answered || 0) + '</b><small>Answered</small></div></div></section>' +
      '<section class="ep-unified-card"><h2>About your progress</h2><p>Practice results are saved on this device. They are not automatically synchronized with the separate account-based ExamPrep app.</p></section>';
  }
  function close() {
    panel.hidden = true; app.hidden = false; nav.classList.remove('ep-unified-active');
    nav.querySelectorAll('.ep-unified-tab').forEach(function (b) { b.removeAttribute('aria-current'); });
  }
  function open(name) {
    if (document.body.classList.contains('exam-on')) return;
    panel.innerHTML = '<button type="button" class="ep-unified-back" id="ep-unified-back">← Back to learning</button>' + (name === 'progress' ? progress() : name === 'plan' ? plan() : profile());
    panel.hidden = false; app.hidden = true; nav.classList.add('ep-unified-active');
    nav.querySelectorAll('.ep-unified-tab').forEach(function (b) { b.setAttribute('aria-current', b.dataset.panel === name ? 'page' : 'false'); });
    panel.querySelector('#ep-unified-back').addEventListener('click', function () { close(); document.getElementById('nv-home').click(); });
    panel.querySelectorAll('[data-task]').forEach(function (box) {
      box.addEventListener('change', function () {
        var done = Array.from(panel.querySelectorAll('[data-task]:checked')).map(function (x) { return Number(x.dataset.task); });
        try { localStorage.setItem(PLAN, JSON.stringify({day:today(), done:done})); } catch (e) {}
        open('plan');
      });
    });
    var study = panel.querySelector('#ep-unified-study');
    if (study) study.addEventListener('click', function () { close(); document.getElementById('nv-sub').click(); });
    window.scrollTo(0,0);
  }
  ['nv-home', 'nv-sub'].forEach(function (id) {
    var b = document.getElementById(id); if (b) b.addEventListener('click', close, true);
  });
  var observer = new MutationObserver(function () {
    if (document.body.classList.contains('exam-on') && !panel.hidden) close();
  });
  observer.observe(document.body, {attributes:true, attributeFilter:['class']});
})();
