'use strict';
/* Hillclimb Racing - Phase 1 bridges.
   One bridge style per world, all drawn over the same physics deck (Hf), so driving is identical on every style:
     0 Green Hills  stone arch  (+ keystones, moss, lanterns)
     1 Desert       timber trestle (planks, braced piers, rope-rail posts, waving pennants)
     2 Snow         stone arch  (+ snow caps, icicles)
     3 Night        steel truss (girders, rivets, X-braced legs, glowing hanging lamps)
   Loaded after props.js; uses the main script's canvas context g and the Hf / Gv terrain functions at call time. */

/* band between two offsets below the deck line, clipped to the visible span */
function brBand(xa,xb,o0,o1){const xs=[];for(let x=xa;x<xb;x+=16)xs.push(x);xs.push(xb);
 g.beginPath();xs.forEach((x,i)=>i?g.lineTo(x,Hf(x)+o0):g.moveTo(x,Hf(x)+o0));for(let i=xs.length-1;i>=0;i--)g.lineTo(xs[i],Hf(xs[i])+o1);g.closePath()}
function brLine(xa,xb,off){g.beginPath();for(let x=xa;x<xb;x+=16)x===xa?g.moveTo(x,Hf(x)+off):g.lineTo(x,Hf(x)+off);g.lineTo(xb,Hf(xb)+off)}
const brRng=i=>{const s=Math.sin(i*127.1+311.7)*43758.5453;return s-Math.floor(s)};
function brFoam(gr,tt,px,rw){if(px>gr.wl&&px<gr.wr){g.save();g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(px,gr.wy+1,rw+Math.sin(tt*3+px)*2,3.2,0,0,7);g.fill();g.restore()}}
function brLamp(x,y,r,tt,seed){const f=.85+.15*Math.sin(tt*5+seed);g.save();const gl=g.createRadialGradient(x,y,1,x,y,r*f);gl.addColorStop(0,'rgba(255,226,150,.65)');gl.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=gl;g.beginPath();g.arc(x,y,r*f,0,7);g.fill();
 g.fillStyle='#fff6cc';g.beginPath();g.arc(x,y,4,0,7);g.fill();g.restore()}

/* ---------- stone: extras layered over the existing arch bridge ---------- */
function bridgeStoneExtras(gr,tt,x0,x1,snow){const a=gr.a,b=gr.b,U=26;
 const n=Math.max(3,Math.round((b-a)/190)),pw=34,aw=((b-a)-(n+1)*pw)/n;
 /* keystones at each arch crown */
 for(let i=0;i<n;i++){const xl=a+pw*(i+1)+aw*i,cx=xl+aw/2,r=aw/2,crown=Hf(cx)+U+10;if(cx<x0-80||cx>x1+80)continue;
  g.save();g.beginPath();g.moveTo(cx-11,crown-9);g.lineTo(cx+11,crown-9);g.lineTo(cx+8,crown+9);g.lineTo(cx-8,crown+9);g.closePath();
  g.fillStyle=lg(g,crown-9,crown+9,[[0,'#dcd3bf'],[1,'#a39a86']]);g.fill();g.lineWidth=2;g.strokeStyle='#463c30';g.stroke();
  g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=1.2;g.beginPath();g.moveTo(cx-9,crown-7);g.lineTo(cx+9,crown-7);g.stroke();g.restore()}
 const xa=Math.max(a,x0-60),xb=Math.min(b,x1+60);if(xb<=xa)return;
 g.save();
 if(!snow){
  /* moss creeping along the deck underside + lanterns on the parapet posts */
  g.fillStyle='rgba(84,146,52,.78)';for(let x=Math.floor(xa/22)*22;x<xb;x+=22){const k=x/22,h=5+brRng(k)*13,w=10+brRng(k+9)*14;if(brRng(k+3)<.35)continue;g.beginPath();g.moveTo(x,Hf(x)+U-3);g.quadraticCurveTo(x+w/2,Hf(x)+U+h,x+w,Hf(x+w)+U-3);g.closePath();g.fill()}
  g.fillStyle='rgba(120,190,70,.55)';for(let x=Math.floor(xa/22)*22;x<xb;x+=22){const k=x/22;if(brRng(k+3)<.6)continue;g.beginPath();g.arc(x+6,Hf(x)+U+1,3+brRng(k)*3,0,7);g.fill()}
  for(let x=a+6;x<=b-6;x+=96){if(x<x0-40||x>x1+40)continue;const y=Hf(x)-6-38-24;
   g.fillStyle='#3a3226';g.fillRect(x-1.5,y-10,3,10);g.fillStyle='#2a241c';g.fillRect(x-7,y-12,14,3);
   g.save();g.shadowColor='#ffcf70';g.shadowBlur=10;g.fillStyle=lg(g,y-26,y-10,[[0,'#fff0b8'],[1,'#f2b24a']]);g.fillRect(x-5,y-26,10,14);g.restore();
   g.strokeStyle='#2a241c';g.lineWidth=1.6;g.strokeRect(x-5,y-26,10,14);g.beginPath();g.moveTo(x-7,y-26);g.lineTo(x,y-33);g.lineTo(x+7,y-26);g.closePath();g.fillStyle='#2a241c';g.fill()}
 }else{
  /* snow: drifts on the parapet cap and deck lip, snow hats on the posts, icicles under the deck */
  g.strokeStyle='#f6fbff';g.lineWidth=9;g.lineCap='round';brLine(xa+6,xb-6,-6-38-4);g.stroke();
  g.strokeStyle='rgba(180,215,240,.8)';g.lineWidth=2;brLine(xa+6,xb-6,-6-38+1);g.stroke();
  g.strokeStyle='#eef8ff';g.lineWidth=5;brLine(xa,xb,-1);g.stroke();
  for(let x=a+6;x<=b-6;x+=96){if(x<x0-40||x>x1+40)continue;const y=Hf(x)-6-38-24;g.fillStyle='#fbfeff';g.beginPath();g.ellipse(x,y+1,14,6,0,Math.PI,0);g.fill();g.fillRect(x-14,y,28,2.4);g.strokeStyle='rgba(150,190,220,.7)';g.lineWidth=1;g.beginPath();g.ellipse(x,y+1,14,6,0,Math.PI,0);g.stroke()}
  for(let x=Math.floor(xa/26)*26;x<xb;x+=26){const k=x/26;if(brRng(k+5)<.3)continue;const h=8+brRng(k)*22,y=Hf(x)+U-1;g.beginPath();g.moveTo(x-3,y);g.lineTo(x+3,y);g.lineTo(x,y+h);g.closePath();g.fillStyle=lg(g,y,y+h,[[0,'rgba(240,252,255,.95)'],[1,'rgba(150,205,240,.7)']]);g.fill()}
 }
 g.restore()}

/* ---------- timber trestle ---------- */
function woodH(x0,x1){const q=g.createLinearGradient(x0,0,x1,0);q.addColorStop(0,'#b98348');q.addColorStop(.5,'#cf9a5c');q.addColorStop(1,'#8a5a2c');return q}
function bridgeTimber(gr,tt,x0,x1){const a=gr.a,b=gr.b,U=24,xa=Math.max(a,x0-60),xb=Math.min(b,x1+60);if(xb<=xa)return;
 /* trestle bents */
 const n=Math.max(3,Math.round((b-a)/150)),pw=(b-a)/n;
 for(let i=1;i<n;i++){const px=a+pw*i;if(px<x0-80||px>x1+80)continue;const top=Hf(px)+U,bot=Gv(px)+6;if(bot-top<24)continue;
  const sp=18,sb=28;g.save();g.lineCap='butt';
  const post=(ox,ob)=>{g.beginPath();g.moveTo(px+ox-7,top);g.lineTo(px+ox+7,top);g.lineTo(px+ob+8,bot);g.lineTo(px+ob-8,bot);g.closePath();g.fillStyle=woodH(px+ox-7,px+ox+7);g.fill();g.strokeStyle='#3a2210';g.lineWidth=1.6;g.stroke();g.strokeStyle='rgba(60,34,14,.5)';g.lineWidth=1;g.beginPath();g.moveTo(px+ox-2,top+4);g.lineTo(px+ob-3,bot-4);g.stroke()};
  post(-sp,-sb);post(sp,sb);
  const hh=bot-top;[.34,.7].forEach((t,j)=>{const y0=top+hh*t,y1=top+hh*(t+.3)||0;const xl0=px-sp-(sb-sp)*t,xr0=px+sp+(sb-sp)*t,xl1=px-sp-(sb-sp)*(t+.3),xr1=px+sp+(sb-sp)*(t+.3);
   g.strokeStyle='#3a2210';g.lineWidth=7;g.beginPath();g.moveTo(xl0,y0);g.lineTo(xr1,Math.min(bot-4,top+hh*(t+.3)));g.moveTo(xr0,y0);g.lineTo(xl1,Math.min(bot-4,top+hh*(t+.3)));g.stroke();
   g.strokeStyle='#a8743c';g.lineWidth=4.4;g.stroke();g.strokeStyle='#3a2210';g.lineWidth=7;g.beginPath();g.moveTo(xl0-4,y0);g.lineTo(xr0+4,y0);g.stroke();g.strokeStyle='#a8743c';g.lineWidth=4.4;g.stroke()});
  g.fillStyle=woodH(px-40,px+40);g.fillRect(px-40,top,80,10);g.strokeStyle='#3a2210';g.lineWidth=1.6;g.strokeRect(px-40,top,80,10);
  g.fillStyle='#2a2a2e';[-32,32].forEach(o=>{g.beginPath();g.arc(px+o,top+5,2,0,7);g.fill()});
  g.restore();brFoam(gr,tt,px,30)}
 /* deck: planks + stringers */
 g.save();brBand(xa,xb,U,U+10);g.fillStyle='#5e3a1a';g.fill();g.lineWidth=1.6;g.strokeStyle='#2c1a0a';g.stroke();g.restore();
 g.save();brBand(xa,xb,0,U);g.fillStyle='#a9733a';g.fill();g.clip();
 for(let x=Math.floor(xa/24)*24;x<xb;x+=24){const k=x/24;g.fillStyle=brRng(k)<.5?'rgba(255,225,170,.12)':'rgba(40,20,6,.10)';g.fillRect(x,Hf(x)-4,24,U+8);g.strokeStyle='rgba(40,22,8,.6)';g.lineWidth=2;g.beginPath();g.moveTo(x,Hf(x)-4);g.lineTo(x,Hf(x)+U+4);g.stroke()}
 g.fillStyle='rgba(255,236,190,.5)';brBand(xa,xb,0,5);g.fill();g.fillStyle='rgba(30,16,4,.28)';brBand(xa,xb,U-6,U);g.fill();g.restore();
 g.save();g.lineWidth=2;g.strokeStyle='#2c1a0a';brBand(xa,xb,0,U);g.stroke();g.restore();
 /* rail: two ropes/rails, posts, diagonal braces, pennants */
 g.save();g.lineCap='round';
 [[-24,'#6e4620'],[-46,'#7a4d24']].forEach(r=>{g.strokeStyle='#2c1a0a';g.lineWidth=7;brLine(xa+8,xb-8,r[0]);g.stroke();g.strokeStyle=r[1];g.lineWidth=4.4;brLine(xa+8,xb-8,r[0]);g.stroke();g.strokeStyle='rgba(255,230,180,.35)';g.lineWidth=1.2;brLine(xa+8,xb-8,r[0]-1.6);g.stroke()});
 for(let x=a+10;x<=b-10;x+=70){if(x<xa-20||x>xb+20)continue;const y=Hf(x)-1,k=Math.round((x-a)/70);
  g.fillStyle=woodH(x-5,x+5);g.fillRect(x-5,y-58,10,60);g.strokeStyle='#2c1a0a';g.lineWidth=1.6;g.strokeRect(x-5,y-58,10,60);
  g.fillStyle='#8a5a2c';g.beginPath();g.moveTo(x-7,y-58);g.lineTo(x,y-66);g.lineTo(x+7,y-58);g.closePath();g.fill();g.stroke();
  g.strokeStyle='#2c1a0a';g.lineWidth=5;g.beginPath();g.moveTo(x+5,y-12);g.lineTo(x+26,y-2);g.stroke();g.strokeStyle='#8a5a2c';g.lineWidth=3;g.stroke();
  if(k%3===0){const w=Math.sin(tt*4+k)*3;g.beginPath();g.moveTo(x,y-64);g.lineTo(x+30+w,y-58+w*.4);g.lineTo(x+2,y-50);g.closePath();g.fillStyle=k%2?'#d8452a':'#f2b92a';g.fill();g.strokeStyle='#5a1c0c';g.lineWidth=1;g.stroke()}}
 g.restore();
 /* sandy dust drifting off the deck */
 g.save();g.fillStyle='rgba(222,190,130,.35)';for(let i=0;i<8;i++){const px=xa+((i*173+tt*40)%(xb-xa+1)),py=Hf(px)-2-((tt*20+i*9)%18);g.beginPath();g.arc(px,py,2+i%3,0,7);g.fill()}g.restore()}

/* ---------- steel truss ---------- */
function steelLine(x1,y1,x2,y2,w){g.strokeStyle='#161b27';g.lineWidth=w+3;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.strokeStyle='#6a7a96';g.lineWidth=w;g.stroke();g.strokeStyle='rgba(210,225,250,.5)';g.lineWidth=Math.max(1,w*.28);g.beginPath();g.moveTo(x1-1,y1-1);g.lineTo(x2-1,y2-1);g.stroke()}
function bridgeSteel(gr,tt,x0,x1){const a=gr.a,b=gr.b,U=22,xa=Math.max(a,x0-80),xb=Math.min(b,x1+80);if(xb<=xa)return;
 /* legs */
 const n=Math.max(3,Math.round((b-a)/190)),pw=(b-a)/n;g.save();g.lineCap='butt';
 for(let i=1;i<n;i++){const px=a+pw*i;if(px<x0-90||px>x1+90)continue;const top=Hf(px)+U+8,bot=Gv(px)+8;if(bot-top<24)continue;const hh=bot-top;
  steelLine(px-18,top,px-34,bot,9);steelLine(px+18,top,px+34,bot,9);
  [.3,.62,.92].forEach((t,j)=>{const xl=px-18-16*t,xr=px+18+16*t;steelLine(xl,top+hh*t,xr,top+hh*t,5)});
  steelLine(px-19,top+2,px+32,top+hh*.62,4);steelLine(px+19,top+2,px-32,top+hh*.62,4);steelLine(px-24,top+hh*.62,px+36,top+hh*.92,4);steelLine(px+24,top+hh*.62,px-36,top+hh*.92,4);
  g.fillStyle='#232a3a';g.fillRect(px-46,bot-4,92,8);g.strokeStyle='#0c1018';g.lineWidth=1.4;g.strokeRect(px-46,bot-4,92,8);
  brFoam(gr,tt,px,34)}
 g.restore();
 /* deck girders + slab */
 g.save();brBand(xa,xb,U,U+12);g.fillStyle='#1d2331';g.fill();g.lineWidth=1.4;g.strokeStyle='#0a0d14';g.stroke();
 g.fillStyle='rgba(150,170,205,.5)';for(let x=Math.floor(xa/20)*20;x<xb;x+=20){g.beginPath();g.arc(x+4,Hf(x)+U+5,1.3,0,7);g.fill()}g.restore();
 g.save();brBand(xa,xb,0,U);g.fillStyle=lg(g,-200,200,[[0,'#3c465e'],[1,'#252c3e']]);g.fill();g.clip();
 g.fillStyle='rgba(150,170,205,.55)';brBand(xa,xb,0,4);g.fill();
 g.strokeStyle='rgba(246,200,40,.95)';g.lineWidth=2.4;g.setLineDash([16,10]);brLine(xa,xb,9);g.stroke();g.setLineDash([]);
 g.fillStyle='rgba(0,0,0,.25)';brBand(xa,xb,U-6,U);g.fill();g.restore();
 g.save();g.lineWidth=2;g.strokeStyle='#0a0d14';brBand(xa,xb,0,U);g.stroke();g.restore();
 /* truss above the deck (drawn behind the car): chords, verticals, alternating diagonals */
 const ta=a+34,tb=b-34,H=82,seg=56,N=Math.max(2,Math.round((tb-ta)/seg)),sw=(tb-ta)/N;
 g.save();g.lineCap='butt';g.lineJoin='round';
 const yb=x=>Hf(x)-3,yt=x=>Hf(x)-3-H;
 for(let i=0;i<=N;i++){const x=ta+sw*i;if(x<x0-60||x>x1+60)continue;
  if(i<N){const xn=x+sw;steelLine(x,yb(x),xn,yt(xn),(i%2?3.4:3.4));steelLine(xn,yb(xn),x,yt(x),3.4)}
  steelLine(x,yb(x),x,yt(x),i===0||i===N?8:4.6)}
 for(let i=0;i<N;i++){const x=ta+sw*i;if(x<x0-80||x>x1+80)continue;steelLine(x,yt(x),x+sw,yt(x+sw),8);steelLine(x,yb(x)+0,x+sw,yb(x+sw),5)}
 g.restore();
 /* rivet plates at the joints + hanging lamps */
 g.save();g.fillStyle='#a9b8d4';for(let i=0;i<=N;i++){const x=ta+sw*i;if(x<x0-60||x>x1+60)continue;g.beginPath();g.arc(x,yt(x),3.2,0,7);g.fill();g.beginPath();g.arc(x,yb(x),2.6,0,7);g.fill()}
 for(let i=1;i<N;i+=2){const x=ta+sw*i;if(x<x0-120||x>x1+120)continue;const y=yt(x);g.strokeStyle='#161b27';g.lineWidth=2;g.beginPath();g.moveTo(x,y);g.lineTo(x,y+12);g.stroke();
  g.fillStyle='#20273a';g.beginPath();g.moveTo(x-9,y+12);g.lineTo(x+9,y+12);g.lineTo(x+6,y+7);g.lineTo(x-6,y+7);g.closePath();g.fill();brLamp(x,y+16,70,tt,i)}
 g.restore();
 /* entry portals: hazard-striped end posts */
 g.save();[ta,tb].forEach(x=>{if(x<x0-40||x>x1+40)return;const y=yb(x);g.fillStyle='#e8a020';g.fillRect(x-5,y-34,10,34);g.fillStyle='#17181c';for(let k=0;k<4;k++){g.beginPath();g.moveTo(x-5,y-34+k*9);g.lineTo(x+5,y-34+k*9+4);g.lineTo(x+5,y-34+k*9+8);g.lineTo(x-5,y-34+k*9+4);g.fill()}g.strokeStyle='#0a0d14';g.lineWidth=1.4;g.strokeRect(x-5,y-34,10,34)});g.restore()}

/* ---------- dispatcher called from drawScene ---------- */
function drawBridgeFor(gr,tt,x0,x1){const w=LV.w;
 if(w===1)bridgeTimber(gr,tt,x0,x1);
 else if(w===3)bridgeSteel(gr,tt,x0,x1);
 else{drawBridge(gr,tt,x0,x1);bridgeStoneExtras(gr,tt,x0,x1,w===2)}}
