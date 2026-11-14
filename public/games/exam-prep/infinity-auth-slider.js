/* Infinity: swipeable learning-level picker. The original select remains the form source of truth. */
(function(){
'use strict';
var select=document.getElementById('in-auth-grade'),track=document.getElementById('in-auth-grade-track');
var previous=document.getElementById('in-auth-prev'),next=document.getElementById('in-auth-next'),summary=document.getElementById('in-auth-selection');
if(!select||!track)return;
var labels={kg:'KG',uni:'University',ngat:'NGAT',gk:'General Knowledge'};
Array.from(select.options).filter(function(o){return o.value;}).forEach(function(option){
 var b=document.createElement('button');b.type='button';b.className='in-auth-grade-chip';b.dataset.grade=option.value;
 var short=labels[option.value]||option.textContent;
 b.textContent=short;
 b.setAttribute('aria-pressed','false');
 b.setAttribute('aria-label','Choose '+option.textContent);
 b.addEventListener('click',function(){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 track.appendChild(b);
});
function update(){
 var chosen=select.options[select.selectedIndex];
 summary.textContent=chosen&&chosen.value?chosen.textContent:'Not selected';
 track.querySelectorAll('[data-grade]').forEach(function(b){
 var active=b.dataset.grade===select.value;
 b.setAttribute('aria-pressed',String(active));b.classList.toggle('is-selected',active);
 });
 if(chosen&&chosen.value){var active=track.querySelector('[data-grade="'+chosen.value+'"]');if(active&&document.activeElement!==select)active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}
}
select.addEventListener('change',update);
function slide(direction){track.scrollBy({left:direction*Math.max(180,track.clientWidth*.72),behavior:'smooth'});}
previous.addEventListener('click',function(){slide(-1);});
next.addEventListener('click',function(){slide(1);});
update();
})();