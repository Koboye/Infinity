/* Infinity grade picker: adds learning-path selection without changing Exam Pro's bank or language. */
(function () {
  'use strict';
  var grades = [{id:'kg',name:'Kindergarten',cat:'kg'}];
  for (var n=1;n<=12;n++) grades.push({id:'g'+n,name:'Grade '+n,cat:n<=8?'pri':'sec'});
  grades.push({id:'uni',name:'University & College',cat:'uni'},{id:'ngat',name:'NGAT',cat:'ngat'},{id:'gk',name:'General Knowledge',cat:'gk'});
  var currentUser = null, open = false, lastFocus = null;
  var panel = document.createElement('div');
  panel.id = 'in-grade-picker';
  panel.hidden = true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','in-grade-title');
  panel.innerHTML = '<div class="in-grade-sheet"><div class="in-grade-heading"><div><span class="in-grade-kicker">∞ INFINITY · YOUR JOURNEY</span><h2 id="in-grade-title">Choose your learning level</h2><p>Personalize your study path. You can change this anytime.</p></div><button type="button" id="in-grade-close" aria-label="Close grade picker">✕</button></div><div class="in-grade-options" id="in-grade-options"></div><p class="in-grade-footnote">Your existing questions, answers and progress stay unchanged.</p></div>';
  document.body.appendChild(panel);
  var options = panel.querySelector('#in-grade-options');
  grades.forEach(function (g) {
    var b=document.createElement('button'); b.type='button';b.className='in-grade-option';b.dataset.grade=g.id;
    b.textContent=g.name;options.appendChild(b);
  });
  function key(){return 'infinity.learning.grade.'+(currentUser||'local');}
  function selected(){try{return localStorage.getItem(key())||'';}catch(e){return '';}}
  function getGrade(){return grades.find(function(g){return g.id===selected();});}
  function updateLabel(){var label=document.getElementById('in-grade-current'),g=getGrade();if(label)label.textContent=g?g.name:'Choose your grade';}
  function show(required){if(open)return;open=true;lastFocus=document.activeElement;panel.hidden=false;panel.dataset.required=required?'true':'false';document.body.classList.add('in-grade-open');panel.querySelector('#in-grade-close').hidden=!!required;var first=panel.querySelector('[data-grade="'+(selected()||'kg')+'"]');(first||options.firstElementChild).focus();}
  function close(){if(panel.dataset.required==='true'&&!selected())return;panel.hidden=true;open=false;document.body.classList.remove('in-grade-open');if(lastFocus&&lastFocus.isConnected)lastFocus.focus();}
  function choose(id){var g=grades.find(function(x){return x.id===id;});if(!g)return;try{localStorage.setItem(key(),g.id);}catch(e){}close();updateLabel();window.dispatchEvent(new CustomEvent('infinity-grade-changed',{detail:{grade:g.id,label:g.name}}));var target=document.querySelector('.cat[data-c="'+g.cat+'"]');if(target&&target.getAttribute('aria-disabled')!=='true')target.click();}
  options.addEventListener('click',function(e){var b=e.target.closest('[data-grade]');if(b)choose(b.dataset.grade);});
  panel.querySelector('#in-grade-close').addEventListener('click',close);
  panel.addEventListener('keydown',function(e){if(!open)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var focusable=Array.from(panel.querySelectorAll('button:not([hidden])'));var i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();focusable[focusable.length-1].focus();}else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();focusable[0].focus();}}});
  window.infinityShowGradePicker=function(){show(false);};
  window.infinityGetGradeLabel=function(){var g=getGrade();return g?g.name:'';};
  window.addEventListener('infinity-auth-changed',function(e){if(!e.detail||!e.detail.uid){currentUser=null;close();return;}currentUser=e.detail.uid;updateLabel();if(!selected())show(true);});
  window.addEventListener('infinity-grade-changed',updateLabel);
  new MutationObserver(function(){updateLabel();}).observe(document.getElementById('app'),{childList:true});
})();
