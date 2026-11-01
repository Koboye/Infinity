'use strict';
/* Hillclimb Racing - CURATED vehicle roster (loaded after veh2.js, replaces every earlier vehicle).
   Only complete, uncropped, full-quality art is used: 7 cars + 3 bikes, each with its driver baked in.
   Sprites face right (mirrored from the source art; text and badges are re-mirrored so they read correctly), wheel centres are levelled,
   shadows/labels are removed, and the car rims are separate spinning discs (brake calipers removed so they never rotate).
   Per-vehicle numbers: s = game units per sprite px, mx/Y0 = sprite px that map to the vehicle origin, wr/wf = rear/front wheel [x,y,r] in sprite px,
   head = driver head centre in game units, ext = [rear,front] extent in game units. */
const REAL_DATA=[{"vi":0,"cls":"car","n":"Scarlet GT","file":"real/c0.webp","W":650,"H":250,"s":0.35833,"mx":304.7,"Y0":130.6,"R":21.5,"wr":[105.8,190.6,59.4],"wf":[503.7,190.6,60.6],"head":[-10.9,-35.4],"ext":[-109.2,123.4],"cost":0,"pw":1.0,"gr":1.0,"fu":1.0,"st":3,"vm":1.0,"disc":["real/c0_r.png","real/c0_f.png"],"dr":[48.7,49.7]},{"vi":1,"cls":"car","n":"Cobalt Z","file":"real/c1.webp","W":664,"H":253,"s":0.35833,"mx":316.5,"Y0":130.6,"R":21.5,"wr":[112.1,190.6,58.9],"wf":[520.8,190.6,61.1],"head":[-13.7,-35.4],"ext":[-113.4,124.2],"cost":2500,"pw":1.12,"gr":1.05,"fu":1.05,"st":3,"vm":1.04,"disc":["real/c1_r.png","real/c1_f.png"],"dr":[48.3,50.1]},{"vi":2,"cls":"car","n":"Venom Spyder","file":"real/c2.webp","W":748,"H":259,"s":0.35833,"mx":284.9,"Y0":126.1,"R":21.5,"wr":[82.6,186.1,57.2],"wf":[487.3,186.1,62.8],"head":[10.2,-33.8],"ext":[-102.1,165.6],"cost":5500,"pw":1.24,"gr":1.1,"fu":1.1,"st":4,"vm":1.08,"disc":["real/c2_r.png","real/c2_f.png"],"dr":[46.9,51.5]},{"vi":3,"cls":"car","n":"Sapphire 911","file":"real/c3.webp","W":687,"H":210,"s":0.35833,"mx":299.9,"Y0":91.1,"R":21.5,"wr":[103.0,151.1,59.2],"wf":[496.7,151.1,60.8],"head":[-8.5,-21.2],"ext":[-107.5,138.4],"cost":9000,"pw":1.36,"gr":1.16,"fu":1.15,"st":4,"vm":1.12,"disc":["real/c3_r.png","real/c3_f.png"],"dr":[48.5,49.9]},{"vi":4,"cls":"car","n":"Solar 750","file":"real/c4.webp","W":704,"H":223,"s":0.35833,"mx":291.0,"Y0":98.6,"R":21.5,"wr":[75.7,158.6,57.4],"wf":[506.2,158.6,62.6],"head":[0.2,-23.9],"ext":[-104.3,147.7],"cost":14000,"pw":1.5,"gr":1.22,"fu":1.2,"st":5,"vm":1.16,"disc":["real/c4_r.png","real/c4_f.png"],"dr":[47.1,51.3]},{"vi":5,"cls":"car","n":"Blaze 911","file":"real/c5.webp","W":631,"H":229,"s":0.35833,"mx":269.4,"Y0":107.7,"R":21.5,"wr":[86.9,167.7,58.3],"wf":[451.9,167.7,61.7],"head":[-2.4,-27.2],"ext":[-96.5,129.2],"cost":19000,"pw":1.62,"gr":1.28,"fu":1.28,"st":5,"vm":1.2,"disc":["real/c5_r.png","real/c5_f.png"],"dr":[47.8,50.6]},{"vi":6,"cls":"car","n":"Emerald V","file":"real/c6.webp","W":659,"H":242,"s":0.35833,"mx":284.9,"Y0":119.7,"R":21.5,"wr":[88.0,179.7,57.4],"wf":[481.9,179.7,62.6],"head":[-1.8,-31.5],"ext":[-102.1,133.7],"cost":26000,"pw":1.75,"gr":1.34,"fu":1.35,"st":5,"vm":1.25,"disc":["real/c6_r.png","real/c6_f.png"],"dr":[47.1,51.3]},{"vi":7,"cls":"bike","n":"Crimson V4","file":"real/b7.webp","W":879,"H":603,"s":0.225,"mx":422.1,"Y0":350.8,"R":27,"wr":[111.4,470.8,126.2],"wf":[732.8,470.8,113.8],"head":[14.0,-65.4],"ext":[-95.0,102.6],"cost":3500,"pw":1.25,"gr":1.1,"fu":1.0,"st":4,"vm":1.1},{"vi":8,"cls":"bike","n":"Venom R","file":"real/b8.webp","W":907,"H":607,"s":0.225,"mx":433.3,"Y0":356.1,"R":27,"wr":[113.6,476.1,128.6],"wf":[753.0,476.1,111.4],"head":[12.4,-66.6],"ext":[-97.5,106.3],"cost":8000,"pw":1.45,"gr":1.18,"fu":1.1,"st":4,"vm":1.18},{"vi":9,"cls":"bike","n":"Royal R1","file":"real/b9.webp","W":878,"H":610,"s":0.225,"mx":426.8,"Y0":359.1,"R":27,"wr":[113.5,479.1,125.1],"wf":[740.0,479.1,114.9],"head":[10.6,-67.3],"ext":[-96.0,101.3],"cost":14000,"pw":1.65,"gr":1.26,"fu":1.2,"st":5,"vm":1.25}];
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
