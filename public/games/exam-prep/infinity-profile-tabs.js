/* Infinity profile and navigation: keeps the original Exam Pro question engine intact. */
(function(){
'use strict';
var app=document.getElementById('app');
var games=document.getElementById('nv-games'),profile=document.getElementById('nv-profile');
var signedIn=false,uid='',email='',displayName='';
function text(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function progress(){return window.infinityReadProgress?window.infinityReadProgress():{xp:0,streak:0,today:0,answered:0,correct:0,best:{},mistakes:{}};}
function nav(name){if(window.infinitySetNav)window.infinitySetNav(name);document.body.classList.add('has-nav');document.body.classList.remove('dash-on');}
function showProfile(){
 if(!signedIn)return;
 if(window.infinityExamActive){alert('Finish or exit the current exam before opening Profile. Your answers will stay on screen.');return;}
 nav('profile');
 var p=progress(),grade=window.infinityGetGradeLabel?window.infinityGetGradeLabel():'',dept=window.infinityGetDepartmentId?window.infinityGetDepartmentId():'';
 var bank=window.BANK||[],department=bank.find(function(d){return d.id===dept;});
 var accuracy=p.answered?Math.round(p.correct/p.answered*100):0;
 var mistakes=Object.keys(p.mistakes||{}).reduce(function(n,id){return n+Object.keys(p.mistakes[id]||{}).length;},0);
 app.innerHTML='<section class="in-profile"><div class="in-profile-hero"><div class="in-avatar" aria-hidden="true">∞</div><div><span class="in-grade-kicker">INFINITY STUDENT</span><h1>My Profile</h1><p>'+text(displayName||email||'Student')+'</p></div></div>'+
 '<div class="in-profile-stats"><div><b>'+Number(p.xp||0)+'</b><span>XP earned</span></div><div><b>'+Number(p.streak||0)+'</b><span>Day streak</span></div><div><b>'+accuracy+'%</b><span>Accuracy</span></div><div><b>'+Number(p.answered||0)+'</b><span>Questions answered</span></div></div>'+
 '<div class="in-profile-card"><h2>Learning details</h2><dl><div><dt>Account</dt><dd>'+text(email||'Signed in')+'</dd></div><div><dt>Learning level</dt><dd>'+text(grade||'Not selected')+'</dd></div>'+(department?'<div><dt>Department</dt><dd>'+text(department.name)+'</dd></div>':'')+'<div><dt>Questions to review</dt><dd>'+mistakes+'</dd></div></dl><button type="button" class="btn alt" id="in-profile-change">Change learning level</button></div>'+
 '<div class="in-profile-card"><h2>Progress & achievements</h2><p>Today: '+Number(p.today||0)+' questions · '+Object.keys(p.best||{}).length+' recorded best scores</p><button type="button" class="btn" id="in-profile-study">Continue studying</button></div>'+
 '<div class="in-profile-card"><h2>Account</h2><p>To sign out securely, use the Sign out control at the top of the app.</p><button type="button" class="btn alt" id="in-profile-signout">Sign out</button></div></section>';
 document.getElementById('in-profile-change').onclick=function(){if(window.infinityShowGradePicker)window.infinityShowGradePicker();};
 document.getElementById('in-profile-study').onclick=function(){if(window.infinityNavigateResources)window.infinityNavigateResources();};
 document.getElementById('in-profile-signout').onclick=function(){document.getElementById('ep-auth-signout').click();};
}
function showGames(){
 if(!signedIn)return;
 if(window.infinityExamActive){window.examproOpenGameBreak();return;}
 nav('games');
 app.innerHTML='<section class="in-profile"><div class="in-profile-hero"><div class="in-avatar" aria-hidden="true">🎮</div><div><span class="in-grade-kicker">INFINITY BREAK TIME</span><h1>Games</h1><p>Take a short break and return to learning.</p></div></div><div class="in-profile-card"><h2>Choose a game</h2><div class="in-game-list"><button type="button" id="in-board-games">🎲 Gebeta · Dama · Bingo</button><button type="button" data-game="/games/addis-runner/index.html">🏃 Addis Runner</button><button type="button" data-game="/games/hill-climb-racer/index.html">🚙 Hill Climb</button></div><p class="hint">Your study progress stays saved while you play.</p></div><button class="btn alt" id="in-game-back">Back to learning</button></section>';
 app.querySelectorAll('[data-game]').forEach(function(b){b.onclick=function(){window.examproOpenGameBreak();var frame=document.getElementById('exampro-game-frame');frame.src=b.getAttribute('data-game');};});
 document.getElementById('in-board-games').onclick=function(){window.examproOpenGameBreak();document.getElementById('exampro-game-frame').src='/games/board-games';};
 document.getElementById('in-game-back').onclick=function(){if(window.infinityNavigateResources)window.infinityNavigateResources();};
}
games.addEventListener('click',showGames);
profile.addEventListener('click',showProfile);
window.addEventListener('infinity-auth-changed',function(e){signedIn=!!(e.detail&&e.detail.uid);uid=signedIn?e.detail.uid:'';if(!signedIn){email='';displayName='';}});
window.addEventListener('infinity-grade-changed',function(){if(profile.getAttribute('aria-current')==='page')showProfile();});
window.infinitySetProfileIdentity=function(user){email=user&&user.email||'';displayName=user&&user.displayName||'';};
})();
