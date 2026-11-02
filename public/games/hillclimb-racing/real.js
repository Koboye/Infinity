'use strict';
/* Hillclimb Racing - CURATED vehicle roster (loaded after veh2.js, replaces every earlier vehicle).
   Roster: 4 Jeep cars (Adventure Wrangler, Red Rubicon, Blue Rubicon, Yellow Raptor) + 4 bikes, each with its driver baked in.
   Sprites face right (mirrored from the source art; text and badges are re-mirrored so they read correctly), wheel centres are levelled,
   shadows/labels are removed, and the car rims are separate spinning discs (brake calipers removed so they never rotate).
   Per-vehicle numbers: s = game units per sprite px, mx/Y0 = sprite px that map to the vehicle origin, wr/wf = rear/front wheel [x,y,r] in sprite px,
   head = driver head centre in game units, ext = [rear,front] extent in game units. */
const REAL_DATA=[{"vi":0,"cls":"car","n":"Adventure Wrangler","file":"real/j0.webp","W":887,"H":444,"s":0.207,"mx":438.8,"Y0":240.9,"R":21.5,"wr":[168.5,344.8,101.0],"wf":[709.0,344.8,100.5],"head":[-10.1,-36.9],"ext":[-90.8,92.8],"cost":0,"pw":1.0,"gr":1.0,"fu":1.0,"st":3,"vm":1.0,"disc":["real/j0_r.png","real/j0_f.png"],"dr":[101.0,100.5]},{"vi":1,"cls":"car","n":"Red Rubicon","file":"real/j1.webp","W":887,"H":444,"s":0.23699,"mx":438.8,"Y0":266.8,"R":21.5,"wr":[184.0,357.5,87.0],"wf":[693.5,357.5,89.0],"head":[-8.0,-43.1],"ext":[-104.0,106.2],"cost":3000,"pw":1.12,"gr":1.05,"fu":1.05,"st":3,"vm":1.04,"disc":["real/j1_r.png","real/j1_f.png"],"dr":[87.0,89.0]},{"vi":2,"cls":"car","n":"Blue Rubicon","file":"real/j2.webp","W":887,"H":444,"s":0.22245,"mx":443.2,"Y0":255.1,"R":21.5,"wr":[181.0,351.8,96.0],"wf":[705.5,351.8,91.5],"head":[-9.6,-37.8],"ext":[-98.6,98.7],"cost":8000,"pw":1.24,"gr":1.1,"fu":1.1,"st":4,"vm":1.08,"disc":["real/j2_r.png","real/j2_f.png"],"dr":[96.0,91.5]},{"vi":3,"cls":"car","n":"Yellow Raptor","file":"real/j3.webp","W":880,"H":444,"s":0.22855,"mx":441.5,"Y0":260.2,"R":21.5,"wr":[182.5,354.2,90.5],"wf":[700.5,354.2,92.0],"head":[-10.5,-40.6],"ext":[-100.9,100.2],"cost":15000,"pw":1.36,"gr":1.16,"fu":1.15,"st":4,"vm":1.12,"disc":["real/j3_r.png","real/j3_f.png"],"dr":[90.5,92.0]},{"vi":7,"cls":"bike","n":"Crimson V4","file":"real/b7.webp","W":879,"H":603,"s":0.225,"mx":422.1,"Y0":350.8,"R":27,"wr":[111.4,470.8,126.2],"wf":[732.8,470.8,113.8],"head":[14.0,-65.4],"ext":[-95.0,102.6],"cost":3500,"pw":1.25,"gr":1.1,"fu":1.0,"st":4,"vm":1.1},{"vi":8,"cls":"bike","n":"Venom R","file":"real/b8.webp","W":907,"H":607,"s":0.225,"mx":433.3,"Y0":356.1,"R":27,"wr":[113.6,476.1,128.6],"wf":[753.0,476.1,111.4],"head":[12.4,-66.6],"ext":[-97.5,106.3],"cost":8000,"pw":1.45,"gr":1.18,"fu":1.1,"st":4,"vm":1.18},{"vi":9,"cls":"bike","n":"Royal R1","file":"real/b9.webp","W":878,"H":610,"s":0.225,"mx":426.8,"Y0":359.1,"R":27,"wr":[113.5,479.1,125.1],"wf":[740.0,479.1,114.9],"head":[10.6,-67.3],"ext":[-96.0,101.3],"cost":14000,"pw":1.65,"gr":1.26,"fu":1.2,"st":5,"vm":1.25},{"vi":11,"cls":"bike","n":"Jade ZX-6R","file":"real/b11.webp","W":841,"H":597,"s":0.225,"mx":422.2,"Y0":354.8,"R":27,"wr":[123.3,474.8,120.3],"wf":[721.2,474.8,119.7],"head":[-0.9,-66.3],"ext":[-95.0,94.0],"cost":20000,"pw":1.85,"gr":1.32,"fu":1.2,"st":5,"vm":1.3}];
const OLD_COST=VEH.map(v=>v.cost||0);   /* old roster prices, used once to refund saved purchases */
const REAL_BY={};
(function(){
 const BKX={cls:'bike',wk:'bike',cp:[{x:34,y:4},{x:-34,y:4}],R:27,ks:1};
 VEH.length=0;
 REAL_DATA.forEach(d=>{
  const s=d.s,gx=x=>(x-d.mx)*s,R=d.R,car=d.cls==='car';
  const v=VEH[d.vi]=Object.assign({},car?CAR:BKX,{cost:d.cost,pw:d.pw,gr:d.gr,fu:d.fu,sk:0,st:d.st,vm:d.vm,I:car?4300:3000,air:1.4,ks:1});
  const wr={x:+gx(d.wr[0]).toFixed(1),y:R},wf={x:+gx(d.wf[0]).toFixed(1),y:R};
  v.n=d.n;v.kind='real';v.cls=d.cls;v.R=R;v.wh=[wr,wf];v.len=Math.round(d.W*s);v.art='r'+d.vi;
  v.hd=[{x:d.head[0],y:d.head[1]},{x:+(d.head[0]-6).toFixed(1),y:+(d.head[1]+16).toFixed(1)}];
  if(car){v.wk='img';v.cp=[{x:+(wf.x+(d.ext[1]-wf.x)*.6).toFixed(1),y:R-8},{x:+(wr.x+(d.ext[0]-wr.x)*.6).toFixed(1),y:R-8}];delete v.win;delete v.hp}
  else{v.wk='bike';delete v.rd}
  REAL_BY[d.vi]=d;
  const im=new Image();im.onload=()=>{d.body=im};im.src=d.file;
  if(d.disc){d.wc=[null,null];d.disc.forEach((f,k)=>{const q=new Image();q.onload=()=>{d.wc[k]=q};q.src=f})}
 });
})();
drawVeh=function(cx,vi,o){const d=REAL_BY[vi];if(!d||!d.body)return;
 const s=d.s;cx.drawImage(d.body,-d.mx*s,-d.Y0*s,d.W*s,d.H*s);
 if(d.wc){[d.wr,d.wf].forEach((w,i)=>{const q=d.wc[i];if(!q)return;const dia=d.dr[i]*2*s+4*s;cx.save();cx.translate((w[0]-d.mx)*s,(w[1]-d.Y0)*s+(o.ws?o.ws[i]:0));cx.rotate(o.sp?o.sp[i]:0);cx.drawImage(q,-dia/2,-dia/2,dia,dia);cx.restore()})}};
