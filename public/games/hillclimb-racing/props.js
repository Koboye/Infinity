'use strict';
/* Hillclimb Racing - environment props + bonus collectibles.
   Every sprite is painted once into an offscreen canvas at 2x resolution (crisp on retina) and reused every frame.
   Props are anchored on their bottom edge. Loaded after veh.js (uses its lg/rr helpers). */
const PA={};
function pcv(w,h,fn){const k=2,c=document.createElement('canvas');c.width=w*k;c.height=h*k;const x=c.getContext('2d');x.scale(k,k);x.lineJoin='round';x.lineCap='round';fn(x,w,h);c.lw=w;c.lh=h;return c}
const ell=(x,cx,cy,rx,ry,f)=>{x.fillStyle=f;x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,7);x.fill()};
const shadow=(x,w,h)=>{x.fillStyle='rgba(0,0,0,.22)';x.beginPath();x.ellipse(w/2,h-2,w*.42,4,0,0,7);x.fill()};

/* ---------- trees ---------- */
function pineArt(x,w,h,sn){shadow(x,w,h);x.fillStyle='#5a3a1e';x.fillRect(w/2-6,h-30,12,28);
 for(let i=0;i<4;i++){const top=12+i*32,bw=22+i*7,y2=top+48;x.fillStyle=lg(x,top,y2,[[0,'#34853f'],[1,'#17532a']]);x.beginPath();x.moveTo(w/2,top);x.lineTo(w/2+bw,y2);x.lineTo(w/2-bw,y2);x.closePath();x.fill();
  x.strokeStyle='#0f3a1c';x.lineWidth=1.2;x.stroke();
  if(sn){x.fillStyle='#f4fbff';x.beginPath();x.moveTo(w/2,top);x.lineTo(w/2+bw*.58,top+28);x.quadraticCurveTo(w/2+bw*.25,top+22,w/2,top+31);x.quadraticCurveTo(w/2-bw*.25,top+22,w/2-bw*.58,top+28);x.closePath();x.fill()}}}
PA.pine=pcv(96,180,(x,w,h)=>pineArt(x,w,h,0));
PA.pineS=pcv(96,180,(x,w,h)=>pineArt(x,w,h,1));
PA.acacia=pcv(140,150,(x,w,h)=>{shadow(x,w,h);x.strokeStyle='#5b3a1f';x.lineWidth=9;x.beginPath();x.moveTo(72,148);x.quadraticCurveTo(66,112,62,84);x.stroke();
 x.lineWidth=5;x.beginPath();x.moveTo(63,92);x.lineTo(34,70);x.moveTo(63,90);x.lineTo(104,66);x.stroke();
 const cn=(a,b,rx,ry,c1,c2)=>ell(x,a,b,rx,ry,lg(x,b-ry,b+ry,[[0,c1],[1,c2]]));
 cn(40,68,34,11,'#6aa832','#3d7020');cn(102,63,38,12,'#6aa832','#3d7020');cn(70,50,52,16,'#7bbd3a','#477f24')});
PA.cactus=pcv(64,130,(x,w,h)=>{shadow(x,w,h);const col=(a,b,c,d,r)=>{rr(x,a,b,c,d,r);x.fillStyle=lg(x,b,b+d,[[0,'#52b35a'],[1,'#2f7d3b']]);x.fill();x.strokeStyle='#1f5a2a';x.lineWidth=1.6;x.stroke()};
 col(2,50,12,32,6);col(2,72,24,12,6);col(42,32,12,36,6);col(30,60,24,12,6);col(22,8,20,120,10);
 x.strokeStyle='rgba(190,255,190,.45)';x.lineWidth=1.4;[[28,20,28,120],[36,20,36,120]].forEach(l=>{x.beginPath();x.moveTo(l[0],l[1]);x.lineTo(l[2],l[3]);x.stroke()});
 x.fillStyle='#ff7aa8';x.beginPath();x.arc(32,10,4,0,7);x.fill()});
PA.bush=pcv(100,56,(x,w,h)=>{shadow(x,w,h);[[24,36,20],[50,30,25],[76,36,20],[38,24,18],[62,22,18]].forEach(b=>ell(x,b[0],b[1],b[2],b[2]*.8,lg(x,b[1]-b[2],b[1]+b[2],[[0,'#7dcc45'],[1,'#3a8a2c']])));
 x.fillStyle='#ff5b6e';[[30,30],[58,22],[72,38],[46,40]].forEach(p=>{x.beginPath();x.arc(p[0],p[1],2.6,0,7);x.fill()})});

/* ---------- buildings ---------- */
PA.hut=pcv(150,126,(x,w,h)=>{shadow(x,w,h);rr(x,26,70,98,52,4);x.fillStyle=lg(x,70,122,[[0,'#d8b384'],[1,'#a67c4e']]);x.fill();x.strokeStyle='#6e4a28';x.lineWidth=1.6;x.stroke();
 x.fillStyle='#3a2412';x.beginPath();x.moveTo(66,122);x.lineTo(66,98);x.arc(75,98,9,Math.PI,0);x.lineTo(84,122);x.closePath();x.fill();
 x.beginPath();x.moveTo(6,78);x.quadraticCurveTo(44,72,75,10);x.quadraticCurveTo(106,72,144,78);x.closePath();x.fillStyle=lg(x,10,80,[[0,'#e3c35a'],[1,'#8f6c24']]);x.fill();x.strokeStyle='#5e4414';x.lineWidth=1.6;x.stroke();
 x.strokeStyle='rgba(90,60,10,.55)';x.lineWidth=1.1;for(let i=0;i<9;i++){const t=i/8;x.beginPath();x.moveTo(75,12);x.quadraticCurveTo(75+(t-.5)*70,50,8+t*134,77);x.stroke()}});
function houseArt(x,w,h,mode){shadow(x,w,h);const lit=mode==='n',sn=mode==='s';
 x.fillStyle='#7a6a60';x.fillRect(120,18,16,34);
 rr(x,22,60,126,78,3);x.fillStyle=lg(x,60,138,[[0,sn?'#e8e2d6':'#f0dcb4'],[1,sn?'#b9b2a4':'#c9a878']]);x.fill();x.strokeStyle='#6a5238';x.lineWidth=1.6;x.stroke();
 x.beginPath();x.moveTo(8,66);x.lineTo(85,10);x.lineTo(162,66);x.closePath();x.fillStyle=lg(x,10,66,[[0,'#c9483a'],[1,'#8e2a20']]);x.fill();x.strokeStyle='#4e140e';x.stroke();
 if(sn){x.fillStyle='#f6fbff';x.beginPath();x.moveTo(8,66);x.lineTo(85,10);x.lineTo(162,66);x.lineTo(150,66);x.quadraticCurveTo(120,52,85,56);x.quadraticCurveTo(50,52,20,66);x.closePath();x.fill()}
 x.fillStyle='#5a3a1e';rr(x,76,98,26,40,2);x.fill();x.fillStyle='#e8c25a';x.beginPath();x.arc(97,120,1.8,0,7);x.fill();
 [[38,80],[110,80]].forEach(p=>{if(lit){x.shadowColor='#ffd060';x.shadowBlur=14}x.fillStyle=lit?'#ffd86b':'#bfe3ff';x.fillRect(p[0],p[1],24,24);x.shadowBlur=0;x.strokeStyle='#5a3a1e';x.lineWidth=2;x.strokeRect(p[0],p[1],24,24);x.beginPath();x.moveTo(p[0]+12,p[1]);x.lineTo(p[0]+12,p[1]+24);x.moveTo(p[0],p[1]+12);x.lineTo(p[0]+24,p[1]+12);x.stroke()})}
PA.house=pcv(170,140,(x,w,h)=>houseArt(x,w,h,'d'));
PA.houseS=pcv(170,140,(x,w,h)=>houseArt(x,w,h,'s'));
PA.houseN=pcv(170,140,(x,w,h)=>houseArt(x,w,h,'n'));

/* ---------- roadside obstacles / decor ---------- */
PA.cone=pcv(34,44,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#2a2a30';rr(x,2,h-8,30,7,2);x.fill();x.beginPath();x.moveTo(17,2);x.lineTo(28,h-8);x.lineTo(6,h-8);x.closePath();x.fillStyle=lg(x,2,h,[[0,'#ff9a3a'],[1,'#e2531a']]);x.fill();
 x.fillStyle='#fff';x.beginPath();x.moveTo(13,16);x.lineTo(21,16);x.lineTo(23,24);x.lineTo(11,24);x.closePath();x.fill()});
PA.sign=pcv(64,96,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#6a4426';x.fillRect(28,30,8,64);x.beginPath();x.moveTo(4,10);x.lineTo(46,10);x.lineTo(60,25);x.lineTo(46,40);x.lineTo(4,40);x.closePath();x.fillStyle=lg(x,10,40,[[0,'#d9a04e'],[1,'#a8702c']]);x.fill();x.strokeStyle='#4a2c10';x.lineWidth=2;x.stroke();
 x.fillStyle='#3a2210';x.font='bold 15px sans-serif';x.fillText('GO',14,31)});
PA.fence=pcv(130,56,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#8a5a30';[[8,0],[44,0],[80,0],[116,0]].forEach(p=>{rr(x,p[0],8,8,h-10,2);x.fill()});[16,32].forEach(y=>{rr(x,4,y,122,7,2);x.fillStyle=lg(x,y,y+7,[[0,'#b07a44'],[1,'#7c4f26']]);x.fill()})});
PA.log=pcv(120,44,(x,w,h)=>{shadow(x,w,h); const lg1=(y,x0)=>{rr(x,x0,y,92,18,8);x.fillStyle=lg(x,y,y+18,[[0,'#a8743c'],[1,'#6e4522']]);x.fill();x.strokeStyle='#4a2c12';x.lineWidth=1.4;x.stroke();ell(x,x0+92,y+9,5,9,'#e0b878');x.strokeStyle='#8a5a2a';x.beginPath();x.ellipse(x0+92,y+9,2.4,5,0,0,7);x.stroke()};
 lg1(24,6);lg1(24,24);lg1(8,15)});
PA.boulder=pcv(120,64,(x,w,h)=>{shadow(x,w,h);[[[4,60],[18,30],[48,14],[70,32],[76,60]],[[52,60],[62,36],[88,22],[112,38],[116,60]],[[30,60],[40,40],[66,34],[84,60]]].forEach((p,i)=>{x.beginPath();p.forEach((q,j)=>j?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();x.fillStyle=lg(x,14,60,[[0,i===2?'#b9b9b9':'#a4a4a4'],[1,'#6a6a70']]);x.fill();x.strokeStyle='#3e3e44';x.lineWidth=1.6;x.stroke()})});

/* ---------- bonus collectibles: trophy / treasure chest / money bag ---------- */
PA.trophy=pcv(48,58,(x,w,h)=>{const gold=lg(x,0,h,[[0,'#fff1a0'],[.5,'#f2b92a'],[1,'#b07410']]);
 x.strokeStyle='#d9a01e';x.lineWidth=4;x.beginPath();x.arc(8,16,8,Math.PI*.5,Math.PI*1.5);x.stroke();x.beginPath();x.arc(40,16,8,Math.PI*1.5,Math.PI*.5);x.stroke();
 x.fillStyle=gold;x.beginPath();x.moveTo(8,3);x.lineTo(40,3);x.quadraticCurveTo(40,34,24,38);x.quadraticCurveTo(8,34,8,3);x.closePath();x.fill();x.strokeStyle='#7a4c06';x.lineWidth=1.6;x.stroke();
 x.fillStyle=gold;x.fillRect(21,38,6,10);x.stroke();rr(x,12,48,24,9,3);x.fill();x.strokeStyle='#7a4c06';x.stroke();
 x.fillStyle='#fff7c8';x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?4:9;x.lineTo(24+Math.cos(a)*r,19+Math.sin(a)*r)}x.closePath();x.fill();
 x.fillStyle='rgba(255,255,255,.55)';x.beginPath();x.ellipse(16,14,2.4,9,.2,0,7);x.fill()});
PA.chest=pcv(58,48,(x,w,h)=>{shadow(x,w,h);rr(x,4,22,50,24,4);x.fillStyle=lg(x,22,46,[[0,'#a35a22'],[1,'#6a3510']]);x.fill();x.strokeStyle='#3a1c08';x.lineWidth=1.8;x.stroke();
 x.beginPath();x.moveTo(4,24);x.quadraticCurveTo(29,-6,54,24);x.closePath();x.fillStyle=lg(x,0,24,[[0,'#c27230'],[1,'#8a4a1a']]);x.fill();x.stroke();
 x.fillStyle='#f2c230';[14,43].forEach(bx=>{x.fillRect(bx-3,8,6,38)});x.strokeStyle='#8a5a06';x.lineWidth=1;[14,43].forEach(bx=>x.strokeRect(bx-3,8,6,38));
 rr(x,23,22,12,13,2);x.fillStyle='#f6d24a';x.fill();x.stroke();x.fillStyle='#35c6ff';x.beginPath();x.moveTo(29,25);x.lineTo(33,29);x.lineTo(29,33);x.lineTo(25,29);x.closePath();x.fill();
 x.fillStyle='rgba(255,230,120,.9)';x.beginPath();x.arc(10,24,2,0,7);x.arc(48,24,2,0,7);x.fill()});
PA.bag=pcv(46,52,(x,w,h)=>{shadow(x,w,h);x.beginPath();x.moveTo(15,10);x.quadraticCurveTo(2,26,4,40);x.quadraticCurveTo(6,50,23,50);x.quadraticCurveTo(40,50,42,40);x.quadraticCurveTo(44,26,31,10);x.closePath();x.fillStyle=lg(x,10,50,[[0,'#c9a56a'],[1,'#8a6a34']]);x.fill();x.strokeStyle='#4e3814';x.lineWidth=1.8;x.stroke();
 x.fillStyle='#d8434a';rr(x,14,6,18,7,3);x.fill();x.strokeStyle='#6a1418';x.lineWidth=1.2;x.stroke();
 x.fillStyle='#2f5a1f';x.font='bold 22px sans-serif';x.textAlign='center';x.fillText('$',23,38)});

/* ================= Phase 1 graphics upgrade: new roadside obstacles / decor ================= */
/* stacked tyres */
PA.tires=pcv(70,62,(x,w,h)=>{shadow(x,w,h);
 const tire=(cx,cy,rx,ry)=>{ell(x,cx,cy,rx,ry,lg(x,cy-ry,cy+ry,[[0,'#4a4a52'],[1,'#17171b']]));x.strokeStyle='#0b0b0e';x.lineWidth=1.6;x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,7);x.stroke();
  ell(x,cx,cy,rx*.55,ry*.5,'#0e0e12');x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=1.2;x.beginPath();x.ellipse(cx,cy-ry*.1,rx*.82,ry*.7,0,Math.PI*1.1,Math.PI*1.9);x.stroke()};
 tire(20,48,18,10);tire(50,48,18,10);tire(35,34,18,10);tire(35,20,18,10)});
/* round hay bale */
PA.hay=pcv(70,56,(x,w,h)=>{shadow(x,w,h);ell(x,35,32,28,22,lg(x,10,54,[[0,'#f0cf6a'],[1,'#b8892c']]));x.strokeStyle='#7a5512';x.lineWidth=1.8;x.beginPath();x.ellipse(35,32,28,22,0,0,7);x.stroke();
 x.strokeStyle='rgba(122,85,18,.55)';x.lineWidth=1.2;[18,12,6].forEach(r=>{x.beginPath();x.ellipse(35,32,r*1.25,r,0,0,7);x.stroke()});
 x.strokeStyle='rgba(255,246,190,.55)';x.beginPath();x.ellipse(35,32,24,18,0,Math.PI*1.05,Math.PI*1.6);x.stroke()});
/* striped road barrier */
PA.barrier=pcv(120,52,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#55555c';[[14,24],[96,24]].forEach(p=>{x.fillRect(p[0],p[1],8,h-26)});
 rr(x,4,8,112,22,4);x.fillStyle='#f4f4f4';x.fill();x.save();x.clip();x.fillStyle='#e8481e';for(let i=-2;i<9;i++){x.beginPath();x.moveTo(i*16,8);x.lineTo(i*16+10,8);x.lineTo(i*16-6,30);x.lineTo(i*16-16,30);x.closePath();x.fill()}x.restore();
 rr(x,4,8,112,22,4);x.strokeStyle='#2c2c32';x.lineWidth=2;x.stroke();x.fillStyle='rgba(255,255,255,.45)';x.fillRect(8,10,104,3)});
/* roadside lantern post */
PA.lamp=pcv(40,120,(x,w,h)=>{shadow(x,w,h);x.fillStyle=lg(x,30,h,[[0,'#4a4a52'],[1,'#26262c']]);x.fillRect(17,26,6,h-30);rr(x,12,h-12,16,8,2);x.fill();
 rr(x,9,6,22,22,4);x.fillStyle='#ffe69a';x.shadowColor='#ffd060';x.shadowBlur=14;x.fill();x.shadowBlur=0;x.strokeStyle='#26262c';x.lineWidth=2;x.stroke();
 x.beginPath();x.moveTo(6,8);x.lineTo(20,0);x.lineTo(34,8);x.closePath();x.fillStyle='#26262c';x.fill()});
/* wooden warning board (zig-zag arrow) */
PA.warn=pcv(70,86,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#6a4426';x.fillRect(31,40,8,h-42);
 x.beginPath();x.moveTo(35,4);x.lineTo(66,56);x.lineTo(4,56);x.closePath();x.fillStyle='#ffcf2e';x.fill();x.strokeStyle='#3a2a08';x.lineWidth=3;x.stroke();
 x.fillStyle='#2a2a2a';x.font='bold 30px sans-serif';x.textAlign='center';x.fillText('!',35,50)});

/* richer boulder + cone (override the originals with more shading) */
PA.boulder=pcv(120,64,(x,w,h)=>{shadow(x,w,h);[[[4,60],[18,30],[48,14],[70,32],[76,60]],[[52,60],[62,36],[88,22],[112,38],[116,60]],[[30,60],[40,40],[66,34],[84,60]]].forEach((p,i)=>{
 x.beginPath();p.forEach((q,j)=>j?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();x.fillStyle=lg(x,14,60,[[0,i===2?'#cfcfcf':'#b6b6b6'],[.55,'#8a8a90'],[1,'#56565c']]);x.fill();x.strokeStyle='#33333a';x.lineWidth=1.8;x.stroke();
 x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=1.4;x.beginPath();x.moveTo(p[1][0]+2,p[1][1]+3);x.lineTo(p[2][0]-2,p[2][1]+2);x.stroke();
 x.strokeStyle='rgba(30,30,36,.5)';x.lineWidth=1.1;x.beginPath();x.moveTo(p[2][0],p[2][1]+6);x.lineTo(p[2][0]+4,p[2][1]+22);x.lineTo(p[2][0]-3,p[2][1]+30);x.stroke()});
 x.fillStyle='#4f9a3a';[[18,56],[96,56]].forEach(m=>{x.beginPath();x.ellipse(m[0],m[1],9,3.4,0,0,7);x.fill()})});
PA.cone=pcv(34,44,(x,w,h)=>{shadow(x,w,h);x.fillStyle='#2a2a30';rr(x,2,h-8,30,7,2);x.fill();
 x.beginPath();x.moveTo(17,2);x.lineTo(28,h-8);x.lineTo(6,h-8);x.closePath();x.fillStyle=lg(x,2,h,[[0,'#ffa94a'],[1,'#e2531a']]);x.fill();x.strokeStyle='#8a2a0a';x.lineWidth=1.4;x.stroke();
 x.fillStyle='#fff';x.beginPath();x.moveTo(13.5,14);x.lineTo(20.5,14);x.lineTo(22.6,22);x.lineTo(11.4,22);x.closePath();x.fill();
 x.beginPath();x.moveTo(10.4,26);x.lineTo(23.6,26);x.lineTo(25,32);x.lineTo(9,32);x.closePath();x.fill();
 x.fillStyle='rgba(255,255,255,.4)';x.beginPath();x.ellipse(13,16,1.6,8,.15,0,7);x.fill()});
