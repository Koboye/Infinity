'use strict';
/* Hillclimb Racing - CURATED vehicle roster (loaded after veh2.js, replaces every earlier vehicle).
   Roster: 4 Jeep cars (Adventure Wrangler, Red Rubicon, Blue Rubicon, Yellow Raptor) + 4 bikes, each with its driver baked in.
   Sprites face right (mirrored from the source art; text and badges are re-mirrored so they read correctly), wheel centres are levelled,
   shadows/labels are removed, and the car rims are separate spinning discs (brake calipers removed so they never rotate).
   Per-vehicle numbers: s = game units per sprite px, mx/Y0 = sprite px that map to the vehicle origin, wr/wf = rear/front wheel [x,y,r] in sprite px,
   head = driver head centre in game units, ext = [rear,front] extent in game units. */
const REAL_DATA=[{"vi":0,"cls":"car","n":"Adventure Wrangler","file":"real/j0.webp","W":887,"H":444,"s":0.207,"mx":438.8,"Y0":240.9,"R":21.5,"wr":[168.5,344.8,101.0],"wf":[709.0,344.8,100.5],"head":[-10.1,-36.9],"ext":[-90.8,92.8],"cost":0,"pw":1.0,"gr":1.0,"fu":1.0,"st":3,"vm":1.0,"dh":[338.0,13.5,172,82],"dt":[334.0,85.0,182,72],"hp":[379.1,89.0],"tp":[407.1,155.5],"disc":["real/j0_r.png","real/j0_f.png"],"dr":[101.0,100.5]},{"vi":1,"cls":"car","n":"Red Rubicon","file":"real/j1.webp","W":887,"H":444,"s":0.23699,"mx":438.8,"Y0":266.8,"R":21.5,"wr":[184.0,357.5,87.0],"wf":[693.5,357.5,89.0],"head":[-8.0,-43.1],"ext":[-104.0,106.2],"cost":3000,"pw":1.12,"gr":1.05,"fu":1.05,"st":3,"vm":1.04,"dh":[329.0,9.0,118,87],"dt":[329.0,85.0,147,72],"hp":[371.3,89.0],"tp":[396.1,155.5],"disc":["real/j1_r.png","real/j1_f.png"],"dr":[87.0,89.0]},{"vi":2,"cls":"car","n":"Blue Rubicon","file":"real/j2.webp","W":887,"H":444,"s":0.22245,"mx":443.2,"Y0":255.1,"R":21.5,"wr":[181.0,351.8,96.0],"wf":[705.5,351.8,91.5],"head":[-9.6,-37.8],"ext":[-98.6,98.7],"cost":8000,"pw":1.24,"gr":1.1,"fu":1.1,"st":4,"vm":1.08,"dh":[346.5,9.0,166,87],"dt":[338.5,85.0,178,69],"hp":[385.5,89.0],"tp":[414.1,152.5],"disc":["real/j2_r.png","real/j2_f.png"],"dr":[96.0,91.5]},{"vi":3,"cls":"car","n":"Yellow Raptor","file":"real/j3.webp","W":880,"H":444,"s":0.22855,"mx":441.5,"Y0":260.2,"R":21.5,"wr":[182.5,354.2,90.5],"wf":[700.5,354.2,92.0],"head":[-10.5,-40.6],"ext":[-100.9,100.2],"cost":15000,"pw":1.36,"gr":1.16,"fu":1.15,"st":4,"vm":1.12,"dh":[328.5,9.0,176,87],"dt":[322.0,85.0,188,72],"hp":[376.4,89.0],"tp":[402.5,155.5],"disc":["real/j3_r.png","real/j3_f.png"],"dr":[90.5,92.0]},{"vi":7,"cls":"bike","n":"Trail Explorer 700","file":"real/b7.webp","W":795,"H":444,"s":0.23107,"mx":411.0,"Y0":238.9,"R":24.0,"wr":[129.0,342.8,99.0],"wf":[693.0,342.8,102.5],"head":[6.9,-44.8],"ext":[-95.0,88.7],"cost":3000,"pw":1.15,"gr":1.1,"fu":1.1,"st":4,"vm":1.0},{"vi":8,"cls":"bike","n":"MX Racer 450","file":"real/b8.webp","W":805,"H":444,"s":0.22385,"mx":406.2,"Y0":231.8,"R":24.0,"wr":[108.5,339.0,108.0],"wf":[704.0,339.0,100.0],"head":[5.5,-40.7],"ext":[-90.9,89.3],"cost":7000,"pw":1.3,"gr":1.25,"fu":1.0,"st":4,"vm":1.05},{"vi":9,"cls":"bike","n":"Street Fighter 390","file":"real/b9.webp","W":787,"H":444,"s":0.22066,"mx":402.5,"Y0":225.0,"R":24.0,"wr":[119.5,333.8,110.5],"wf":[685.5,333.8,100.5],"head":[7.7,-39.2],"ext":[-88.8,84.8],"cost":13000,"pw":1.45,"gr":1.15,"fu":1.1,"st":5,"vm":1.12},{"vi":11,"cls":"bike","n":"Superbike R","file":"real/b11.webp","W":767,"H":440,"s":0.21212,"mx":386.2,"Y0":213.1,"R":24.0,"wr":[113.5,326.2,112.5],"wf":[659.0,326.2,107.0],"head":[15.0,-34.6],"ext":[-81.9,80.8],"cost":20000,"pw":1.6,"gr":1.05,"fu":1.0,"st":5,"vm":1.2}];
/* big-head driver: the head sprite is drawn HEAD_K x larger about its neck pivot (mockup head/wheel ratio 0.59 + 10% = 0.65; the sprite head is ~0.40 of the wheel, so 0.65/0.40 = 1.6) */
const HEAD_K=1.6;
const OLD_COST=VEH.map(v=>v.cost||0);   /* old roster prices, used once to refund saved purchases */
const REAL_BY={};
(function(){
 const BKX={cls:'bike',wk:'bike',cp:[{x:34,y:4},{x:-34,y:4}],R:27,ks:1};
 VEH.length=0;
 REAL_DATA.forEach(d=>{
  const s=d.s,gx=x=>(x-d.mx)*s,R=d.R,car=d.cls==='car';
  const v=VEH[d.vi]=Object.assign({},car?CAR:BKX,{cost:d.cost,pw:d.pw,gr:d.gr,fu:d.fu,sk:0,st:d.st,vm:d.vm,I:car?5600:3000,air:1.4,ks:1});
  const wr={x:+gx(d.wr[0]).toFixed(1),y:R},wf={x:+gx(d.wf[0]).toFixed(1),y:R};
  v.n=d.n;v.kind='real';v.cls=d.cls;v.R=R;v.wh=[wr,wf];v.len=Math.round(d.W*s);v.art='r'+d.vi;
  v.hd=[{x:d.head[0],y:+(d.head[1]-(car?(HEAD_K-1)*8:0)).toFixed(1)},{x:+(d.head[0]-6).toFixed(1),y:+(d.head[1]+16).toFixed(1)}];
  if(car){v.wk='img';v.cp=[{x:+(wf.x+(d.ext[1]-wf.x)*.6).toFixed(1),y:R-8},{x:+(wr.x+(d.ext[0]-wr.x)*.6).toFixed(1),y:R-8}];delete v.win;delete v.hp}
  else{v.wk='bike';delete v.rd}
  REAL_BY[d.vi]=d;
  const im=new Image();im.onload=()=>{d.body=im};im.src=d.file;
  if(d.dt){const a=new Image();a.onload=()=>{d.timg=a};a.src='real/j'+d.vi+'_t.png';const b=new Image();b.onload=()=>{d.himg=b};b.src='real/j'+d.vi+'_h.png'}
  if(d.disc){d.wc=[null,null];d.disc.forEach((f,k)=>{const q=new Image();q.onload=()=>{d.wc[k]=q};q.src=f})}
 });
})();
drawVeh=function(cx,vi,o){const d=REAL_BY[vi];if(!d||!d.body)return;
 const s=d.s;cx.drawImage(d.body,-d.mx*s,-d.Y0*s,d.W*s,d.H*s);
 if(d.wc){[d.wr,d.wf].forEach((w,i)=>{const q=d.wc[i];if(!q)return;const dia=d.dr[i]*2*s+4*s;cx.save();cx.translate((w[0]-d.mx)*s,(w[1]-d.Y0)*s+(o.ws?o.ws[i]:0));cx.rotate(o.sp?o.sp[i]:0);cx.drawImage(q,-dia/2,-dia/2,dia,dia);cx.restore()})}
 if(d.timg&&d.himg){const dx=o.dx!=null?o.dx:0,dy=o.dy!=null?o.dy:Math.sin((o.t||0)*3.1)*.5,ha=o.ha||0,T=d.dt,Hd=d.dh,lean=dx*.014+dy*.004;
  cx.save();cx.translate((d.tp[0]-d.mx)*s+dx*.4,(d.tp[1]-d.Y0)*s+dy*.35);cx.rotate(lean);cx.drawImage(d.timg,(T[0]-d.tp[0])*s,(T[1]-d.tp[1])*s,T[2]*s,T[3]*s);
  cx.translate((d.hp[0]-d.tp[0])*s+dx*.5,(d.hp[1]-d.tp[1])*s+dy*.6);cx.rotate(ha*.5+dx*.01);cx.scale(HEAD_K,HEAD_K);cx.drawImage(d.himg,(Hd[0]-d.hp[0])*s,(Hd[1]-d.hp[1])*s,Hd[2]*s,Hd[3]*s);cx.restore()}};
