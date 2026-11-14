/* ExamPro Screen 10 — navigation and first-use guidance; no quiz state changes. */
(function () {
  'use strict';
  var nav = document.getElementById('bnav'), app = document.getElementById('app');
  var header = document.querySelector('.top .wrap');
  if (!nav || !app || !header) return;
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'ep-nav-menu';
  button.textContent = '☰ Menu';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'ep-nav-sheet');
  var size = header.querySelector('.tsz');
  header.insertBefore(button, size || null);
  var sheet = null, previous = null;
  function close() {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    document.removeEventListener('keydown', keydown);
    if (previous && document.contains(previous)) previous.focus();
  }
  function keydown(e) {
    if (!sheet) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var items = Array.from(sheet.querySelectorAll('button'));
    if (!items.length) return;
    if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length-1].focus(); }
    if (!e.shiftKey && document.activeElement === items[items.length-1]) { e.preventDefault(); items[0].focus(); }
  }
  function open() {
    if (sheet || document.body.classList.contains('exam-on')) return;
    previous = document.activeElement;
    sheet = document.createElement('div');
    sheet.id = 'ep-nav-sheet'; sheet.className = 'ep-nav-overlay';
    sheet.innerHTML = '<section class="ep-nav-sheet" role="dialog" aria-modal="true" aria-labelledby="ep-nav-title">' +
      '<div class="ep-nav-heading"><div><small>EXAMPRO</small><h2 id="ep-nav-title">Where to next?</h2></div><button type="button" class="ep-nav-dismiss" aria-label="Close navigation">✕</button></div>' +
      '<div class="ep-nav-links"></div><p>Keep learning at your own pace. Your saved progress stays on this device.</p></section>';
    var links = sheet.querySelector('.ep-nav-links');
    [
      ['nv-home','🏠','Home','Your learning dashboard'],
      ['nv-sub','📚','Subjects','Choose a topic to study'],
      ['progress','📊','Progress','Track your achievements'],
      ['plan','🗓️','Study plan','Plan your next session'],
      ['profile','👤','Profile','Your learning preferences']
    ].forEach(function (item) {
      var target = item[0] === 'nv-home' || item[0] === 'nv-sub' ? document.getElementById(item[0]) : nav.querySelector('[data-panel="' + item[0] + '"]');
      if (!target) return;
      var link = document.createElement('button');
      link.type = 'button';
      link.innerHTML = '<span aria-hidden="true">' + item[1] + '</span><span><strong>' + item[2] + '</strong><small>' + item[3] + '</small></span><span aria-hidden="true">›</span>';
      link.addEventListener('click', function () { close(); target.click(); });
      links.appendChild(link);
    });
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    sheet.querySelector('.ep-nav-dismiss').addEventListener('click', close);
    document.addEventListener('keydown', keydown);
    sheet.querySelector('.ep-nav-dismiss').focus();
  }
  button.addEventListener('click', open);
  // One-time, dismissible onboarding on the home dashboard, not in an active exam.
  var tip = null, dismissed = false;
  try { dismissed = localStorage.getItem('exampro.onboard.home.v1') === '1'; } catch (e) {}
  function dismiss() {
    dismissed = true;
    try { localStorage.setItem('exampro.onboard.home.v1', '1'); } catch (e) {}
    if (tip) { tip.remove(); tip = null; }
  }
  function update() {
    var isHome = document.body.classList.contains('has-nav') && document.body.classList.contains('dash-on') && !!app.querySelector('.home2') && !document.body.classList.contains('sp-lock');
    if (!isHome || dismissed) { if (tip) { tip.remove(); tip = null; } return; }
    if (tip && document.contains(tip)) return;
    var anchor = app.querySelector('.home2 .dhead');
    if (!anchor) return;
    tip = document.createElement('section');
    tip.className = 'ep-onboard-tip';
    tip.setAttribute('aria-label', 'Getting started');
    tip.innerHTML = '<div><strong>👋 Welcome to ExamPro</strong><p>Choose your level, practice a subject, and track progress. Need a reset? Use 🎮 Take a break.</p></div><button type="button" aria-label="Dismiss getting started tip">Got it ✓</button>';
    tip.querySelector('button').addEventListener('click', dismiss);
    anchor.insertAdjacentElement('afterend', tip);
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }
  var observer = new MutationObserver(schedule);
  observer.observe(app, {childList:true});
  observer.observe(document.body, {attributes:true,attributeFilter:['class']});
  schedule();
})();
