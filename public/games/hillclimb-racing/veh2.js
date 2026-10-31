'use strict';
/* Hillclimb Racing - garage expansion (loaded right after veh.js).
   +3 cars (Dune Buggy, Rally Legend, Lunar Rover), +3 bikes (Thunder Superbike, Mud Slinger, Safari Tourer),
   +3 drivers (Astro, Desert Nomad, Frost) with their own abilities. Painters use the same helpers as veh.js. */

/* ---------- CARS ---------- */
P.buggy=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.42),tube=(pts,w,col)=>{x.strokeStyle=col;x.lineWidth=w;x.lineJoin='round';x.lineCap='round';x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke()};
 /* chassis rails + skid plate */
 x.fillStyle='#14161c';rr(x,-92,8,186,9,4);x.fill();x.fillStyle='#2a2e38';rr(x,-60,16,120,4,2);x.fill();
 /* rear engine block, cooling fins and twin pipes */
 x.fillStyle=lg(x,-26,10,[[0,'#cfd6e0'],[1,'#5b6476']]);rr(x,-100,-24,34,34,5);x.fill();x.strokeStyle='#14161c';x.lineWidth=1.4;x.stroke();
 for(let i=0;i<5;i++)ln(x,[-98,-20+i*6],[-68,-20+i*6],1.6,'#2a2e38','butt');
 tube([[-70,-4],[-108,-2],[-116,6]],6,'#2b2f38');tube([[-70,-4],[-108,-2],[-116,6]],3.6,'#e6ebf5');tube([[-70,-12],[-104,-12],[-112,-4]],5,'#2b2f38');tube([[-70,-12],[-104,-12],[-112,-4]],3,'#d5dce8');
 /* roll cage */
 tube([[-60,10],[-66,-62],[8,-64],[40,-16]],7,'#14161c');tube([[-60,10],[-66,-62],[8,-64],[40,-16]],4,'#e8edf5');
 tube([[-66,-40],[-4,-14]],5,'#14161c');tube([[-66,-40],[-4,-14]],2.6,'#e8edf5');tube([[8,-64],[-16,-30],[-16,8]],5,'#14161c');tube([[8,-64],[-16,-30],[-16,8]],2.6,'#e8edf5');
 /* nose cone + front panel */
 x.beginPath();x.moveTo(30,10);x.lineTo(34,-12);x.quadraticCurveTo(62,-20,92,-8);x.quadraticCurveTo(106,-4,104,8);x.lineTo(96,16);x.lineTo(34,16);x.closePath();bodyPaint(x,c,lg(x,-20,16,[[0,l],[.5,c],[1,d]]));
 x.fillStyle='#fff';x.beginPath();x.arc(66,0,9,0,7);x.fill();x.fillStyle=sh(c,-.35);x.font='bold 11px Arial';x.textAlign='center';x.fillText('8',66,4);
 x.fillStyle='#fffbd8';rr(x,92,-6,10,7,3);x.fill();x.fillStyle='#262a32';rr(x,84,-8,10,3,1);x.fill();
 /* big fenders over both wheels */
 [[-62,20],[62,24]].forEach(w=>{x.beginPath();x.arc(w[0],w[1],v.R+8,Math.PI*1.04,Math.PI*1.96);x.lineTo(w[0]+v.R+3,w[1]-14);x.arc(w[0],w[1],v.R+3,Math.PI*1.96,Math.PI*1.04,true);x.closePath();bodyPaint(x,c,lg(x,w[1]-v.R-8,w[1]-v.R+8,[[0,l],[1,d]]))});
 /* light bar */
 x.fillStyle='#1a1c22';rr(x,-14,-70,46,7,3);x.fill();for(let i=0;i<4;i++){x.fillStyle='#ffe27a';x.beginPath();x.arc(-6+i*11,-66.5,3,0,7);x.fill()}
 /* spare + flag */
 x.fillStyle='#111';x.beginPath();x.arc(-82,-48,10,0,7);x.fill();x.strokeStyle='#8a93a5';x.lineWidth=2;x.beginPath();x.arc(-82,-48,5,0,7);x.stroke();
 ln(x,[-60,-62],[-60,-96],2,'#cfd6e0');x.fillStyle='#e8222a';x.beginPath();x.moveTo(-60,-96);x.lineTo(-40,-90);x.lineTo(-60,-82);x.closePath();x.fill();
 x.fillStyle='#e8222a';rr(x,-100,-14,6,5,1);x.fill()};

P.rally=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.42);
 x.fillStyle='#101218';rr(x,-100,6,208,16,6);x.fill();
 x.beginPath();x.moveTo(-104,18);x.lineTo(-106,-6);x.quadraticCurveTo(-104,-16,-92,-18);x.lineTo(-52,-22);x.lineTo(-30,-30);x.lineTo(-14,-30);x.lineTo(-10,-22);x.lineTo(40,-22);x.lineTo(54,-28);x.lineTo(70,-26);x.quadraticCurveTo(92,-24,102,-10);x.quadraticCurveTo(110,-4,108,8);x.lineTo(106,18);x.closePath();
 bodyPaint(x,c,lg(x,-44,20,[[0,l],[.4,c],[1,d]]));
 x.save();x.clip();x.fillStyle='#f4f6fa';x.fillRect(-110,-14,230,5);x.fillStyle='#14161c';x.fillRect(-110,-8,230,2.4);x.fillStyle='rgba(255,255,255,.2)';x.fillRect(-110,-30,230,3);
 x.beginPath();x.moveTo(52,-30);x.lineTo(84,-30);x.lineTo(96,-16);x.lineTo(60,-18);x.closePath();x.fillStyle='#14161c';x.fill();x.restore();
 /* door number roundel + sponsor strip */
 x.fillStyle='#fff';x.beginPath();x.arc(-4,-2,11,0,7);x.fill();x.fillStyle='#14161c';x.font='bold 15px Arial';x.textAlign='center';x.fillText('12',-4,3.5);
 x.fillStyle='#14161c';rr(x,-52,-4,28,6,2);x.fill();x.fillStyle='#ffd24a';rr(x,-50,-3,24,2.4,1);x.fill();
 ln(x,[-10,-22],[40,-22],2.4,'#14161c','butt');
 x.strokeStyle=sh(c,-.55);x.lineWidth=1.4;x.beginPath();x.moveTo(-30,-26);x.lineTo(-30,14);x.moveTo(40,-21);x.lineTo(40,14);x.stroke();
 /* hood vent + headlights + extra driving lamps */
 x.fillStyle='#1a1c22';rr(x,70,-24,16,4,2);x.fill();x.fillStyle='#fffbd8';rr(x,98,-8,10,7,2);x.fill();
 [[78,-6],[90,-6]].forEach(p=>{x.fillStyle='#ffe27a';x.beginPath();x.arc(p[0],p[1],3.6,0,7);x.fill();x.strokeStyle='#14161c';x.lineWidth=1;x.stroke()});
 /* tall rear wing on struts */
 ln(x,[-84,-18],[-84,-48],4,'#1b1d24');ln(x,[-60,-20],[-60,-48],4,'#1b1d24');x.fillStyle=lg(x,-56,-44,[[0,l],[1,c]]);rr(x,-108,-56,60,10,3);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.4;x.stroke();
 x.fillStyle='#14161c';rr(x,-110,-60,6,18,2);x.fill();rr(x,-52,-60,6,18,2);x.fill();
 x.fillStyle='#e8222a';rr(x,-108,-10,6,6,1);x.fill();
 x.fillStyle='#14161c';[[-64,22],[64,22]].forEach(p=>{x.beginPath();x.arc(p[0],p[1],31,Math.PI,0);x.fill()});
 x.fillStyle='#14161c';rr(x,-98,16,10,10,2);x.fill();rr(x,92,16,10,10,2);x.fill()};

P.lunar=(x,c,v)=>{const d=sh(c,-.35),l=sh(c,.45),tube=(pts,w,col)=>{x.strokeStyle=col;x.lineWidth=w;x.lineJoin='round';x.lineCap='round';x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke()};
 /* lattice chassis */
 tube([[-80,12],[80,12]],6,'#14161c');tube([[-80,12],[80,12]],3,'#cfd6e0');
 tube([[-70,12],[-48,-12],[-26,12],[-4,-12],[18,12],[40,-12],[62,12]],4,'#14161c');tube([[-70,12],[-48,-12],[-26,12],[-4,-12],[18,12],[40,-12],[62,12]],2,'#aab2c2');
 /* gold-foil battery / equipment boxes (take the skin colour) */
 x.beginPath();x.moveTo(-96,-24);x.lineTo(-52,-24);x.lineTo(-48,10);x.lineTo(-98,10);x.closePath();bodyPaint(x,c,lg(x,-24,10,[[0,l],[.5,c],[1,d]]));
 x.save();x.clip();x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=1.2;for(let i=-100;i<-40;i+=8){x.beginPath();x.moveTo(i,-24);x.lineTo(i+10,10);x.stroke()}x.restore();
 x.beginPath();x.moveTo(40,-6);x.lineTo(84,-8);x.quadraticCurveTo(100,-6,100,6);x.lineTo(98,12);x.lineTo(40,12);x.closePath();bodyPaint(x,c,lg(x,-8,12,[[0,l],[1,d]]));
 /* solar panel on rear box */
 x.fillStyle='#1d3566';x.beginPath();x.moveTo(-108,-30);x.lineTo(-44,-34);x.lineTo(-44,-26);x.lineTo(-108,-22);x.closePath();x.fill();x.strokeStyle='#8fb6ff';x.lineWidth=1;x.stroke();
 for(let i=1;i<5;i++)ln(x,[-108+i*12.8,-30-i*.6],[-108+i*12.8,-22-i*.6],.8,'#8fb6ff','butt');
 /* dish antenna on a mast */
 tube([[-74,-30],[-74,-72]],3,'#cfd6e0');x.fillStyle=lg(x,-90,-62,[[0,'#f4f6fa'],[1,'#9aa4b8']]);x.beginPath();x.ellipse(-74,-76,17,9,-.4,0,7);x.fill();x.strokeStyle='#4a5262';x.lineWidth=1.2;x.stroke();ln(x,[-74,-76],[-62,-88],1.6,'#cfd6e0');
 x.fillStyle='#e8222a';x.beginPath();x.arc(-62,-88,2.4,0,7);x.fill();
 /* camera mast + headlights + flag */
 tube([[70,-8],[70,-52]],3,'#cfd6e0');x.fillStyle='#262a32';rr(x,62,-60,18,10,3);x.fill();x.fillStyle='#8fd8ff';x.beginPath();x.arc(76,-55,3,0,7);x.fill();
 x.fillStyle='#fffbd8';rr(x,94,-4,8,6,2);x.fill();x.fillStyle='#fffbd8';rr(x,94,4,8,5,2);x.fill();
 tube([[-96,-24],[-96,-58]],2,'#cfd6e0');x.fillStyle='#e8222a';x.fillRect(-96,-58,16,5);x.fillStyle='#fff';x.fillRect(-96,-53,16,5);x.fillStyle='#2a6aff';x.fillRect(-96,-48,16,4);
 /* mud-guards over mesh wheels */
 [[-60,20],[60,20]].forEach(w=>{x.beginPath();x.arc(w[0],w[1],v.R+6,Math.PI*1.1,Math.PI*1.9);x.lineTo(w[0]+v.R+2,w[1]-18);x.arc(w[0],w[1],v.R+2,Math.PI*1.9,Math.PI*1.1,true);x.closePath();bodyPaint(x,c,lg(x,w[1]-v.R-6,w[1]-v.R+6,[[0,l],[1,d]]))})};

WSH.buggy=[40,-14,28,-40];
WSH.rally=[46,-24,32,-46];

VEH.push(
 V({n:'Dune Buggy',vm:1.02,kind:'buggy',art:'buggy',wk:'knob',R:30,cost:4200,pw:1.3,gr:1.24,fu:.95,sk:5,st:4,len:224,wh:[{x:-62,y:20},{x:62,y:20}],cp:[{x:104,y:6},{x:-102,y:6}],hd:[{x:-6,y:-56},{x:22,y:-52},{x:-66,y:-60}],I:4600,air:1.15,ks:1.05,win:{x:-24,y:-50,w:48,h:22},hp:{x:-4,y:-40}},CAR),
 V({n:'Rally Legend',vm:1.14,kind:'rally',art:'rally',wk:'rim',R:26,cost:6800,pw:1.42,gr:1.16,fu:.9,sk:4,st:5,len:222,wh:[{x:-64,y:24},{x:64,y:24}],cp:[{x:106,y:10},{x:-102,y:10}],hd:[{x:-2,y:-48},{x:30,y:-38},{x:-84,y:-60}],I:4800,air:1.2,ks:1.1,win:{x:-26,y:-40,w:52,h:18},hp:{x:-2,y:-32}},CAR),
 V({n:'Lunar Rover',vm:.98,kind:'lunar',art:'lunar',wk:'spoke',R:30,cost:11000,pw:1.55,gr:1.3,fu:1.3,sk:4,st:5,len:216,wh:[{x:-60,y:20},{x:60,y:20}],cp:[{x:100,y:8},{x:-98,y:6}],hd:[{x:-8,y:-52},{x:24,y:-44},{x:-76,y:-74}],I:5200,air:1.35,ks:1.15,win:{x:-26,y:-46,w:48,h:22},hp:{x:-6,y:-38}},CAR)
);

/* ---------- BIKES (built on the proven sport / dirt / adventure frames, with their own fairings, wheels and stats) ---------- */
P.super=(x,c,v)=>{P.sport(x,c,v);const d=sh(c,-.5),l=sh(c,.4);
 /* full fairing + belly pan + tall seat cowl + double screen */
 x.save();x.beginPath();x.moveTo(8,-6);x.quadraticCurveTo(30,-4,56,-26);x.lineTo(60,-34);x.lineTo(44,-20);x.lineTo(14,-14);x.closePath();bodyPaint(x,c,lg(x,-34,-4,[[0,l],[1,d]]));
 x.beginPath();x.moveTo(-58,-22);x.quadraticCurveTo(-70,-30,-78,-24);x.lineTo(-84,-32);x.lineTo(-62,-40);x.closePath();bodyPaint(x,c,lg(x,-40,-22,[[0,l],[1,d]]));
 x.fillStyle='rgba(150,205,240,.75)';x.beginPath();x.moveTo(32,-52);x.lineTo(44,-74);x.lineTo(52,-66);x.lineTo(46,-48);x.closePath();x.fill();x.strokeStyle='#222';x.lineWidth=1.3;x.stroke();
 ln(x,[-60,-31],[-16,-27],2.2,'#ffd24a','butt');ln(x,[-60,-35],[-30,-33],1.4,'#fff','butt');x.restore()};
P.mx=(x,c,v)=>{P.dirt(x,c,v);const f=v.wh[1],d=sh(c,-.5),l=sh(c,.4);
 /* tall front number plate + hand guards + mud flap + skid plate */
 x.fillStyle='#fff';x.beginPath();x.moveTo(f.x-16,f.y-48);x.quadraticCurveTo(f.x+8,f.y-58,f.x+20,f.y-40);x.lineTo(f.x+4,f.y-36);x.closePath();x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.4;x.stroke();
 x.fillStyle=sh(c,-.4);x.font='bold 13px Arial';x.textAlign='center';x.fillText('21',f.x+2,f.y-42);
 x.fillStyle=c;rr(x,-66,-30,22,14,4);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.2;x.stroke();
 x.fillStyle='#2b2f38';rr(x,-24,-10,40,6,3);x.fill()};
P.tour=(x,c,v)=>{P.adv(x,c,v);const d=sh(c,-.5),l=sh(c,.4);
 /* twin panniers + top case + jerry can + crash bars + driving lights */
 [[-104,-46],[-104,-24]].forEach((p,i)=>{x.fillStyle=lg(x,p[1],p[1]+22,[[0,l],[1,d]]);rr(x,p[0],p[1],34,i?20:22,5);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.4;x.stroke();ln(x,[p[0]+4,p[1]+(i?10:11)],[p[0]+30,p[1]+(i?10:11)],1.4,'#ffd24a','butt')});
 x.fillStyle='#3a4150';rr(x,-124,-70,38,22,6);x.fill();x.strokeStyle='#0e1014';x.lineWidth=1.4;x.stroke();ln(x,[-120,-60],[-90,-60],1.6,'#e8b21f','butt');
 x.fillStyle='#c94a1f';rr(x,-132,-40,14,26,3);x.fill();x.strokeStyle='#14161c';x.stroke();ln(x,[-129,-36],[-121,-36],1.6,'#fff','butt');
 ln(x,[22,-8],[56,-24],3,'#cfd6e0');ln(x,[56,-24],[48,-4],3,'#cfd6e0');
 [[58,-30],[58,-18]].forEach(q=>{x.fillStyle='#ffe27a';x.beginPath();x.arc(q[0],q[1],4.5,0,7);x.fill();x.strokeStyle='#14161c';x.lineWidth=1.2;x.stroke()})};

VEH.push(
 V({n:'Thunder Superbike',vm:1.16,kind:'super',art:'super',wk:'rim',R:24,cost:5200,pw:1.38,gr:.96,fu:.78,sk:1,st:5,len:160,wh:[{x:-52,y:26},{x:52,y:26}],hd:[{x:16,y:-88},{x:-8,y:-72}],I:2700,air:1.7,rd:{sx:-14,sy:-34,hx:30,hy:-48,px:6,py:6,lean:1.0}},BK),
 V({n:'Mud Slinger',vm:.98,kind:'mx',art:'mx',wk:'knob',R:28,cost:3200,pw:1.08,gr:1.22,fu:1.0,sk:5,st:4,len:156,wh:[{x:-52,y:22},{x:52,y:22}],hd:[{x:8,y:-96},{x:-12,y:-80}],I:2800,air:1.6,rd:{sx:-14,sy:-38,hx:30,hy:-56,px:2,py:4,lean:.7}},BK),
 V({n:'Safari Tourer',vm:1.0,kind:'tour',art:'tour',wk:'knob',R:28,cost:6400,pw:1.2,gr:1.16,fu:1.5,sk:3,st:5,len:190,wh:[{x:-58,y:22},{x:58,y:22}],hd:[{x:2,y:-98},{x:-16,y:-82}],I:3700,air:1.2,rd:{sx:-14,sy:-42,hx:30,hy:-58,px:4,py:2,lean:.4}},V({R:28},BK))
);

/* ---------- DRIVERS: new characters with their own look + ability ---------- */
const _head0=head;
head=function(x,hx0,hy,dr,helm,hc,r){r=r||7.5;
 if(!helm&&dr.hair==='turban'){x.fillStyle=dr.skin;x.beginPath();x.arc(hx0,hy,r,0,7);x.fill();
  x.fillStyle=dr.hc;x.beginPath();x.arc(hx0,hy-2,r+2.6,Math.PI*.98,Math.PI*2.02);x.lineTo(hx0+r+2,hy-1);x.quadraticCurveTo(hx0,hy-r-1,hx0-r-2,hy-1);x.closePath();x.fill();
  x.strokeStyle='rgba(0,0,0,.28)';x.lineWidth=1;for(let i=0;i<3;i++){x.beginPath();x.arc(hx0,hy-2,r+.4+i*.9,Math.PI*1.04,Math.PI*1.96);x.stroke()}
  x.fillStyle=dr.hc;x.beginPath();x.moveTo(hx0-r-2,hy-3);x.quadraticCurveTo(hx0-r-9,hy+4,hx0-r-5,hy+13);x.lineTo(hx0-r-1,hy+3);x.closePath();x.fill();return}
 if(!helm&&dr.hair==='beanie'){x.fillStyle=dr.skin;x.beginPath();x.arc(hx0,hy,r,0,7);x.fill();
  x.fillStyle='#3c1f12';x.beginPath();x.ellipse(hx0-r*.72,hy+r*.38,r*.36,r*.54,.35,0,7);x.fill();
  x.fillStyle=dr.hc;x.beginPath();x.arc(hx0,hy-1.5,r+1.4,Math.PI*.96,Math.PI*2.04);x.closePath();x.fill();
  x.fillStyle=dr.lh||'#fff';rr(x,hx0-r-1.8,hy-2.6,(r+1.8)*2,4.4,2.2);x.fill();
  x.fillStyle=dr.lh||'#fff';x.beginPath();x.arc(hx0-1,hy-r-3.6,3,0,7);x.fill();return}
 if(!helm&&dr.hair==='astro'){x.fillStyle=dr.skin;x.beginPath();x.arc(hx0,hy,r,0,7);x.fill();
  x.fillStyle='#e9eef6';x.beginPath();x.arc(hx0-2,hy-1,r+3.4,Math.PI*.78,Math.PI*2.22);x.lineTo(hx0+r*.4,hy+r+1);x.lineTo(hx0-r-3,hy+r+1);x.closePath();x.fill();x.strokeStyle='#8b94a6';x.lineWidth=1;x.stroke();return}
 _head0(x,hx0,hy,dr,helm,hc,r)};
Object.assign(DRVX,{
 'Astro':(c,x,y,r)=>{c.save();c.fillStyle='rgba(120,200,255,.2)';c.strokeStyle='rgba(200,235,255,.85)';c.lineWidth=1.5;c.beginPath();c.arc(x+r*.3,y,r+1.8,-Math.PI*.7,Math.PI*.7);c.stroke();c.beginPath();c.arc(x+r*.3,y,r+1.8,0,7);c.fill();c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.ellipse(x+r*.55,y-r*.5,r*.32,r*.14,-.5,0,7);c.fill();c.fillStyle='#d8232a';c.fillRect(x-r*1.05,y+r*.9,r*.9,1.6);c.restore()},
 'Desert Nomad':(c,x,y,r)=>{c.fillStyle='rgba(60,40,22,.9)';c.beginPath();c.moveTo(x+r*.1,y+r*.72);c.quadraticCurveTo(x+r*.4,y+r*1.25,x+r*.85,y+r*.78);c.quadraticCurveTo(x+r*.5,y+r*.95,x+r*.1,y+r*.72);c.fill();c.strokeStyle='#e8c24a';c.lineWidth=1;c.beginPath();c.moveTo(x-r*.95,y-r*.7);c.lineTo(x+r*.95,y-r*.7);c.stroke()},
 'Frost':(c,x,y,r)=>{c.fillStyle='rgba(255,130,150,.32)';c.beginPath();c.ellipse(x+r*.5,y+r*.45,r*.3,r*.18,0,0,7);c.fill();c.fillStyle='rgba(255,255,255,.85)';[[.55,.7],[.2,.82],[.8,.55]].forEach(p=>{c.beginPath();c.arc(x+r*p[0],y+r*p[1],.7,0,7);c.fill()})}
});
DRV.push(
 {n:'Astro',role:'Zero Gravity',cost:8500,img:'sel/drv_astro.jpg',av:'sel/drv_astro_av.jpg',skin:'#c58a63',hair:'astro',hc:'#e9eef6',d:'Space-trained: much stronger air control and flip rewards x1.25.',ab:'Zero Gravity',air:1.4,st:1.25},
 {n:'Desert Nomad',role:'Fuel Saver',cost:6000,img:'sel/drv_nomad.jpg',av:'sel/drv_nomad_av.jpg',skin:'#b97c52',hair:'turban',hc:'#c2562a',d:'Reads the dunes - burns 20% less fuel and collects 10% more coins.',ab:'Fuel Saver',fm:.8,cm:1.1},
 {n:'Frost',role:'Ice Grip',cost:4500,img:'sel/drv_frost.jpg',av:'sel/drv_frost_av.jpg',skin:'#f0c4a4',hair:'beanie',hc:'#2f7fe0',lh:'#ffffff',d:'Never slips - grip +18%, a little extra top speed.',ab:'Ice Grip',mu:1.18,vm:1.03}
);
