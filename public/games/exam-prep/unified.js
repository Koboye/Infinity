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
    var p = getProgress(), answered = Math.max(0, Number(p.answered) || 0), correct = Math.max(0, Number(p.correct) || 0);
    var accuracy = answered ? 100 * correct / answered : 0;
    var xp = Math.max(0, Number(p.xp) || 0), lv = Math.floor(Math.sqrt(xp / 50)) + 1;
    var low = 50 * (lv - 1) * (lv - 1), high = 50 * lv * lv;
    var mistakeMap = p.mistakes || {}, best = p.best || {}, bank = window.BANK || [];
    var names = {};
    bank.forEach(function (d) { names[d.id] = d.name; });
    var mistakes = Object.keys(mistakeMap).reduce(function (sum, key) { return sum + Object.keys(mistakeMap[key] || {}).length; }, 0);
    var todayCount = p.day === today() ? Math.max(0, Number(p.today) || 0) : 0;
    var scores = Object.keys(best).filter(function (key) { return Number.isFinite(Number(best[key])); }).sort(function (a,b) { return Number(best[b]) - Number(best[a]); }).slice(0, 8);
    var priorities = Object.keys(mistakeMap).map(function (id) { return { id: id, name: names[id] || id.replace(/[-_]/g, ' '), count: Object.keys(mistakeMap[id] || {}).length }; }).filter(function (d) { return d.count > 0; }).sort(function (a,b) { return b.count - a.count; }).slice(0, 5);
    var html = heading('YOUR LEARNING JOURNEY', 'Progress & performance', 'A clear picture of what you have accomplished and what to practice next.');
    html += '<div class="ep-unified-stats ep-progress-stats"><div><span aria-hidden="true">🎯</span><b>' + pct(accuracy) + '%</b><small>Overall accuracy</small></div><div><span aria-hidden="true">🔥</span><b>' + (p.streak || 0) + '</b><small>Day streak</small></div><div><span aria-hidden="true">⭐</span><b>' + xp.toLocaleString() + '</b><small>XP earned</small></div><div><span aria-hidden="true">📚</span><b>' + answered.toLocaleString() + '</b><small>Questions answered</small></div></div>';
    html += '<div class="ep-progress-grid"><section class="ep-unified-card"><span class="ep-progress-kicker">LEVEL PROGRESS</span><h2>Level ' + lv + '</h2><p><strong>' + (xp - low) + '</strong> / ' + (high - low) + ' XP toward Level ' + (lv + 1) + '</p>' + meter(100 * (xp - low) / (high - low)) + '</section>';
    html += '<section class="ep-unified-card"><span class="ep-progress-kicker">DAILY CONSISTENCY</span><h2>Today’s goal</h2><p><strong>' + todayCount + '</strong> / 20 questions answered today</p>' + meter(todayCount * 5) + '</section></div>';
    html += '<section class="ep-unified-card"><div class="ep-progress-section-title"><div><span class="ep-progress-kicker">FOCUS YOUR EFFORT</span><h2>Subjects to review</h2></div><span class="ep-progress-count">' + mistakes + ' saved mistakes</span></div>';
    html += priorities.length ? priorities.map(function (d) { return '<div class="ep-progress-priority"><span><b>' + escapeHtml(d.name) + '</b><small>' + d.count + ' question' + (d.count === 1 ? '' : 's') + ' to revisit</small></span><span class="ep-progress-priority-tag">Review</span></div>'; }).join('') : '<p class="ep-progress-empty">No saved mistakes yet. Keep practicing and your review priorities will appear here.</p>';
    html += '</section>';
    html += '<section class="ep-unified-card"><span class="ep-progress-kicker">YOUR PERSONAL BEST</span><h2>Best quiz scores</h2>';
    html += scores.length ? scores.map(function (key) { var parts = key.split(':'), label = names[parts[0]] || parts[0].replace(/[-_]/g,' '), mode = parts[1] || 'quiz'; return '<div class="ep-progress-score"><div class="ep-progress-score-label"><b>' + escapeHtml(label) + '</b><small>' + escapeHtml(mode === 'exam' ? 'Timed exam' : 'Practice') + '</small></div><div class="ep-progress-score-bar">' + meter(best[key]) + '</div><strong>' + pct(best[key]) + '%</strong></div>'; }).join('') : '<p class="ep-progress-empty">Complete a practice session or timed exam to start tracking your best scores.</p>';
    html += '</section><p class="ep-progress-note">These insights reflect activity saved in this browser. Historical daily trends and cross-device sync are not available yet.</p>';
    return html;
  }
  var tasks = [
    ['Warm up', 'Review one topic or formula for 5 minutes'],
    ['Target weak areas', 'Practice questions in a subject needing review'],
    ['Exam practice', 'Complete a focused or timed question session'],
    ['Reflect and improve', 'Revisit mistakes and read explanations']
  ];
  function plan() {
    var saved = read(PLAN, {}), settings = read('exampro.plan.settings.v1', {});
    var done = saved.day === today() && Array.isArray(saved.done) ? saved.done.filter(function (i) { return Number.isInteger(i) && i >= 0 && i < tasks.length; }) : [];
    var p = getProgress(), names = {}, bank = window.BANK || [];
    bank.forEach(function (d) { names[d.id] = d.name; });
    var weak = Object.keys(p.mistakes || {}).map(function (id) { return { id:id, name:names[id] || id.replace(/[-_]/g,' '), count:Object.keys(p.mistakes[id] || {}).length }; }).filter(function (x) { return x.count > 0; }).sort(function (a,b) { return b.count - a.count; });
    var daily = Math.max(5, Math.min(100, Number(settings.goal) || 20));
    var answeredToday = p.day === today() ? Math.max(0, Number(p.today) || 0) : 0;
    var examDate = /^\d{4}-\d{2}-\d{2}$/.test(settings.examDate || '') ? settings.examDate : '';
    var daysLeft = null;
    if (examDate) {
      var parts = examDate.split('-').map(Number), target = new Date(parts[0], parts[1]-1, parts[2]), now = new Date();
      now.setHours(0,0,0,0);
      if (target.getFullYear() === parts[0] && target.getMonth() === parts[1]-1 && target.getDate() === parts[2]) daysLeft = Math.round((target - now)/86400000);
    }
    var focus = weak.length ? weak[0].name : 'Build your foundation';
    var html = heading('YOUR PERSONAL STUDY ROUTINE', 'My study plan', 'A practical daily routine guided by your progress and the mistakes you save.');
    html += '<div class="ep-plan-overview"><div><small>YOUR NEXT FOCUS</small><strong>' + escapeHtml(focus) + '</strong><span>' + (weak.length ? weak[0].count + ' missed questions to revisit' : 'Start practicing to unlock tailored recommendations') + '</span></div><div><small>DAILY TARGET</small><strong>' + answeredToday + ' / ' + daily + '</strong><span>Questions answered today</span></div><div><small>EXAM COUNTDOWN</small><strong>' + (daysLeft == null ? 'Not set' : daysLeft < 0 ? 'Passed' : daysLeft === 0 ? 'Today' : daysLeft + ' days') + '</strong><span>' + (daysLeft == null ? 'Add your exam date below' : 'Based on your selected date') + '</span></div></div>';
    html += '<section class="ep-unified-card ep-plan-settings"><span class="ep-progress-kicker">MAKE IT YOURS</span><h2>Your exam preparation settings</h2><div class="ep-plan-fields"><label>Exam date <input id="ep-plan-date" type="date" value="' + escapeHtml(examDate) + '"></label><label>Daily question goal <select id="ep-plan-goal">' + [10,20,30,50,100].map(function (n) { return '<option value="' + n + '"' + (daily === n ? ' selected' : '') + '>' + n + ' questions</option>'; }).join('') + '</select></label></div><button type="button" class="ep-unified-action" id="ep-plan-save">Save my plan</button><p class="ep-plan-save-note" id="ep-plan-status" role="status"></p></section>';
    html += '<section class="ep-unified-card"><div class="ep-plan-section-head"><div><span class="ep-progress-kicker">YOUR DAILY ROUTINE</span><h2>Today’s checklist</h2></div><span>' + done.length + ' / ' + tasks.length + ' done</span></div><p>Complete each step at your own pace. The checklist resets each day.</p>' + meter(done.length / tasks.length * 100);
    html += tasks.map(function (t, i) { return '<label class="ep-unified-task"><input type="checkbox" data-task="' + i + '"' + (done.indexOf(i) >= 0 ? ' checked' : '') + '><span><b>' + t[0] + '</b><small>' + (i === 1 && weak.length ? 'Focus on ' + escapeHtml(weak[0].name) + ' · ' + weak[0].count + ' saved mistakes' : t[1]) + '</small></span></label>'; }).join('');
    html += '</section><section class="ep-unified-card"><span class="ep-progress-kicker">RECOMMENDED REVIEW ORDER</span><h2>Where to focus next</h2>';
    html += weak.length ? weak.slice(0,5).map(function (x,i) { return '<div class="ep-plan-priority"><span class="ep-plan-rank">' + (i+1) + '</span><div><b>' + escapeHtml(x.name) + '</b><small>' + x.count + ' saved mistake' + (x.count === 1 ? '' : 's') + '</small></div><span class="ep-plan-priority-badge">Review</span></div>'; }).join('') : '<p>Complete some practice questions first. Your most-missed subjects will appear here automatically.</p>';
    html += '</section><button type="button" class="ep-unified-action ep-plan-explore" id="ep-unified-study">Explore subjects →</button>';
    return html;
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
    var planSave = panel.querySelector('#ep-plan-save');
    if (planSave) planSave.addEventListener('click', function () {
      var date = panel.querySelector('#ep-plan-date').value, goal = Number(panel.querySelector('#ep-plan-goal').value);
      try {
        localStorage.setItem('exampro.plan.settings.v1', JSON.stringify({examDate:date,goal:goal}));
        open('plan');
        var status = panel.querySelector('#ep-plan-status'); if (status) status.textContent = 'Your study settings have been saved on this device.';
      } catch (e) {
        var status = panel.querySelector('#ep-plan-status'); if (status) status.textContent = 'Unable to save settings. Please check browser storage permissions.';
      }
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
