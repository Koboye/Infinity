/* ExamPro study-break launcher. Does not change the current exam or its timer. */
(function(){
  'use strict';
  var open=document.getElementById('ep-break-open');
  if(!open)return;
  var games=[
    ['🪵','Gebeta','Traditional strategy board game','/break?game=gebeta'],
    ['♟️','Checkers','Classic board-game break','/break?game=checkers'],
    ['🎱','Bingo','Quick number game','/break?game=bingo'],
    ['🏃','Addis Runner','Quick reflex challenge','/games/addis-runner/'],
    ['🚙','Hill Climb Racer','Take a driving break','/games/hill-climb-racer/'],
    ['☁️','Sky Crawler','Reach new heights','/games/sky-crawler/'],
    ['🏔️','Summit Surge','Climb the mountain','/games/summit-surge/']
  ];
  var modal=null,previous=null;
  function close(){if(!modal)return;modal.remove();modal=null;document.removeEventListener('keydown',onKey);if(previous&&document.contains(previous))previous.focus();previous=null;}
  function onKey(e){if(e.key==='Escape')close();}
  function show(){
    if(modal)return;
    previous=document.activeElement;
    modal=document.createElement('div');modal.className='ep-break-shade';modal.id='ep-break-dialog';
    modal.innerHTML='<section class="ep-break-box" role="dialog" aria-modal="true" aria-labelledby="ep-break-title"><h2 id="ep-break-title">🎮 Take a game break</h2><p>Refresh your mind, then return to your studies. Games open in a new tab so your reading or exam stays here. <strong>Timed exams keep counting down.</strong></p><div class="ep-break-games">'+games.map(function(g){return '<a href="'+g[3]+'" target="_blank" rel="noopener noreferrer"><span>'+g[0]+'</span><span><strong>'+g[1]+'</strong><small>'+g[2]+'</small></span><span aria-hidden="true">↗</span></a>';}).join('')+'</div><button type="button" class="ep-break-close">Continue studying</button></section>';
    document.body.appendChild(modal);
    modal.addEventListener('click',function(e){if(e.target===modal)close();});
    modal.querySelector('.ep-break-close').addEventListener('click',close);
    document.addEventListener('keydown',onKey);
    modal.querySelector('.ep-break-close').focus();
  }
  open.addEventListener('click',show);
})();
