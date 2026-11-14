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
  var PROFILE = 'exampro.profile.v1';
  function profile() {
    var p = getProgress(), prefs = read(PROFILE, {}), xp = Math.max(0, Number(p.xp) || 0), lv = Math.floor(Math.sqrt(xp / 50)) + 1;
    var answered = Math.max(0, Number(p.answered) || 0), accuracy = answered ? Math.round(100 * (Number(p.correct) || 0) / answered) : 0;
    var signedUser = window.ExamProAuth && window.ExamProAuth.user;
    var name = typeof prefs.name === 'string' && prefs.name.trim() ? prefs.name.trim().slice(0,50) : signedUser && signedUser.displayName ? signedUser.displayName.slice(0,50) : 'ExamPro student';
    var focus = typeof prefs.focus === 'string' ? prefs.focus.slice(0,100) : '';
    var goal = read('exampro.plan.settings.v1', {}).goal || 20;
    var stages = [{id:'',name:'Choose my learning level'}, {id:'kg',name:'Kindergarten (KG)'}, {id:'g1',name:'Grade 1'}, {id:'g2',name:'Grade 2'}, {id:'g3',name:'Grade 3'}, {id:'g4',name:'Grade 4'}, {id:'g5',name:'Grade 5'}, {id:'g6',name:'Grade 6'}, {id:'g7',name:'Grade 7'}, {id:'g8',name:'Grade 8'}, {id:'g9',name:'Grade 9'}, {id:'g10',name:'Grade 10'}, {id:'g11',name:'Grade 11'}, {id:'g12',name:'Grade 12'}, {id:'university',name:'University / College'}, {id:'ngat',name:'NGAT / Graduate'}, {id:'gk',name:'General Knowledge'}];
    var stage = typeof prefs.stage === 'string' ? prefs.stage : '';
    var stageName = (stages.filter(function (x) { return x.id === stage; })[0] || stages[0]).name;
    var stageOptions = stages.map(function (x) { return '<option value="' + x.id + '"' + (stage === x.id ? ' selected' : '') + '>' + x.name + '</option>'; }).join('');

    var signed = window.ExamProAuth && window.ExamProAuth.user;
    var accountEmail = signed && signed.email ? signed.email : '';
    return heading('YOUR LEARNING IDENTITY', 'Student profile', signed ? 'Your Firebase account and learning profile.' : 'Your learning profile is currently stored on this device.') +
      '<section class="ep-unified-card ep-profile-account"><span class="ep-progress-kicker">ACCOUNT</span><h2>' + (signed ? 'Signed in' : 'Not signed in') + '</h2><p>' + (signed ? '📧 ' + escapeHtml(accountEmail) : 'Sign in to connect your learning profile to an account.') + '</p><button type="button" class="ep-unified-action" id="ep-profile-account-action">' + (signed ? 'Log out' : 'Sign in / Create account') + '</button><p class="ep-profile-status" id="ep-profile-account-status" role="status"></p></section>' +
      '<section class="ep-unified-card ep-unified-profile ep-profile-summary"><div class="ep-unified-avatar" aria-hidden="true">🎓</div><div><span class="ep-progress-kicker">STUDENT DASHBOARD</span><h2>' + escapeHtml(name) + '</h2><p>Level ' + lv + ' · ' + xp.toLocaleString() + ' XP earned</p>' + (focus ? '<p class="ep-profile-focus">🎯 ' + escapeHtml(focus) + '</p>' : '') + '</div></section>' +
      '<div class="ep-unified-stats ep-profile-stats"><div>🔥<b>' + (p.streak || 0) + '</b><small>Day streak</small></div><div>📚<b>' + answered.toLocaleString() + '</b><small>Answered</small></div><div>🎯<b>' + accuracy + '%</b><small>Accuracy</small></div><div>⭐<b>' + lv + '</b><small>Level</small></div></div>' +
      '<section class="ep-unified-card ep-profile-editor"><span class="ep-progress-kicker">YOUR REAL LEARNING PROFILE</span><h2>About you</h2><p>Your saved grade or university level controls the subjects shown on Home and in practice. Change it here whenever you want.</p><label>Display name<input id="ep-profile-name" type="text" maxlength="50" autocomplete="nickname" placeholder="How should we call you?" value="' + escapeHtml(name === 'ExamPro student' ? '' : name) + '"></label><label>My study focus<input id="ep-profile-focus" type="text" maxlength="100" placeholder="e.g. Prepare for Grade 12 Mathematics" value="' + escapeHtml(focus) + '"></label><label>My grade or program<select id="ep-profile-stage" aria-label="Your grade or program">' + stageOptions + '</select></label><p class="ep-profile-stage-note">Current learning path: <strong>' + escapeHtml(stageName) + '</strong>. Existing scores stay saved when you change levels.</p><button class="ep-unified-action" type="button" id="ep-profile-save">Save profile</button><p id="ep-profile-status" role="status" class="ep-profile-status"></p></section>' +
      '<section class="ep-unified-card"><span class="ep-progress-kicker">YOUR LEARNING ROUTINE</span><h2>Study preferences</h2><div class="ep-unified-score"><span>Daily question goal</span><b>' + escapeHtml(goal) + ' questions</b></div><p>Change your goal and exam date from the Study Plan screen.</p><button class="ep-unified-action ep-profile-plan" type="button" id="ep-profile-plan">Open study plan →</button></section>' +
      '<section class="ep-unified-card"><span class="ep-progress-kicker">DATA & PRIVACY</span><h2>Your progress, your data</h2><p>Learning progress is saved in this browser. When signed in, ExamPro also attempts to sync your profile and progress to your Firebase account. If cloud access fails, local data remains available.</p><button class="ep-unified-action ep-profile-export" type="button" id="ep-profile-export">Export my learning data</button><p id="ep-export-status" role="status" class="ep-profile-status"></p></section>';
  }
  function close() {
    panel.hidden = true; panel.classList.remove('ep-profile-layout'); app.hidden = false; nav.classList.remove('ep-unified-active'); document.body.classList.remove('ep-panel-open');
    nav.querySelectorAll('.ep-unified-tab').forEach(function (b) { b.removeAttribute('aria-current'); });
  }
  function open(name) {
    if (document.body.classList.contains('exam-on')) return;
    panel.classList.toggle('ep-profile-layout', name === 'profile');
    panel.innerHTML = '<button type="button" class="ep-unified-back" id="ep-unified-back">← Back to learning</button>' + (name === 'progress' ? progress() : name === 'plan' ? plan() : profile());
    panel.hidden = false; app.hidden = true; nav.classList.add('ep-unified-active'); document.body.classList.add('ep-panel-open');
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
    var profileSave = panel.querySelector('#ep-profile-save');
    if (profileSave) profileSave.addEventListener('click', function () {
      var name = panel.querySelector('#ep-profile-name').value.trim().slice(0,50);
      var focus = panel.querySelector('#ep-profile-focus').value.trim().slice(0,100);
      var stage = panel.querySelector('#ep-profile-stage').value;
      try {
        var existing = read(PROFILE, {}); localStorage.setItem(PROFILE, JSON.stringify(Object.assign({}, existing, {name:name,focus:focus,stage:stage}))); if (window.ExamProAuth && window.ExamProAuth.user) window.ExamProAuth.saveProgress().catch(function (err) { console.warn('Profile cloud sync failed', err); });
        open('profile');
        panel.querySelector('#ep-profile-status').textContent = 'Profile saved on this device. Cloud sync runs when available.';
      } catch (e) { panel.querySelector('#ep-profile-status').textContent = 'Unable to save. Check browser storage permissions.'; }
    });
    var accountAction = panel.querySelector('#ep-profile-account-action');
    if (accountAction) accountAction.addEventListener('click', async function () {
      var a = window.ExamProAuth;
      if (!a) return;
      if (!a.user) { close(); a.open(); return; }
      if (!window.confirm('Log out of ExamPro on this device?')) return;
      accountAction.disabled = true;
      try {
        await a.signOut();
        close();
        window.location.reload();
      } catch (err) {
        accountAction.disabled = false;
        panel.querySelector('#ep-profile-account-status').textContent = 'Could not log out. Please try again.';
      }
    });
    var profilePlan = panel.querySelector('#ep-profile-plan');
    if (profilePlan) profilePlan.addEventListener('click', function () { open('plan'); });
    var profileExport = panel.querySelector('#ep-profile-export');
    if (profileExport) profileExport.addEventListener('click', function () {
      try {
        var data = {version:1,exportedAt:new Date().toISOString(),progress:getProgress(),profile:read(PROFILE,{}),studyPlan:read(PLAN,{}),studySettings:read('exampro.plan.settings.v1',{})};
        var blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
        var url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href=url; link.download='exampro-learning-data.json'; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); },1000);
        panel.querySelector('#ep-export-status').textContent = 'Your learning data export is ready.';
      } catch (e) { panel.querySelector('#ep-export-status').textContent = 'Export could not be completed in this browser.'; }
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
