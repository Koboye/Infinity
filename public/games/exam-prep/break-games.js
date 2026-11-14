/* ExamPro Screen 09: accessible study-break launcher. Never modifies quiz or timer state. */
(function () {
  'use strict';
  var headerButton = document.getElementById('ep-break-open');
  if (!headerButton) return;
  var games = [
    { icon:'🪵', name:'Gebeta', desc:'Traditional strategy', url:'/break?game=gebeta&from=exampro', type:'Strategy' },
    { icon:'♟️', name:'Checkers', desc:'Classic board game', url:'/break?game=checkers&from=exampro', type:'Strategy' },
    { icon:'🎱', name:'Bingo', desc:'A quick number game', url:'/break?game=bingo&from=exampro', type:'Quick play' },
    { icon:'🏃', name:'Addis Runner', desc:'Fast-paced reflexes', url:'/games/addis-runner/', type:'Quick play' },
    { icon:'🚙', name:'Hill Climb Racer', desc:'Take a driving break', url:'/games/hill-climb-racer/', type:'Quick play' },
    { icon:'☁️', name:'Sky Crawler', desc:'Reach new heights', url:'/games/sky-crawler/', type:'Quick play' },
    { icon:'🏔️', name:'Summit Surge', desc:'Mountain adventure', url:'/games/summit-surge/', type:'Quick play' }
  ];
  var modal = null, previous = null;
  var gameFrame = null;
  var floating = document.createElement('button');
  floating.type = 'button';
  floating.id = 'ep-break-floating';
  floating.className = 'ep-break-floating';
  floating.textContent = '🎮 Break';
  floating.setAttribute('aria-label', 'Take a game break during exam');
  floating.setAttribute('aria-haspopup', 'dialog');
  floating.setAttribute('aria-controls', 'ep-break-dialog');
  document.body.appendChild(floating);
  function close() {
    if (!modal) return;
    if (gameFrame) { gameFrame.remove(); gameFrame = null; }
    modal.remove();
    modal = null;
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('ep-break-modal-open');
    if (previous && document.contains(previous)) previous.focus();
    previous = null;
  }
  function onKey(e) {
    if (!modal) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var controls = Array.from((gameFrame || modal.querySelector('.ep-break-box')).querySelectorAll('button, a[href]')).filter(function (el) { return !el.hidden; });
    if (!controls.length) return;
    var first = controls[0], last = controls[controls.length-1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function show() {
    if (modal) return;
    previous = document.activeElement;
    var timed = document.body.classList.contains('exam-on');
    modal = document.createElement('div');
    modal.className = 'ep-break-shade';
    modal.id = 'ep-break-dialog';
    modal.innerHTML =
      '<section class="ep-break-box" role="dialog" aria-modal="true" aria-labelledby="ep-break-title" aria-describedby="ep-break-desc">' +
      '<div class="ep-break-heading"><span class="ep-break-eyebrow">RECHARGE & RETURN</span><button type="button" class="ep-break-x" aria-label="Close game break">✕</button></div>' +
      '<h2 id="ep-break-title">A little play, then back to progress.</h2>' +
      '<p id="ep-break-desc">Pick a game and refresh your mind. Your ExamPro session stays in this tab.</p>' +
      (timed ? '<p class="ep-break-warning" role="note">⏱ Your timed exam keeps counting down. Games do not pause or extend it.</p>' : '<p class="ep-break-info">💡 Try a short break, then return to your next question.</p>') +
      '<div class="ep-break-section"><h3>Strategy & classics</h3><div class="ep-break-games">' + render('Strategy') + '</div></div>' +
      '<div class="ep-break-section"><h3>Quick adventures</h3><div class="ep-break-games">' + render('Quick play') + '</div></div>' +
      '<button type="button" class="ep-break-close">← Continue studying</button></section>';
    document.body.appendChild(modal);
    document.body.classList.add('ep-break-modal-open');
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.ep-break-close').addEventListener('click', close);
    modal.querySelectorAll('[data-game-url]').forEach(function (link) {
      link.addEventListener('click', function (e) { e.preventDefault(); launch(link.getAttribute('data-game-url'), link.getAttribute('data-game-name')); });
    });
    modal.querySelector('.ep-break-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    modal.querySelector('.ep-break-x').focus();
  }
  function launch(url, name) {
    if (!modal || gameFrame) return;
    var box = modal.querySelector('.ep-break-box');
    box.hidden = true;
    gameFrame = document.createElement('section');
    gameFrame.className = 'ep-break-player';
    gameFrame.setAttribute('role', 'dialog');
    gameFrame.setAttribute('aria-modal', 'true');
    gameFrame.setAttribute('aria-label', 'Playing ' + name);
    var bar = document.createElement('div');
    bar.className = 'ep-break-player-bar';
    var title = document.createElement('strong');
    title.textContent = '🎮 ' + name;
    var back = document.createElement('button');
    back.type = 'button';
    back.textContent = '← Back to games';
    back.addEventListener('click', function () { gameFrame.remove(); gameFrame = null; box.hidden = false; box.querySelector('.ep-break-x').focus(); });
    var resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = '✓ Return to ExamPro';
    resume.addEventListener('click', close);
    bar.appendChild(title); bar.appendChild(back); bar.appendChild(resume);
    var iframe = document.createElement('iframe');
    iframe.title = name + ' game';
    iframe.src = url;
    iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'eager');
    gameFrame.appendChild(bar); gameFrame.appendChild(iframe);
    modal.appendChild(gameFrame);
    resume.focus();
  }
  function render(type) {
    return games.filter(function (g) { return g.type === type; }).map(function (g) {
      return '<a href="' + g.url + '" data-game-url="' + g.url + '" data-game-name="' + g.name + '" aria-label="Play ' + g.name + ' inside ExamPro">' +
        '<span class="ep-break-game-icon" aria-hidden="true">' + g.icon + '</span>' +
        '<span class="ep-break-game-label"><strong>' + g.name + '</strong><small>' + g.desc + '</small></span>' +
        '<span class="ep-break-arrow" aria-hidden="true">↗</span></a>';
    }).join('');
  }
  headerButton.addEventListener('click', show);
  floating.addEventListener('click', show);
})();
