'use strict';
/* Hillclimb Racing - Phase 1 car art.
   Replaces the flat painters for the sports car, pickup, police cruiser and monster truck with detailed, shaded
   versions that match the reference Jeep (glossy paint, panel gaps, chrome, lamps with glow, arches with flares).
   Silhouettes, windshield anchors and driver positions are unchanged, so physics and rider placement are untouched.
   Loaded after veh.js (uses its sh / lg / ln / rr / bodyPaint helpers and the P painter table). */

/* ---------- shared detailing ---------- */
/* glossy sheen over the current path: bright band along the top, soft darkening underneath, sharp specular streak */
function cShine(x,c,x0,y0,x1,y1){x.save();x.clip();
 const g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.22,'rgba(255,255,255,.08)');g.addColorStop(.6,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.28)');
 x.fillStyle=g;x.fillRect(x0,y0,x1-x0,y1-y0);
 /* specular streak drawn with fillRect so the body path stays current for the caller's later clip() */
 x.fillStyle='rgba(255,255,255,.5)';x.save();x.translate(x0+14,y0+(y1-y0)*.28);x.rotate(Math.atan2(-(y1-y0)*.06,(x1-x0)-36));x.fillRect(0,-.8,(x1-x0)-36,1.6);x.restore();
 x.restore()}
/* headlamp: dark bezel, glassy lens, warm hot-spot and a soft glow */
function cLamp(x,cx,cy,w,h,warm){x.save();x.shadowColor=warm||'#fff6c0';x.shadowBlur=9;
 x.fillStyle='#1a1c22';rr(x,cx-w/2-1.2,cy-h/2-1.2,w+2.4,h+2.4,3);x.fill();x.shadowBlur=0;
 x.fillStyle=lg(x,cy-h/2,cy+h/2,[[0,'#ffffff'],[.5,warm||'#fff3b0'],[1,'#d9b84a']]);rr(x,cx-w/2,cy-h/2,w,h,2.4);x.fill();
 x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.ellipse(cx+w*.12,cy-h*.12,w*.22,h*.2,0,0,7);x.fill();x.restore()}
function cTail(x,cx,cy,w,h){x.save();x.shadowColor='#ff3030';x.shadowBlur=6;x.fillStyle=lg(x,cy-h/2,cy+h/2,[[0,'#ff6a6a'],[1,'#a50d14']]);rr(x,cx-w/2,cy-h/2,w,h,2);x.fill();x.restore();
 x.strokeStyle='#4a0508';x.lineWidth=.8;rr(x,cx-w/2,cy-h/2,w,h,2);x.stroke()}
/* wheel arch: deep cavity, flared lip in body colour, soft inner shadow */
function cArch(x,c,cx,cy,r,top){x.save();
 x.fillStyle='#07080b';x.beginPath();x.arc(cx,cy,r,Math.PI,0);x.lineTo(cx+r,cy+6);x.lineTo(cx-r,cy+6);x.closePath();x.fill();
 const g=x.createRadialGradient(cx,cy,r*.3,cx,cy,r);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(60,64,76,.55)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,Math.PI,0);x.fill();
 x.lineWidth=top||4;x.strokeStyle=sh(c,-.55);x.beginPath();x.arc(cx,cy,r+1.5,Math.PI*1.02,Math.PI*1.98);x.stroke();
 x.lineWidth=1.3;x.strokeStyle='rgba(255,255,255,.28)';x.beginPath();x.arc(cx,cy,r+3.6,Math.PI*1.12,Math.PI*1.7);x.stroke();x.restore()}
const cHandle=(x,px,py,w)=>{x.fillStyle=lg(x,py-2,py+3,[[0,'#f2f5fa'],[1,'#8a93a5']]);rr(x,px,py,w||11,3.4,1.7);x.fill();x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=.6;x.stroke()};
const cMirror=(x,c,px,py)=>{x.fillStyle=sh(c,-.2);rr(x,px,py,8,6,2.4);x.fill();x.strokeStyle=sh(c,-.6);x.lineWidth=1;x.stroke();x.fillStyle='rgba(170,215,245,.8)';rr(x,px+1.6,py+1.2,4,3.6,1.4);x.fill()};
const cChrome=(x,px,py,w,h,r)=>{x.fillStyle=lg(x,py,py+h,[[0,'#ffffff'],[.45,'#c4ccd8'],[.55,'#7f8aa0'],[1,'#d8dee8']]);rr(x,px,py,w,h,r||2);x.fill();x.strokeStyle='#2a2e38';x.lineWidth=.9;x.stroke()};
const cGap=(x,c,pts,w)=>{x.strokeStyle=sh(c,-.6);x.lineWidth=w||1.2;x.lineCap='round';x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();
 x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=.7;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0]+.9,p[1]+.9):x.moveTo(p[0]+.9,p[1]+.9));x.stroke()};
const cRivets=(x,x0,x1,y,n,col)=>{x.fillStyle=col||'rgba(255,255,255,.35)';for(let i=0;i<n;i++){x.beginPath();x.arc(x0+(x1-x0)*i/(n-1),y,.9,0,7);x.fill()}};

/* ---------- Lightning GT: low aero supercar ---------- */
P.sports=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 /* carbon rocker + diffuser */
 x.fillStyle='#0c0d11';rr(x,-102,8,216,14,6);x.fill();
 cRivets(x,-92,100,15,14,'rgba(120,130,150,.5)');
 /* rear wing: endplates + blade on struts */
 x.fillStyle=sh(c,-.5);rr(x,-114,-34,3,16,1);x.fill();
 ln(x,[-100,-20],[-102,-30],3,'#15171d');ln(x,[-84,-22],[-86,-30],3,'#15171d');
 x.fillStyle=lg(x,-36,-28,[[0,sh(c,.2)],[1,sh(c,-.4)]]);rr(x,-118,-35,36,6,2.5);x.fill();x.strokeStyle=sh(c,-.65);x.lineWidth=1.2;x.stroke();
 /* body shell */
 x.beginPath();x.moveTo(-104,18);x.lineTo(-106,-2);x.quadraticCurveTo(-104,-16,-86,-20);x.lineTo(-80,-26);x.quadraticCurveTo(-62,-40,-46,-27);x.quadraticCurveTo(-42,-22,-34,-22);x.lineTo(38,-22);x.quadraticCurveTo(46,-22,54,-25);x.lineTo(98,-13);x.quadraticCurveTo(114,-9,114,6);x.lineTo(114,18);x.closePath();
 bodyPaint(x,c,lg(x,-48,20,[[0,l],[.35,c],[1,d]]));cShine(x,c,-110,-44,118,20);
 x.save();x.clip();
 /* twin racing stripes + lower carbon skirt */
 x.fillStyle='rgba(10,10,14,.88)';x.fillRect(-110,-9,230,3.2);x.fillRect(-110,-3.6,230,1.6);
 x.fillStyle='rgba(8,9,12,.92)';x.fillRect(-110,11,230,9);
 /* hood vents + side scoop behind the door */
 x.fillStyle='#0a0b0f';[[56,-20],[64,-18.6],[72,-17.2]].forEach(p=>{x.save();x.translate(p[0],p[1]);x.rotate(.2);x.fillRect(0,0,6,1.6);x.restore()});
 x.restore();
 x.beginPath();x.moveTo(-30,-3);x.lineTo(-6,-5);x.lineTo(-8,8);x.lineTo(-32,8);x.closePath();x.fillStyle='#08090c';x.fill();x.strokeStyle=sh(c,-.5);x.lineWidth=1;x.stroke();
 x.strokeStyle='rgba(120,130,150,.6)';x.lineWidth=.8;for(let i=0;i<4;i++){x.beginPath();x.moveTo(-28+i*5,-3.4);x.lineTo(-29+i*5,7);x.stroke()}
 /* beltline, door cut, B-pillar shut lines */
 ln(x,[-34,-22],[38,-22],2.4,'#14161c','butt');
 cGap(x,c,[[-10,-19],[-10,11]]);cGap(x,c,[[34,-19],[34,11]]);cGap(x,c,[[-10,11],[34,11]],.9);
 cHandle(x,-24,-14,10);cMirror(x,c,38,-30);
 /* lamps */
 x.save();x.beginPath();x.moveTo(98,-13);x.quadraticCurveTo(114,-9,114,6);x.lineTo(104,6);x.lineTo(96,-8);x.closePath();x.fillStyle='#0d0e12';x.fill();x.restore();
 cLamp(x,105,-5,13,6.4);
 x.fillStyle='#0b0c10';rr(x,102,6,12,8,2);x.fill();x.strokeStyle='rgba(120,130,150,.6)';x.lineWidth=.7;for(let i=0;i<3;i++){x.beginPath();x.moveTo(103,8+i*2.4);x.lineTo(113,8+i*2.4);x.stroke()}
 cTail(x,-106,-6,5,9);ln(x,[-106,-1],[-98,-1],1,'rgba(255,60,60,.8)');
 cChrome(x,-114,10,5,5,1.4);
 /* splitter */
 x.fillStyle='#0c0d11';rr(x,98,15,20,4,2);x.fill();
 /* wheel arches */
 cArch(x,c,-68,26,30,4);cArch(x,c,68,26,30,4)};

/* ---------- Dune Hauler: pickup truck ---------- */
P.pickup=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 /* tow hitch + exhaust tip peeking under the tail */
 cChrome(x,-122,12,10,5,1.4);x.fillStyle='#2a2e38';rr(x,-118,17,6,4,1);x.fill();
 /* body */
 x.beginPath();x.moveTo(-110,18);x.lineTo(-110,-16);x.lineTo(-26,-16);x.lineTo(-26,-37);x.quadraticCurveTo(-25,-41,-18,-40);x.lineTo(-9,-30);x.lineTo(46,-30);x.lineTo(58,-20);x.lineTo(110,-14);x.quadraticCurveTo(120,-12,120,0);x.lineTo(120,18);x.closePath();
 bodyPaint(x,c,lg(x,-52,20,[[0,l],[.4,c],[1,d]]));cShine(x,c,-112,-46,122,20);
 /* cargo bed: dark ribbed liner, rails, tie-downs */
 x.fillStyle=lg(x,-12,2,[[0,'#0e1015'],[1,'#242831']]);rr(x,-104,-12,74,14,3);x.fill();x.strokeStyle='#05060a';x.lineWidth=1.1;x.stroke();
 x.strokeStyle='rgba(150,160,180,.35)';x.lineWidth=.9;for(let i=0;i<9;i++){x.beginPath();x.moveTo(-100+i*8.2,-11);x.lineTo(-100+i*8.2,1);x.stroke()}
 x.fillStyle=lg(x,-18,-12,[[0,sh(c,.3)],[1,sh(c,-.35)]]);rr(x,-110,-19,86,6,3);x.fill();x.strokeStyle=sh(c,-.65);x.lineWidth=1.1;x.stroke();
 cChrome(x,-102,-11,3,4,1);cChrome(x,-36,-11,3,4,1);
 /* sport bar behind the cab */
 x.strokeStyle='#cfd6e0';x.lineWidth=3;x.lineCap='round';x.beginPath();x.moveTo(-30,-16);x.lineTo(-33,-52);x.lineTo(-48,-52);x.stroke();
 x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=.8;x.stroke();
 for(let i=0;i<3;i++)cLamp(x,-44+i*4.4,-56,3.6,3.6,'#ffe8a0');
 ln(x,[-48,-52],[-48,-45],2.4,'#cfd6e0');
 /* cab: roofline shut, door, handle, mirror */
 ln(x,[-9,-30],[46,-30],2.4,'#14161c','butt');
 cGap(x,c,[[-26,-16],[-26,16]]);cGap(x,c,[[26,-30],[26,16]]);cGap(x,c,[[-26,16],[26,16]],.9);
 cHandle(x,12,-24,11);cMirror(x,c,44,-34);
 /* running board + fender flares */
 x.fillStyle=lg(x,14,20,[[0,'#d6dce6'],[1,'#6f788c']]);rr(x,-30,15,66,5,2.4);x.fill();x.strokeStyle='#23262e';x.lineWidth=.9;x.stroke();
 /* grille + bumper + lamps + fog light */
 x.fillStyle='#0f1116';rr(x,104,-12,14,18,2);x.fill();x.strokeStyle='#c4ccd8';x.lineWidth=.9;for(let i=0;i<4;i++){x.beginPath();x.moveTo(105,-9+i*4.2);x.lineTo(117,-9+i*4.2);x.stroke()}
 cLamp(x,110,-14,12,5.6);
 cChrome(x,111,-1,11,19,3);cLamp(x,118,12,5,3.6,'#ffe9a0');
 x.fillStyle='#e0e6ee';rr(x,106,-1,6,2,1);x.fill();
 cTail(x,-110,-6,4,10);cChrome(x,-116,10,8,8,2);
 /* mud flaps + body lower trim */
 x.fillStyle='#101218';rr(x,-100,15,2.4,12,1);x.fill();rr(x,98,15,2.4,10,1);x.fill();
 x.fillStyle=sh(c,-.5);rr(x,-110,18,230,5,2);x.fill();
 /* wheel arches */
 cArch(x,c,-72,22,36,5);cArch(x,c,70,22,36,5)};

/* ---------- Patrol Cruiser: police truck ---------- */
P.police=(x,c,v)=>{const l=sh(c,.25);
 x.beginPath();x.moveTo(-104,18);x.lineTo(-104,-14);x.quadraticCurveTo(-102,-24,-92,-26);x.lineTo(-50,-27);x.lineTo(48,-27);x.lineTo(54,-26);x.lineTo(96,-18);x.quadraticCurveTo(108,-16,108,-4);x.lineTo(108,18);x.closePath();
 bodyPaint(x,c,lg(x,-58,20,[[0,l],[.45,c],[1,sh(c,-.4)]]));
 x.save();x.clip();
 /* white door + rear quarter livery, blue pinstripe, black hood and trunk */
 x.fillStyle=lg(x,-27,19,[[0,'#ffffff'],[1,'#c9d0dc']]);x.fillRect(-40,-27,76,46);
 x.fillStyle='#1b57c9';x.fillRect(-110,-1,230,2.6);x.fillStyle='#d8232a';x.fillRect(-110,2.2,230,1.4);
 x.fillStyle='rgba(255,255,255,.3)';x.fillRect(-110,-26,230,2.4);
 x.restore();cShine(x,c,-106,-52,112,20);
 /* panel gaps */
 cGap(x,c,[[-40,-26],[-40,17]]);cGap(x,c,[[36,-26],[36,17]]);
 /* door: shield badge, POLICE text, unit number */
 x.save();x.translate(-22,-15);x.fillStyle='#d9a82a';x.beginPath();x.moveTo(0,-6);x.lineTo(5,-4);x.lineTo(4.4,2);x.quadraticCurveTo(0,7,-4.4,2);x.lineTo(-5,-4);x.closePath();x.fill();x.strokeStyle='#6a4a0a';x.lineWidth=.8;x.stroke();
 x.fillStyle='#fff3b0';star5(x,0,-.6,2.6);x.restore();
 x.fillStyle='#14263f';x.font='bold 10px Arial';x.textAlign='center';x.fillText('POLICE',14,-12);
 x.font='bold 7px Arial';x.fillText('UNIT 07',14,-4.5);x.fillStyle='#1b57c9';x.fillRect(0,-2.4,28,1.2);
 ln(x,[-50,-27],[48,-27],2.4,'#14161c','butt');
 cHandle(x,-36,-20,8);cHandle(x,2,-20,8);cMirror(x,c,40,-34);
 /* push bar + lamps + grille */
 x.strokeStyle='#14161c';x.lineWidth=3.2;x.beginPath();x.moveTo(108,-8);x.lineTo(116,-8);x.lineTo(116,15);x.lineTo(108,15);x.stroke();
 x.strokeStyle='#8c96aa';x.lineWidth=1;x.stroke();x.strokeStyle='#14161c';x.lineWidth=2;x.beginPath();x.moveTo(116,2);x.lineTo(108,2);x.stroke();
 cLamp(x,100,-11,11,5.2);x.fillStyle='#0f1116';rr(x,100,-4,10,14,2);x.fill();
 x.strokeStyle='#8c96aa';x.lineWidth=.7;for(let i=0;i<3;i++){x.beginPath();x.moveTo(101,-1+i*4);x.lineTo(109,-1+i*4);x.stroke()}
 cTail(x,-104,-10,4.4,9);x.fillStyle='#1c1f26';rr(x,-108,10,8,8,2);x.fill();
 /* roof light-bar mount + spotlight + antenna (the bar's flashing lenses are drawn live by drawVeh) */
 ln(x,[-30,-27],[-30,-62],4,'#1b1d24');ln(x,[24,-62],[36,-48],4,'#1b1d24');x.fillStyle=lg(x,-70,-60,[[0,'#3a3f4a'],[1,'#14161c']]);rr(x,-32,-68,58,8,3);x.fill();
 x.fillStyle='#e8f1ff';x.beginPath();x.arc(-40,-48,3.2,0,7);x.fill();ln(x,[-40,-45],[-40,-27],1.6,'#2a2e38');
 ln(x,[-96,-26],[-110,-70],1.2,'#2a2e38');x.fillStyle='#d8232a';x.beginPath();x.arc(-110,-70,1.6,0,7);x.fill();
 cArch(x,c,-64,22,34,4);cArch(x,c,64,22,34,4)};

/* ---------- Crimson Crusher: monster truck ---------- */
P.monster=(x,c,v)=>{const d=sh(c,-.45),l=sh(c,.4);
 /* coil-over shocks (chrome with gold springs) + axles */
 [[-66,12,-40,-14],[66,12,40,-14]].forEach(q=>{ln(x,[q[0],q[1]],[q[2],q[3]],9,'#1a1d25');ln(x,[q[0],q[1]],[q[2],q[3]],6,'#c4ccd8');ln(x,[q[0],q[1]],[q[2],q[3]],2,'#ffffff');
  x.strokeStyle='#e8b21f';x.lineWidth=2;for(let i=1;i<7;i++){const t=i/7,px=q[0]+(q[2]-q[0])*t,py=q[1]+(q[3]-q[1])*t;x.beginPath();x.moveTo(px-5,py+2);x.lineTo(px+5,py-2);x.stroke()}});
 x.fillStyle=lg(x,-14,-2,[[0,'#3a4050'],[1,'#12141a']]);rr(x,-92,-14,190,12,4);x.fill();x.strokeStyle='#05060a';x.lineWidth=1;x.stroke();
 cRivets(x,-84,90,-8,16,'rgba(190,200,220,.4)');
 /* roll cage + light bar (drawn behind the body so the cab sits inside) */
 x.strokeStyle='#0e1015';x.lineWidth=6.4;x.lineJoin='round';x.beginPath();x.moveTo(-52,-69);x.lineTo(-52,-118);x.lineTo(20,-118);x.lineTo(34,-76);x.stroke();x.lineWidth=5;x.beginPath();x.moveTo(-52,-98);x.lineTo(-78,-68);x.stroke();
 x.strokeStyle='#d9dfe8';x.lineWidth=4;x.beginPath();x.moveTo(-52,-69);x.lineTo(-52,-118);x.lineTo(20,-118);x.lineTo(34,-76);x.stroke();x.lineWidth=3;x.beginPath();x.moveTo(-52,-98);x.lineTo(-78,-68);x.stroke();
 x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=1;x.beginPath();x.moveTo(-53,-70);x.lineTo(-53,-119);x.lineTo(19,-119);x.stroke();
 x.fillStyle='#15171d';rr(x,-46,-123,64,9,3);x.fill();
 for(let i=0;i<4;i++)cLamp(x,-36+i*16,-118.5,10,5,'#ffe27a');
 /* body */
 x.beginPath();x.moveTo(-100,-12);x.lineTo(-98,-56);x.quadraticCurveTo(-96,-68,-84,-68);x.lineTo(-62,-68);x.lineTo(38,-69);x.lineTo(40,-70);x.lineTo(90,-62);x.quadraticCurveTo(104,-60,104,-46);x.lineTo(104,-12);x.closePath();
 bodyPaint(x,c,lg(x,-104,-10,[[0,l],[.4,c],[1,d]]));cShine(x,c,-102,-70,106,-10);
 x.save();x.clip();
 /* outlined flames */
 [[-96,-30,-60,-52,-30,-34,-60,-30,-96,-22],[-96,-44,-70,-66,-44,-52,-70,-46,-96,-40]].forEach((f,i)=>{const g=x.createLinearGradient(-96,0,-30,0);g.addColorStop(0,'#ffe03a');g.addColorStop(.55,'#ff8a1a');g.addColorStop(1,'#c8141c');
  x.beginPath();x.moveTo(f[0],f[1]);x.quadraticCurveTo(f[2],f[3],f[4],f[5]);x.quadraticCurveTo(f[6],f[7],f[8],f[9]);x.closePath();x.fillStyle=g;x.fill();x.strokeStyle='#5a0a0a';x.lineWidth=1.4;x.stroke()});
 /* mud splatter along the sill */
 x.fillStyle='rgba(90,56,28,.55)';for(let i=0;i<26;i++){const px=-96+((i*47)%190),py=-24+((i*29)%14);x.beginPath();x.ellipse(px,py,1+(i%3),.7+(i%2),0,0,7);x.fill()}
 x.fillStyle='rgba(60,36,18,.5)';x.fillRect(-100,-20,206,8);
 x.restore();
 /* number roundel + beltline + hood scoop */
 x.fillStyle='#f4f6fa';x.beginPath();x.arc(-8,-44,9,0,7);x.fill();x.strokeStyle='#111';x.lineWidth=1.3;x.stroke();x.fillStyle='#d8232a';x.font='bold 12px Arial';x.textAlign='center';x.fillText('9',-8,-40);
 ln(x,[-62,-68],[38,-69],2.4,'#14161c','butt');
 cGap(x,c,[[-24,-66],[-24,-14]]);cGap(x,c,[[26,-66],[26,-14]]);cHandle(x,-18,-60,10);
 x.fillStyle='#0a0b0f';x.beginPath();x.moveTo(52,-66);x.lineTo(78,-60);x.lineTo(76,-56);x.lineTo(54,-60);x.closePath();x.fill();
 x.strokeStyle='rgba(180,190,210,.5)';x.lineWidth=.7;for(let i=0;i<4;i++){x.beginPath();x.moveTo(56+i*5,-64+i*1.4);x.lineTo(57+i*5,-60.4+i*1.4);x.stroke()}
 /* front: grille, twin lamps, bull bar */
 x.fillStyle='#0f1116';rr(x,94,-56,10,38,2);x.fill();x.strokeStyle='#c4ccd8';x.lineWidth=.9;for(let i=0;i<7;i++){x.beginPath();x.moveTo(95,-53+i*5.2);x.lineTo(103,-53+i*5.2);x.stroke()}
 cLamp(x,99,-58,12,6);cLamp(x,99,-23,10,5,'#ffe9a0');
 cChrome(x,100,-44,12,28,3);ln(x,[106,-40],[106,-20],1.4,'rgba(255,255,255,.7)');
 cTail(x,-102,-44,4.6,10);
 /* exhaust stacks */
 [[-92,-64],[-84,-64]].forEach(p=>{x.fillStyle=lg(x,p[1]-26,p[1],[[0,'#e8edf4'],[.5,'#8a93a5'],[1,'#3a3f4c']]);rr(x,p[0]-2,p[1]-30,5,30,2);x.fill();x.strokeStyle='#1a1d25';x.lineWidth=.8;x.stroke();x.fillStyle='#0a0b0f';x.beginPath();x.ellipse(p[0]+.5,p[1]-30,2.5,1.2,0,0,7);x.fill()})};
