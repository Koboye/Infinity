'use strict';
/* Hillclimb Racing - vehicles (cars + bikes), drivers, outfits. Loaded before the main script. */
const SKINS=[{n:'Red',h:0,c:'#e12a22'},{n:'Blue',h:212,c:'#2d6fe8'},{n:'Yellow',h:48,c:'#f2c230'},{n:'Green',h:112,c:'#2fb24a'},{n:'White',h:0,s:.08,l:2.2,c:'#e8edf2'},{n:'Orange',h:24,c:'#ff8a1f'},{n:'Purple',h:282,c:'#8d3be0'},{n:'Black',h:0,s:.05,l:.3,c:'#23262d'},
 {n:'Camo',h:82,s:.5,l:.78,c:'#5b6b2e',pat:'camo'},{n:'Flame',h:0,s:.05,l:.3,c:'#23262d',pat:'flame'},{n:'Gold',h:36,s:1.25,l:.92,c:'#d9a21c',pat:'gold'},{n:'Neon',h:196,s:1,l:.7,c:'#1a6fd6',pat:'neon'}];
/* ---------- driver accessories (cosmetic, bought with coins, toggled on/off) ---------- */
const ACC=[
 {id:'hel',n:'Helmet',cost:600,img:'sel/acc_helmet.jpg'},
 {id:'sun',n:'Sunglasses',cost:400,img:'sel/acc_sunglasses.jpg'},
 {id:'bag',n:'Backpack',cost:500,img:'sel/acc_backpack.jpg'},
 {id:'glv',n:'Gloves',cost:350,img:'sel/acc_gloves.jpg'},
 {id:'wat',n:'Watch',cost:300,img:'sel/acc_watch.jpg'},
 {id:'nek',n:'Necklace',cost:450,img:'sel/acc_necklace.jpg'}
];
const accOn=id=>{const i=ACC.findIndex(a=>a.id===id);return i>=0&&!!(S.accOn&&S.accOwn&&S.accOn[i]&&S.accOwn[i])};
/* pattern overlays for the special skins - painted only where the body already has pixels (source-atop) */
function decor(c,pat){const x=c.getContext('2d'),w=c.width,h=c.height,d=x.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=0,y1=0;
 for(let y=0;y<h;y+=3)for(let q=0;q<w;q+=3)if(d[(y*w+q)*4+3]>40){if(q<x0)x0=q;if(q>x1)x1=q;if(y<y0)y0=y;if(y>y1)y1=y}
 if(x1<=x0)return c;const bw=x1-x0,bh=y1-y0;let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
 x.save();x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-atop';
 if(pat==='camo'){const cols=['#2e3a16','#7d8a4a','#a3a86a','#1f260e'];for(let i=0;i<46;i++){x.globalAlpha=.82;x.fillStyle=cols[i%4];x.beginPath();x.ellipse(x0+rnd()*bw,y0+rnd()*bh,bw*(.04+rnd()*.07),bh*(.05+rnd()*.1),rnd()*3,0,7);x.fill()}}
 else if(pat==='flame'){for(let i=0;i<4;i++){const fx=x0+bw*(.7-i*.105),yb=y0+bh*.66,hh=bh*(.2+.03*(i%2)),g=x.createLinearGradient(0,yb+bh*.08,0,yb-hh);g.addColorStop(0,'#c8141c');g.addColorStop(.45,'#ff7a1a');g.addColorStop(1,'#ffe03a');x.globalAlpha=.97;x.fillStyle=g;
   x.beginPath();x.moveTo(fx+bw*.045,yb+bh*.08);x.quadraticCurveTo(fx+bw*.03,yb-hh*.35,fx-bw*.01,yb-hh*.55);x.quadraticCurveTo(fx-bw*.005,yb-hh*.25,fx-bw*.045,yb-hh);x.quadraticCurveTo(fx-bw*.07,yb-hh*.3,fx-bw*.075,yb+bh*.08);x.closePath();x.fill()}}
 else if(pat==='gold'){const g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.3,'rgba(255,250,210,.75)');g.addColorStop(.44,'rgba(255,255,255,0)');g.addColorStop(.62,'rgba(255,236,150,.55)');g.addColorStop(.8,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(110,60,0,.4)');x.fillStyle=g;x.fillRect(x0,y0,bw,bh)}
 else if(pat==='neon'){x.fillStyle='rgba(8,10,32,.55)';x.fillRect(x0,y0,bw,bh);x.lineCap='round';
  [['#2ff3ff',.5],['#ff3df2',.62]].forEach(([col,k])=>{x.shadowColor=col;x.shadowBlur=bh*.07;x.strokeStyle=col;x.lineWidth=bh*.032;x.beginPath();x.moveTo(x0+bw*.06,y0+bh*k);x.lineTo(x0+bw*.94,y0+bh*(k-.04));x.stroke()})}
 x.restore();return c}
const CAR={wh:[{x:-60,y:22},{x:61,y:22}],R:28,cp:[{x:92,y:8},{x:-80,y:12}],hd:[{x:-15,y:-52},{x:45,y:-60},{x:-70,y:-56}],I:5200,air:1,cls:'car',kind:'jeep',wk:'img',len:209,art:'jeep',win:{x:-26,y:-54,w:37,h:25},hp:{x:-14,y:-42},ks:1};
const BK={cls:'bike',wk:'bike',cp:[{x:30,y:4},{x:-30,y:4}],R:26,ks:1};
const V=(o,b)=>Object.assign({},b,o);
const VEH=[
 V({n:'Mountain Beast',cost:0,pw:1,gr:1,fu:1,sk:0,st:3},CAR),
 V({n:'Sand Runner',cost:1500,pw:1.12,gr:1.05,fu:1,sk:2,st:3},CAR),
 V({n:'Blue Thunder',cost:3500,pw:1.22,gr:1.12,fu:1.1,sk:1,st:4},CAR),
 V({n:'Green Giant',cost:6000,pw:1.35,gr:1.22,fu:1.2,sk:3,st:5},CAR),
 V({n:'Lightning GT',vm:1.12,kind:'sports',art:'sports',cost:4500,pw:1.34,gr:1.0,fu:.9,sk:5,st:4,wk:'rim',R:24,len:215,wh:[{x:-68,y:26},{x:68,y:26}],cp:[{x:100,y:14},{x:-96,y:14}],hd:[{x:-4,y:-44},{x:36,y:-32},{x:-60,y:-30}],I:4300,air:1.1,ks:1.1,win:{x:-26,y:-40,w:50,h:16},hp:{x:-2,y:-32}},CAR),
 V({n:'Dune Hauler',kind:'pickup',art:'pickup',cost:3000,pw:1.1,gr:1.1,fu:1.15,sk:1,st:3,len:225,wh:[{x:-72,y:22},{x:70,y:22}],cp:[{x:104,y:8},{x:-100,y:10}],hd:[{x:-4,y:-52},{x:42,y:-56},{x:-96,y:-18}],I:5800,win:{x:-14,y:-44,w:50,h:20},hp:{x:12,y:-36}},CAR),
 V({n:'Patrol Cruiser',vm:1.06,kind:'police',art:'police',cost:5500,pw:1.28,gr:1.12,fu:1.05,sk:7,st:4,wk:'rim',R:27,len:210,wh:[{x:-64,y:22},{x:64,y:22}],cp:[{x:98,y:8},{x:-96,y:10}],hd:[{x:-10,y:-56},{x:38,y:-58},{x:-80,y:-52}],I:5200,win:{x:-22,y:-46,w:54,h:20},hp:{x:6,y:-37}},CAR),
 V({n:'Crimson Crusher',vm:0.94,kind:'monster',art:'monster',cost:9000,pw:1.5,gr:1.35,fu:1.2,sk:0,st:5,R:44,len:235,wh:[{x:-66,y:12},{x:66,y:12}],cp:[{x:100,y:-6},{x:-96,y:-4}],hd:[{x:-30,y:-80},{x:30,y:-82},{x:84,y:-44}],I:9000,air:.7,ks:1.25,win:{x:-26,y:-76,w:48,h:22},hp:{x:-2,y:-64}},CAR),
 V({n:'Crimson Rocket',vm:1.1,kind:'sport',art:'sport',cost:2500,pw:1.26,gr:.95,fu:.8,sk:0,st:4,len:150,wh:[{x:-50,y:24},{x:50,y:24}],hd:[{x:14,y:-88},{x:-8,y:-72}],I:2700,air:1.6,rd:{sx:-14,sy:-34,hx:30,hy:-48,px:6,py:6,lean:.95}},BK),
 V({n:'Trail Hopper',vm:0.97,kind:'dirt',art:'dirt',wk:'knob',R:27,cost:2000,pw:1.02,gr:1.16,fu:1.0,sk:3,st:3,len:150,wh:[{x:-50,y:23},{x:50,y:23}],hd:[{x:8,y:-92},{x:-12,y:-76}],I:2800,air:1.5,rd:{sx:-14,sy:-38,hx:30,hy:-56,px:2,py:4,lean:.7}},BK),
 V({n:'Summit Scout',kind:'adv',art:'adventure',cost:4000,pw:1.12,gr:1.1,fu:1.35,sk:5,st:4,len:165,wh:[{x:-54,y:24},{x:54,y:24}],hd:[{x:2,y:-94},{x:-16,y:-78}],I:3500,air:1.2,rd:{sx:-14,sy:-42,hx:30,hy:-58,px:4,py:2,lean:.4}},V({R:27},BK)),
 V({n:'Iron Cruiser',kind:'chopper',art:'chopper',wk:'fat',R:27,cost:3500,pw:1.15,gr:1.0,fu:1.1,sk:1,st:3,len:210,wh:[{x:-54,y:24},{x:80,y:24}],hd:[{x:-14,y:-84},{x:-32,y:-68}],I:3900,air:1.0,rd:{sx:-30,sy:-34,hx:52,hy:-62,px:12,py:6,lean:-.12}},BK),
 V({n:'Neon Phantom',vm:1.2,kind:'future',art:'future',wk:'neon',cost:8000,pw:1.56,gr:1.2,fu:1.0,sk:6,st:5,len:155,wh:[{x:-50,y:24},{x:50,y:24}],hd:[{x:16,y:-86},{x:-8,y:-70}],I:2700,air:1.8,rd:{sx:-14,sy:-36,hx:32,hy:-46,px:6,py:6,lean:1.05}},BK)
];
/* ---------- drivers ---------- */
const DRV=[
 {n:'Gecho',role:'Founder',cost:0,img:'sel/drv_gecho_full.jpg',av:'art/drv_gecho.png',ab:'+10% coins',d:'The founder. Free from the start - collects 10% more coins.',skin:'#a46b45',hair:'curl',hc:'#17110d',cm:1.1},
 {n:'Racer',role:'Speed Boost',cost:1500,img:'sel/drv_racer.jpg',skin:'#e0aa84',hair:'short',hc:'#4a2a18',d:'Engine power +8%, top speed +5%.',ab:'Speed Boost',pw:1.08,vm:1.05},
 {n:'Rally Girl',role:'Better Handling',cost:2500,img:'sel/drv_rally.jpg',skin:'#c98d68',hair:'cap',hc:'#1b1b1f',lh:'#7a3b1e',d:'Grip +10% and stronger air control.',ab:'Better Handling',mu:1.1,air:1.3},
 {n:'Explorer',role:'More Coins',cost:3000,img:'sel/drv_explorer.jpg',skin:'#c99a74',hair:'cow',hc:'#8a5a2b',d:'Every coin is worth 50% more.',ab:'More Coins',cm:1.5},
 {n:'Stunt Driver',role:'Stunt Bonus',cost:3500,img:'sel/drv_stunt.jpg',skin:'#5a3a2a',hair:'curl',hc:'#0c0806',d:'Flip rewards x1.6 and better air control.',ab:'Stunt Bonus',st:1.6,air:1.15},
 {n:'Pro Driver',role:'Extra Durability',cost:5000,img:'sel/drv_pro.jpg',skin:'#d9a07e',hair:'cap',hc:'#1c1c22',lh:'#3a2014',d:'Survives one head crash per run - the car is flipped back upright.',ab:'Extra Durability',shield:1},
 {n:'Veteran',role:'All Rounder',cost:7000,img:'sel/drv_veteran.jpg',skin:'#c99a78',hair:'avi',hc:'#8a5a2e',d:'Small bonus to everything: power, grip, coins and fuel economy.',ab:'All Rounder',pw:1.04,mu:1.04,cm:1.15,fm:.94}
];
const OUT=[
 {n:'Casual',cost:0,top:'#f4f4f4',bot:'#2c2f36',shoe:'#ffffff',hel:'#2a2a30',img:'sel/out_casual.jpg'},
 {n:'Racing Suit',cost:800,top:'#d8232a',bot:'#16161a',shoe:'#d8232a',hel:'#d8232a',img:'sel/out_racing.jpg'},
 {n:'Adventure',cost:600,top:'#6b7a3a',bot:'#6e6a4a',shoe:'#8a6a3a',hel:'#6b7a3a',img:'sel/out_adventure.jpg'},
 {n:'Urban',cost:600,top:'#e8582a',bot:'#22252c',shoe:'#ffffff',hel:'#15151a',img:'sel/out_urban.jpg'},
 {n:'Military',cost:900,top:'#5d6b3a',bot:'#4f5c34',shoe:'#4a3a28',hel:'#4f5c34',img:'sel/out_military.jpg'},
 {n:'Winter',cost:500,top:'#2f56c8',bot:'#1c1f28',shoe:'#2a3a4a',hel:'#2f56c8',img:'sel/out_winter.jpg'},
 {n:'Beach',cost:500,top:'#38b8d8',bot:'#e8d6a8',shoe:'#c8a878',hel:'#f2c230',img:'sel/out_beach.jpg'},
 {n:'Special',cost:1500,top:'#1c2450',bot:'#12163a',shoe:'#35c6ff',hel:'#35c6ff',img:'sel/out_special.jpg'}
];
const ARTS=v=>v.cls==='bike'?'sel/bike_'+v.art+'.jpg':'sel/car_'+v.art+'.jpg';
/* ---------- colour + drawing helpers ---------- */
const hx=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const sh=(c,f)=>'#'+hx(c).map(v=>Math.max(0,Math.min(255,Math.round(f>0?v+(255-v)*f:v*(1+f))))).map(v=>v.toString(16).padStart(2,'0')).join('');
const lg=(x,y0,y1,st)=>{const g=x.createLinearGradient(0,y0,0,y1);st.forEach(s=>g.addColorStop(s[0],s[1]));return g};
const ln=(x,a,b,w,c,cap)=>{x.strokeStyle=c;x.lineWidth=w;x.lineCap=cap||'round';x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke()};
const rr=(x,a,b,w,h,r)=>{x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()};
const GL=(x,y0,y1)=>lg(x,y0,y1,[[0,'#b9e6ff'],[.5,'#5d97c4'],[1,'#1f3c5c']]);
function bodyPaint(x,c,fill){x.fillStyle=fill;x.fill();x.lineWidth=2;x.strokeStyle=sh(c,-.62);x.lineJoin='round';x.stroke()}
const P={};
P.sports=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 x.fillStyle='#101218';rr(x,-100,6,214,16,6);x.fill();
 x.beginPath();x.moveTo(-104,18);x.lineTo(-106,-2);x.quadraticCurveTo(-104,-16,-86,-20);x.lineTo(-50,-26);x.quadraticCurveTo(-26,-48,6,-47);x.quadraticCurveTo(40,-46,58,-22);x.lineTo(98,-13);x.quadraticCurveTo(114,-9,114,6);x.lineTo(114,18);x.closePath();
 bodyPaint(x,c,lg(x,-48,20,[[0,l],[.35,c],[1,d]]));
 x.save();x.clip();x.fillStyle='rgba(12,12,16,.9)';x.fillRect(-110,-9,230,4);x.fillRect(-110,-2,230,2);x.fillStyle='rgba(255,255,255,.22)';x.fillRect(-110,-24,230,3);x.restore();
 x.beginPath();x.moveTo(-42,-26);x.quadraticCurveTo(-22,-43,6,-42);x.quadraticCurveTo(32,-41,48,-24);x.closePath();x.fillStyle=GL(x,-44,-24);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.6;x.stroke();
 ln(x,[2,-42],[2,-25],2,sh(c,-.5),'butt');
 x.strokeStyle=sh(c,-.55);x.lineWidth=1.4;x.beginPath();x.moveTo(-10,-20);x.lineTo(-10,12);x.moveTo(34,-18);x.lineTo(34,12);x.stroke();
 x.fillStyle='#d9dfe8';rr(x,-24,-14,10,3,1.5);x.fill();
 x.fillStyle='#fffbd8';x.beginPath();x.moveTo(104,-10);x.lineTo(114,-2);x.lineTo(104,-2);x.fill();x.fillStyle='#e8222a';rr(x,-108,-8,8,7,2);x.fill();
 x.fillStyle=sh(c,-.5);rr(x,-112,-24,22,4,2);x.fill();ln(x,[-104,-18],[-104,-8],3,sh(c,-.6));
 x.fillStyle='#0a0a0e';[[-68,26],[68,26]].forEach(p=>{x.beginPath();x.arc(p[0],p[1],29,Math.PI,0);x.fill()})};
P.pickup=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 x.beginPath();x.moveTo(-110,18);x.lineTo(-110,-16);x.lineTo(-26,-16);x.lineTo(-26,-38);x.quadraticCurveTo(-24,-50,-10,-50);x.lineTo(28,-50);x.quadraticCurveTo(38,-50,46,-34);x.lineTo(58,-20);x.lineTo(110,-14);x.quadraticCurveTo(120,-12,120,0);x.lineTo(120,18);x.closePath();
 bodyPaint(x,c,lg(x,-52,20,[[0,l],[.4,c],[1,d]]));
 x.fillStyle='#16181e';rr(x,-104,-12,74,14,3);x.fill();
 x.beginPath();x.moveTo(-18,-34);x.lineTo(-18,-44);x.lineTo(26,-44);x.quadraticCurveTo(32,-44,38,-34);x.closePath();x.fillStyle=GL(x,-46,-32);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.5;x.stroke();
 ln(x,[4,-44],[4,-33],2,sh(c,-.5),'butt');
 x.strokeStyle=sh(c,-.55);x.lineWidth=1.4;x.beginPath();x.moveTo(-26,-16);x.lineTo(-26,16);x.moveTo(26,-30);x.lineTo(26,16);x.stroke();
 x.fillStyle='#cfd6e0';rr(x,112,-4,10,18,3);x.fill();rr(x,-114,10,8,8,2);x.fill();
 x.fillStyle='#262a32';rr(x,100,-12,14,10,2);x.fill();x.fillStyle='#fffbd8';rr(x,108,-12,10,6,2);x.fill();x.fillStyle='#e8222a';rr(x,-112,-14,5,8,1);x.fill();
 x.fillStyle=sh(c,-.5);rr(x,-110,18,230,5,2);x.fill();
 x.fillStyle='#0a0a0e';[[-72,22],[70,22]].forEach(p=>{x.beginPath();x.arc(p[0],p[1],33,Math.PI,0);x.fill()})};
P.police=(x,c,v)=>{const l=sh(c,.25);
 x.beginPath();x.moveTo(-104,18);x.lineTo(-104,-14);x.quadraticCurveTo(-102,-24,-92,-26);x.lineTo(-76,-48);x.quadraticCurveTo(-72,-56,-60,-56);x.lineTo(24,-56);x.quadraticCurveTo(34,-56,40,-46);x.lineTo(54,-26);x.lineTo(96,-18);x.quadraticCurveTo(108,-16,108,-4);x.lineTo(108,18);x.closePath();
 bodyPaint(x,c,lg(x,-58,20,[[0,l],[.45,c],[1,sh(c,-.4)]]));
 x.save();x.clip();x.fillStyle='#f4f6fa';x.fillRect(-40,-24,76,44);x.restore();
 x.beginPath();x.moveTo(-34,-24);x.lineTo(-34,-10);x.lineTo(34,-10);x.lineTo(34,-24);x.closePath();x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;x.stroke();
 x.fillStyle='#1a2a44';x.font='bold 11px Arial';x.textAlign='center';x.fillText('POLICE',0,-14);
 x.beginPath();x.moveTo(-68,-30);x.lineTo(-60,-50);x.lineTo(22,-50);x.quadraticCurveTo(30,-50,34,-42);x.lineTo(44,-28);x.closePath();x.fillStyle=GL(x,-52,-28);x.fill();x.strokeStyle='#111';x.lineWidth=1.5;x.stroke();
 ln(x,[-20,-50],[-20,-28],2.5,'#15161c','butt');
 x.fillStyle='#fffbd8';rr(x,98,-14,10,7,2);x.fill();x.fillStyle='#e8222a';rr(x,-108,-14,5,8,1);x.fill();
 x.fillStyle='#20242c';rr(x,100,2,12,16,3);x.fill();rr(x,-108,10,8,8,2);x.fill();
 x.fillStyle='#1b1d24';rr(x,-24,-60,48,6,2);x.fill();
 x.fillStyle='#0a0a0e';[[-64,22],[64,22]].forEach(p=>{x.beginPath();x.arc(p[0],p[1],31,Math.PI,0);x.fill()})};
P.monster=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 ln(x,[-66,12],[-40,-14],7,'#aab2c2');ln(x,[66,12],[40,-14],7,'#aab2c2');x.fillStyle='#232730';rr(x,-92,-14,190,12,4);x.fill();
 x.beginPath();x.moveTo(-100,-12);x.lineTo(-98,-56);x.quadraticCurveTo(-96,-66,-84,-66);x.lineTo(-66,-66);x.lineTo(-52,-96);x.quadraticCurveTo(-48,-102,-40,-102);x.lineTo(14,-102);x.quadraticCurveTo(22,-102,28,-92);x.lineTo(40,-70);x.lineTo(90,-62);x.quadraticCurveTo(104,-60,104,-46);x.lineTo(104,-12);x.closePath();
 bodyPaint(x,c,lg(x,-104,-10,[[0,l],[.4,c],[1,d]]));
 x.save();x.clip();x.fillStyle='#ffb21f';x.beginPath();x.moveTo(-96,-30);x.quadraticCurveTo(-60,-52,-30,-34);x.quadraticCurveTo(-60,-30,-96,-22);x.fill();x.beginPath();x.moveTo(-96,-44);x.quadraticCurveTo(-70,-66,-44,-52);x.quadraticCurveTo(-70,-46,-96,-40);x.fill();x.restore();
 x.beginPath();x.moveTo(-46,-72);x.lineTo(-38,-94);x.lineTo(12,-94);x.quadraticCurveTo(18,-94,22,-86);x.lineTo(30,-72);x.closePath();x.fillStyle=GL(x,-96,-70);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1.6;x.stroke();
 ln(x,[-8,-94],[-8,-72],2.5,sh(c,-.5),'butt');
 x.strokeStyle='#cfd6e0';x.lineWidth=3;x.beginPath();x.moveTo(-50,-104);x.lineTo(-50,-118);x.lineTo(22,-118);x.lineTo(22,-104);x.stroke();
 for(let i=0;i<4;i++){x.fillStyle='#ffe27a';x.beginPath();x.arc(-36+i*16,-114,4.5,0,7);x.fill()}
 x.fillStyle='#fffbd8';rr(x,96,-58,10,8,2);x.fill();x.fillStyle='#cfd6e0';rr(x,100,-44,12,26,3);x.fill();
 x.fillStyle='#e8222a';rr(x,-102,-44,5,8,1);x.fill()};
/* bikes */
function bikeBase(x,v,o,c){const r=v.wh[0],f=v.wh[1];
 ln(x,[o.px,o.py],[r.x,r.y],7,'#2b2f38');ln(x,[o.px,o.py],[r.x,r.y],3,'#6c7686');
 ln(x,[o.fx,o.fy],[f.x,f.y],6,'#8f9aae');ln(x,[o.fx+(f.x-o.fx)*.5,o.fy+(f.y-o.fy)*.5],[f.x,f.y],8,'#c9d1de');
 ln(x,[o.px+8,o.py-24],[r.x+4,r.y-2],4,'#e8b21f');
 x.fillStyle=lg(x,o.ey-14,o.ey+16,[[0,'#6f7888'],[1,'#2a2e38']]);rr(x,o.ex-17,o.ey-14,36,30,6);x.fill();x.strokeStyle='#14161c';x.lineWidth=1.6;x.stroke();
 for(let i=0;i<4;i++)ln(x,[o.ex-12+i*9,o.ey-12],[o.ex-12+i*9,o.ey-3],2,'#c4ccd8','butt');
 x.strokeStyle='#cdd4e0';x.lineWidth=5;x.lineCap='round';x.beginPath();x.moveTo(o.ex-2,o.ey+10);x.quadraticCurveTo(o.ex-30,o.ey+22,o.ex-60,o.ey+4);x.stroke();x.strokeStyle='#8b94a6';x.lineWidth=2;x.stroke()}
P.sport=(x,c,v)=>{const o={fx:36,fy:-34,px:-12,py:6,ex:-4,ey:-8};bikeBase(x,v,o,c);const d=sh(c,-.5),l=sh(c,.35);
 x.beginPath();x.moveTo(-64,-26);x.quadraticCurveTo(-60,-36,-40,-38);x.lineTo(-14,-42);x.quadraticCurveTo(0,-52,22,-52);x.lineTo(28,-66);x.quadraticCurveTo(38,-62,40,-50);x.lineTo(54,-34);x.lineTo(44,-20);x.lineTo(24,-6);x.lineTo(2,-4);x.lineTo(-10,-14);x.lineTo(-40,-20);x.closePath();
 bodyPaint(x,c,lg(x,-66,0,[[0,l],[.5,c],[1,d]]));x.save();x.clip();x.fillStyle='rgba(255,255,255,.9)';x.fillRect(-64,-30,70,4);x.restore();
 x.fillStyle='#16181e';x.beginPath();x.moveTo(-50,-36);x.quadraticCurveTo(-32,-34,-12,-36);x.lineTo(-14,-42);x.lineTo(-50,-40);x.fill();
 x.fillStyle='#fffbd8';x.beginPath();x.moveTo(48,-40);x.lineTo(54,-34);x.lineTo(46,-30);x.fill();x.fillStyle='#e8222a';rr(x,-66,-30,6,5,1);x.fill();
 ln(x,[36,-36],[30,-48],4,'#1a1c22')};
P.dirt=(x,c,v)=>{const o={fx:34,fy:-42,px:-10,py:6,ex:-6,ey:-6};bikeBase(x,v,o,c);const d=sh(c,-.5),l=sh(c,.35),f=v.wh[1];
 x.beginPath();x.moveTo(-60,-30);x.quadraticCurveTo(-58,-40,-44,-40);x.lineTo(-16,-40);x.lineTo(-4,-50);x.quadraticCurveTo(10,-56,22,-48);x.lineTo(30,-40);x.lineTo(14,-28);x.lineTo(-10,-22);x.lineTo(-40,-24);x.closePath();bodyPaint(x,c,lg(x,-56,-20,[[0,l],[1,d]]));
 x.beginPath();x.moveTo(f.x-26,f.y-30);x.quadraticCurveTo(f.x,f.y-42,f.x+16,f.y-26);x.lineTo(f.x+4,f.y-24);x.closePath();bodyPaint(x,c,l);
 x.fillStyle='#fff';rr(x,28,-52,16,14,4);x.fill();x.fillStyle='#1a1c22';x.font='bold 11px Arial';x.textAlign='center';x.fillText('7',36,-41);
 x.fillStyle='#1a1c22';rr(x,-44,-46,30,8,4);x.fill();ln(x,[34,-44],[24,-60],4,'#1a1c22')};
P.adv=(x,c,v)=>{const o={fx:38,fy:-40,px:-12,py:6,ex:-4,ey:-8};bikeBase(x,v,o,c);const d=sh(c,-.5),l=sh(c,.35);
 x.beginPath();x.moveTo(-34,-44);x.lineTo(-6,-48);x.quadraticCurveTo(14,-56,30,-46);x.lineTo(40,-36);x.lineTo(34,-24);x.lineTo(14,-14);x.lineTo(-18,-16);x.closePath();bodyPaint(x,c,lg(x,-56,-14,[[0,l],[.5,c],[1,d]]));
 x.fillStyle='#16181e';x.beginPath();x.moveTo(-58,-40);x.quadraticCurveTo(-36,-38,-14,-40);x.lineTo(-18,-48);x.lineTo(-56,-46);x.fill();
 x.fillStyle='#262a32';rr(x,-84,-44,34,28,5);x.fill();x.strokeStyle='#0e1014';x.lineWidth=1.5;x.stroke();ln(x,[-80,-38],[-54,-38],2,'#5a6272','butt');
 x.beginPath();x.moveTo(34,-48);x.lineTo(46,-76);x.lineTo(54,-70);x.lineTo(48,-48);x.closePath();x.fillStyle='rgba(150,205,240,.7)';x.fill();x.strokeStyle='#222';x.lineWidth=1.5;x.stroke();
 x.fillStyle='#fffbd8';x.beginPath();x.ellipse(50,-36,6,8,0,0,7);x.fill();ln(x,[38,-46],[30,-62],4,'#1a1c22')};
P.chopper=(x,c,v)=>{const f=v.wh[1],o={fx:50,fy:-56,px:-14,py:8,ex:-8,ey:-6};bikeBase(x,v,o,c);const d=sh(c,-.5),l=sh(c,.45);
 ln(x,[f.x-26,f.y-82],[f.x,f.y],5,'#c4ccd9');ln(x,[f.x-26,f.y-82],[f.x-30,f.y-96],4,'#1a1c22');
 x.beginPath();x.moveTo(-18,-32);x.quadraticCurveTo(-8,-52,20,-48);x.quadraticCurveTo(36,-44,34,-34);x.quadraticCurveTo(14,-24,-18,-32);x.closePath();bodyPaint(x,c,lg(x,-52,-26,[[0,l],[.5,c],[1,d]]));
 x.save();x.clip();x.fillStyle='#f0d27a';x.fillRect(-20,-40,60,3);x.restore();
 x.fillStyle='#15161b';x.beginPath();x.moveTo(-52,-30);x.quadraticCurveTo(-38,-24,-22,-32);x.lineTo(-26,-38);x.quadraticCurveTo(-40,-34,-54,-36);x.fill();
 x.fillStyle=lg(x,-34,-8,[[0,'#cfd6e0'],[1,'#69728a']]);x.beginPath();x.moveTo(-82,-26);x.quadraticCurveTo(-60,-44,-40,-34);x.lineTo(-50,-20);x.quadraticCurveTo(-70,-22,-82,-14);x.fill();x.strokeStyle='#2a2e38';x.lineWidth=1.5;x.stroke();
 x.fillStyle='#fffbd8';x.beginPath();x.arc(f.x-8,f.y-56,6,0,7);x.fill();x.strokeStyle='#8f9aae';x.stroke()};
P.future=(x,c,v)=>{const o={fx:36,fy:-30,px:-10,py:4,ex:-6,ey:-8};const r=v.wh[0],f=v.wh[1],d=sh(c,-.6);
 x.shadowColor=c;x.shadowBlur=10;x.fillStyle='#0f1220';
 x.beginPath();x.moveTo(-64,-24);x.quadraticCurveTo(-56,-38,-30,-40);x.lineTo(-6,-44);x.quadraticCurveTo(10,-56,26,-54);x.lineTo(30,-66);x.quadraticCurveTo(40,-60,42,-48);x.lineTo(58,-28);x.lineTo(50,-14);x.lineTo(30,-4);x.lineTo(-6,-2);x.lineTo(-30,-12);x.lineTo(-52,-16);x.closePath();
 x.fillStyle=lg(x,-66,0,[[0,'#2a3050'],[.5,'#12162a'],[1,'#080a14']]);x.fill();x.lineWidth=2.5;x.strokeStyle=c;x.stroke();x.shadowBlur=0;
 ln(x,[o.fx,o.fy],[f.x,f.y],5,'#9fb0d0');ln(x,[o.px,o.py],[r.x,r.y],7,'#2b3040');ln(x,[o.px,o.py],[r.x,r.y],2,c);
 x.strokeStyle=c;x.lineWidth=2.2;x.beginPath();x.moveTo(-58,-24);x.lineTo(-6,-32);x.lineTo(40,-44);x.stroke();x.beginPath();x.moveTo(-30,-12);x.lineTo(20,-10);x.stroke();
 x.fillStyle='rgba(120,220,255,.85)';x.beginPath();x.moveTo(26,-54);x.lineTo(30,-64);x.lineTo(40,-58);x.lineTo(36,-50);x.fill();
 x.fillStyle='#ffffff';x.beginPath();x.moveTo(52,-30);x.lineTo(58,-26);x.lineTo(52,-22);x.fill();x.fillStyle=c;rr(x,-68,-28,8,4,2);x.fill()};
/* ---------- wheels ---------- */
function mkc(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c}
const BCACHE={},WCACHE={};
function bodyOf(vi,sk){const k=vi+'_'+sk;if(BCACHE[k])return BCACHE[k];const v=VEH[vi],K=4,ox=140,oy=130,c=mkc(280*K,200*K),x=c.getContext('2d');x.scale(K,K);x.translate(ox,oy);P[v.kind](x,SKINS[sk].c,v);if(SKINS[sk].pat)decor(c,SKINS[sk].pat);return BCACHE[k]={c,ox,oy,k:K}}
function wheelCv(v,col){const k=(v.wk+v.R+col);if(WCACHE[k])return WCACHE[k];const K=5,R=v.R,s=(R*2+8),c=mkc(s*K,s*K),x=c.getContext('2d');x.scale(K,K);x.translate(s/2,s/2);
 const tire=(w,col2)=>{x.beginPath();x.arc(0,0,R,0,7);x.arc(0,0,R-w,0,7,true);x.fillStyle=col2;x.fill('evenodd')};
 if(v.wk==='rim'){tire(8,'#15161a');x.fillStyle=lg(x,-R,R,[[0,'#eef2f8'],[1,'#8e98aa']]);x.beginPath();x.arc(0,0,R-8,0,7);x.fill();x.fillStyle='#262a34';for(let i=0;i<5;i++){const a=i*1.2566;x.beginPath();x.arc(Math.cos(a)*(R-15),Math.sin(a)*(R-15),4,0,7);x.fill()}ln(x,[0,0],[0,0],1,'#000');x.fillStyle='#5a6274';x.beginPath();x.arc(0,0,5,0,7);x.fill()}
 else if(v.wk==='knob'){for(let i=0;i<26;i++){const a=i*Math.PI*2/26;x.fillStyle='#14151a';x.save();x.rotate(a);x.fillRect(-2.2,-R-1,4.4,8);x.restore()}tire(7,'#1a1b20');x.strokeStyle='#d7dde8';x.lineWidth=1;for(let i=0;i<16;i++){const a=i*Math.PI/8;ln(x,[0,0],[Math.cos(a)*(R-7),Math.sin(a)*(R-7)],.9,'#c8d0dc','butt')}x.strokeStyle='#e8b21f';x.lineWidth=2.4;x.beginPath();x.arc(0,0,R-8,0,7);x.stroke();x.fillStyle='#8a93a5';x.beginPath();x.arc(0,0,4,0,7);x.fill()}
 else if(v.wk==='fat'){tire(11,'#121317');x.strokeStyle='#e8ecf4';x.lineWidth=1.8;x.beginPath();x.arc(0,0,R-12,0,7);x.stroke();for(let i=0;i<18;i++){const a=i*Math.PI/9;ln(x,[Math.cos(a)*5,Math.sin(a)*5],[Math.cos(a)*(R-12),Math.sin(a)*(R-12)],.8,'#c4ccd9','butt')}x.fillStyle='#cfd6e0';x.beginPath();x.arc(0,0,5,0,7);x.fill()}
 else if(v.wk==='neon'){x.shadowColor=col;x.shadowBlur=9;tire(7,'#0d0f1a');x.strokeStyle=col;x.lineWidth=2.6;x.beginPath();x.arc(0,0,R-9,0,7);x.stroke();x.shadowBlur=0;for(let i=0;i<6;i++){const a=i*Math.PI/3;ln(x,[0,0],[Math.cos(a)*(R-9),Math.sin(a)*(R-9)],2,col,'butt')}x.fillStyle='#e8f4ff';x.beginPath();x.arc(0,0,4,0,7);x.fill()}
 else{tire(8,'#15161a');x.strokeStyle='#d7dde8';x.lineWidth=1;x.beginPath();x.arc(0,0,R-9,0,7);x.stroke();for(let i=0;i<18;i++){const a=i*Math.PI/9;ln(x,[0,0],[Math.cos(a)*(R-9),Math.sin(a)*(R-9)],.8,'#b9c2d0','butt')}x.fillStyle='#8a93a5';x.beginPath();x.arc(0,0,4.5,0,7);x.fill()}
 return WCACHE[k]={c,s}}
/* ---------- driver (bust in car windows, full rider on bikes) ---------- */
function head(x,hx0,hy,dr,helm,hc,r){r=r||7.5;
 if(dr.hair==='long'||dr.lh){x.fillStyle=dr.lh||'#4a2a18';x.beginPath();x.ellipse(hx0-3,hy+3,r+2,r+7,0,0,7);x.fill()}
 x.fillStyle=dr.skin;x.beginPath();x.arc(hx0,hy,r,0,7);x.fill();
 if(helm){x.fillStyle=hc;x.beginPath();x.arc(hx0,hy-1,r+2,Math.PI*.92,Math.PI*2.08);x.lineTo(hx0+r+2,hy+3);x.lineTo(hx0+r-2,hy+4);x.lineTo(hx0-r-2,hy+4);x.closePath();x.fill();x.fillStyle='#10131a';rr(x,hx0+1,hy-3,r+2,6,3);x.fill();x.fillStyle=accOn('sun')?'rgba(255,196,70,.95)':'rgba(120,200,255,.55)';rr(x,hx0+2,hy-2,r,2.4,1);x.fill();return}
 const h=dr.hair;x.fillStyle=dr.hc;
 if(h==='curl'){for(let i=0;i<7;i++){const a=Math.PI*(1+i/6);x.beginPath();x.arc(hx0+Math.cos(a)*r*.85,hy-1+Math.sin(a)*r*.85,3.6,0,7);x.fill()}}
 else if(h==='short'){x.beginPath();x.arc(hx0,hy-1,r+.6,Math.PI*.95,Math.PI*2.05);x.fill()}
 else if(h==='cap'){x.beginPath();x.arc(hx0,hy-1,r+1,Math.PI,Math.PI*2);x.fill();rr(x,hx0+2,hy-3,r+5,3,1.5);x.fill()}
 else if(h==='cow'){x.beginPath();x.ellipse(hx0,hy-4,r+7,3,0,0,7);x.fill();x.beginPath();x.arc(hx0,hy-5,r-1,Math.PI,Math.PI*2);x.fill()}
 else if(h==='avi'){x.beginPath();x.arc(hx0,hy-1,r+1.5,Math.PI*.9,Math.PI*2.1);x.fill();x.fillStyle='#222';rr(x,hx0-1,hy-3,r+3,4.5,2);x.fill();x.fillStyle='rgba(150,210,255,.8)';rr(x,hx0,hy-2.4,r+1.4,2.4,1);x.fill()}
 if(accOn('sun')){x.fillStyle='#0b0e16';rr(x,hx0+1,hy-2.6,r+3,4.6,2.2);x.fill();x.fillStyle='rgba(80,180,255,.75)';rr(x,hx0+2.5,hy-1.8,r-.5,1.6,.8);x.fill();return}
 x.fillStyle='#1a1008';x.beginPath();x.arc(hx0+r*.45,hy+.5,1,0,7);x.fill()}
function drawDriver(cx,v,t){const dr=DRV[S.drv]||DRV[0],o=OUT[S.outfit]||OUT[0];
 if(v.cls==='car'){const w=v.win,p=v.hp;cx.save();cx.beginPath();cx.rect(w.x,w.y,w.w,w.h);cx.clip();
  if(v.kind==='jeep'){cx.fillStyle='#2a2f38';cx.fillRect(w.x,w.y,w.w,w.h)}
  cx.fillStyle=o.top;cx.beginPath();cx.moveTo(p.x-12,w.y+w.h+2);cx.quadraticCurveTo(p.x-11,p.y+8,p.x,p.y+8);cx.quadraticCurveTo(p.x+11,p.y+8,p.x+12,w.y+w.h+2);cx.fill();
  head(cx,p.x+1,p.y,dr,v.kind==='sports'||v.kind==='monster'||accOn('hel'),accOn('hel')?'#d8232a':o.hel,6.6);
  if(accOn('nek')){cx.strokeStyle='#cfd6e0';cx.lineWidth=.9;cx.beginPath();cx.moveTo(p.x-4,p.y+8);cx.lineTo(p.x+2,p.y+14);cx.lineTo(p.x+8,p.y+8);cx.stroke();cx.fillStyle='#35c6ff';cx.beginPath();cx.arc(p.x+2,p.y+14.5,1.8,0,7);cx.fill()}
  cx.restore();return}
 const r=v.rd,b=Math.sin(t*5)*.6,sx=r.sx,sy=r.sy+b,L=r.lean,sl=30,shx=sx+Math.sin(L)*sl,shy=sy-Math.cos(L)*sl,hdx=shx+Math.sin(L)*10,hdy=shy-Math.cos(L)*10-2;
 const kn=[sx+26,sy-4];
 ln(cx,[sx,sy],kn,8,o.bot);ln(cx,kn,[r.px+4,r.py+10],7,o.bot);ln(cx,[r.px+4,r.py+10],[r.px+13,r.py+10],6,o.shoe);
 if(accOn('bag')){cx.save();cx.translate(shx-7,shy+10);cx.rotate(L*.9);cx.fillStyle='#1c1f27';rr(cx,-12,-12,15,25,4);cx.fill();cx.fillStyle='#d8232a';rr(cx,-12,-3,15,3,1);cx.fill();cx.restore()}
 ln(cx,[sx,sy],[shx,shy],12,o.top);ln(cx,[sx,sy-2],[shx,shy],6,sh(o.top,.18));
 ln(cx,[shx,shy+1],[(shx+r.hx)/2+2,(shy+r.hy)/2+7],6,sh(o.top,-.22));ln(cx,[(shx+r.hx)/2+2,(shy+r.hy)/2+7],[r.hx,r.hy],5,sh(o.top,-.22));cx.fillStyle=accOn('glv')?'#16161a':dr.skin;cx.beginPath();cx.arc(r.hx,r.hy,3.4,0,7);cx.fill();if(accOn('glv')){cx.fillStyle='#e8222a';cx.fillRect(r.hx-4.6,r.hy-1,2,2.4)}
 if(accOn('wat')){const ex=(shx+r.hx)/2+2,ey=(shy+r.hy)/2+7,wx=ex+(r.hx-ex)*.72,wy=ey+(r.hy-ey)*.72;cx.fillStyle='#d5dbe6';cx.beginPath();cx.arc(wx,wy,2.9,0,7);cx.fill();cx.fillStyle='#14161c';cx.beginPath();cx.arc(wx,wy,1.7,0,7);cx.fill()}
 if(accOn('nek')){cx.fillStyle='#35c6ff';cx.beginPath();cx.arc(shx+Math.sin(L)*3+3,shy+4,2,0,7);cx.fill()}
 head(cx,hdx,hdy,dr,true,accOn('hel')?'#d8232a':o.hel,8)}
/* ---------- generic vehicle draw ---------- */
const skinOf=vi=>(S.skin[vi]>=0?S.skin[vi]:VEH[vi].sk);
function drawVeh(cx,vi,o){const v=VEH[vi],sk=o.sk!=null?o.sk:skinOf(vi),t=o.t||0;
 if(v.kind==='jeep'){const spr=vsprite2(vi,sk),bw=IM.jeep.width*.62,bh=IM.jeep.height*.62;cx.drawImage(spr,-bw/2-10,-bh/2-15,bw,bh)}
 else{const b=bodyOf(vi,sk);cx.drawImage(b.c,-b.ox,-b.oy,b.c.width/b.k,b.c.height/b.k)}
 if(v.kind==='police'){const on=Math.floor(t*7)%2;cx.fillStyle=on?'#ff2a2a':'#ff9a9a';cx.shadowColor='#f22';cx.shadowBlur=on?14:2;cx.fillRect(-22,-64,22,5);cx.fillStyle=on?'#9ad0ff':'#2a6aff';cx.shadowColor='#36f';cx.shadowBlur=on?2:14;cx.fillRect(2,-64,22,5);cx.shadowBlur=0}
 for(let i=0;i<2;i++){cx.save();cx.translate(v.wh[i].x,v.wh[i].y+(o.ws?o.ws[i]:0));cx.rotate(o.sp?o.sp[i]:0);
  if(v.wk==='img'){const d=v.R*2.06;cx.drawImage(IM.wheel,-d/2,-d/2,d,d)}else{const w=wheelCv(v,SKINS[sk].c),s=w.s;cx.drawImage(w.c,-s/2,-s/2,s,s)}cx.restore()}
 if(v.cls==='bike'){drawDriver(cx,v,t)}else drawDriver(cx,v,t)}
