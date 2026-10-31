'use strict';
/* Hillclimb Racing - 120 worlds (94 Earth landscapes + 26 planets), every world has 100 levels, easiest -> hardest.
   Pure data + difficulty curve. Loaded before the main game script.
   World fields used by the game:
     n name | cat 'earth'|'planet' | img background (relative to this folder) | gr [edge,top] ground colours | soil overlay on the dirt
     dust | grip | amp (hill height) | gv gravity multiplier | dm difficulty multiplier | pm/om prop + obstacle mix | riv river palette
     tint full-screen mood tint | stars | orb sky body (moon, planet, sun ...) | mood label */

const LEVELS=100;
const TIERS=[{n:'EASY',c:'#5be37d',to:19},{n:'MEDIUM',c:'#f5c542',to:44},{n:'HARD',c:'#ff9a3c',to:69},{n:'EXPERT',c:'#ff5a4f',to:89},{n:'INSANE',c:'#c06bff',to:99}];
const tierOf=l=>TIERS.find(t=>l<=t.to)||TIERS[TIERS.length-1];
/* level distance in metres: 450 m on level 1 growing to ~2.4 km on level 100 (small per-world variation) */
const goalOf=(w,l)=>{const t=l/(LEVELS-1);return Math.round((450+1850*Math.pow(t,1.1))*(.95+((w*7)%11)/100)/50)*50};

/* ---- prop / obstacle mixes [kind, weight] ---- */
const PMIX={
 green:[['tree',.20],['bush',.12],['rock',.10],['hut',.08],['house',.05],['fence',.09],['sign',.05],['cone',.04],['log',.05],['crate',.06],['barrel',.06],['boulder',.04],['acacia',.06],['hay',.04],['tires',.03],['lamp',.03],['warn',.03],['barrier',.03]],
 desert:[['cactus',.26],['acacia',.12],['boulder',.16],['rock',.10],['bush',.06],['hut',.08],['sign',.06],['cone',.04],['log',.02],['crate',.05],['barrel',.05],['tires',.03],['warn',.03],['barrier',.03]],
 snow:[['pineS',.30],['pine',.10],['rock',.10],['boulder',.06],['houseS',.10],['fence',.10],['sign',.06],['cone',.04],['log',.06],['crate',.04],['barrel',.04],['lamp',.04],['barrier',.03]],
 savanna:[['acacia',.24],['bush',.14],['rock',.08],['hut',.12],['hay',.06],['boulder',.06],['fence',.08],['sign',.05],['cone',.03],['log',.04],['crate',.04],['barrel',.04],['tree',.02]],
 jungle:[['palm',.20],['tree',.20],['bush',.18],['log',.08],['rock',.06],['boulder',.05],['hut',.05],['sign',.04],['crate',.04],['barrel',.04],['fence',.03],['cone',.03]],
 coast:[['palm',.30],['bush',.12],['rock',.10],['hut',.10],['boulder',.06],['sign',.06],['fence',.06],['crate',.06],['barrel',.06],['log',.04],['cone',.04]],
 canyon:[['boulder',.20],['rock',.14],['acacia',.10],['cactus',.10],['hut',.06],['bush',.08],['sign',.06],['warn',.05],['cone',.04],['crate',.05],['barrel',.04],['log',.04],['fence',.04]],
 city:[['lamp',.18],['houseN',.14],['house',.08],['sign',.06],['cone',.08],['barrier',.10],['warn',.06],['crate',.06],['barrel',.06],['tires',.06],['bush',.06],['tree',.06]],
 volcanic:[['lava',.22],['boulder',.20],['rock',.14],['warn',.08],['barrier',.08],['sign',.05],['cone',.05],['crate',.05],['barrel',.05],['tires',.04],['cactus',.04]],
 alien:[['crystal',.28],['shroom',.18],['boulder',.14],['rock',.12],['warn',.06],['barrier',.06],['cone',.04],['crate',.06],['sign',.06]],
 ice:[['ice',.26],['pineS',.20],['boulder',.10],['rock',.08],['houseS',.06],['sign',.05],['cone',.04],['log',.05],['crate',.05],['barrel',.04],['lamp',.04],['barrier',.03]],
 moon:[['boulder',.30],['rock',.22],['warn',.10],['barrier',.10],['crystal',.06],['crate',.10],['barrel',.06],['lamp',.06]]
};
const OMIX={
 std:[['crate',.2],['barrel',.17],['cone',.17],['fence',.14],['sign',.05],['log',.13],['boulder',.14]],
 rocky:[['crate',.14],['barrel',.14],['cone',.1],['fence',.07],['sign',.05],['log',.07],['boulder',.43]],
 snowO:[['crate',.18],['barrel',.16],['cone',.14],['fence',.14],['sign',.06],['log',.16],['boulder',.16]],
 city:[['crate',.22],['barrel',.20],['cone',.20],['fence',.14],['sign',.08],['log',.05],['boulder',.11]],
 lava:[['lavaO',.30],['boulder',.28],['crate',.12],['barrel',.10],['cone',.08],['fence',.06],['sign',.06]],
 crystal:[['crystalO',.30],['shroomO',.12],['boulder',.22],['crate',.14],['barrel',.10],['cone',.06],['sign',.06]],
 ice:[['iceO',.30],['boulder',.15],['crate',.15],['barrel',.12],['cone',.10],['log',.10],['sign',.08]]
};
/* river / ford palettes [water top, water deep] */
const RIVC=[['#4ab4ee','#12589a'],['#46c4d0','#10707e'],['#a8e4ff','#4a96c8'],['#2a5cc0','#0a1e5c'],['#ffb02e','#b3200a'],['#9bff6a','#2a8a2a'],['#d38bff','#5a2a9a'],['#b8935a','#6a4a22'],['#46f0ff','#1a4a9a']];

/* ---- biomes: ground, physics and prop rules ---- */
const BIOMES={
 grass:   {gr:['#3f9a28','#86d94a'],dust:'#b58a52',grip:1,   amp:1,   dm:1,   pm:'green',  om:'std',    riv:0},
 highland:{gr:['#4f9a30','#9ad850'],dust:'#a8845a',grip:.97, amp:1.08,dm:1.02,pm:'green',  om:'std',    riv:0},
 savanna: {gr:['#a39a3a','#d6cc5e'],dust:'#cfa86a',grip:.98, amp:.95, dm:1,   pm:'savanna',om:'std',    riv:7},
 desert:  {gr:['#b88a3a','#e7c277'],dust:'#d9b06a',grip:.95, amp:.85, dm:1,   pm:'desert', om:'rocky',  riv:7},
 snow:    {gr:['#bcd9ec','#ffffff'],dust:'#eef7ff',grip:.7,  amp:1,   dm:1.03,pm:'snow',   om:'snowO',  riv:2},
 jungle:  {gr:['#1f7a34','#5fcf5a'],dust:'#7a6a4a',grip:.9,  amp:1.05,dm:1.02,pm:'jungle', om:'std',    riv:1},
 coast:   {gr:['#d2b868','#f3e3a6'],dust:'#e8d79a',grip:.9,  amp:.9,  dm:1,   pm:'coast',  om:'std',    riv:1},
 canyon:  {gr:['#a8683a','#e0a060'],dust:'#c9925a',grip:.95, amp:1.12,dm:1.04,pm:'canyon', om:'rocky',  riv:7},
 city:    {gr:['#5f6672','#a9b2c4'],dust:'#9aa0aa',grip:1,   amp:.8,  dm:1,   pm:'city',   om:'city',   riv:3},
 volcanic:{gr:['#4a3430','#d2622a'],dust:'#6a4a40',grip:.85, amp:1.1, dm:1.06,pm:'volcanic',om:'lava',  riv:4,soil:'rgba(120,30,10,.28)'},
 alien:   {gr:['#6a3fa8','#b88cff'],dust:'#b79aff',grip:.88, amp:1.05,dm:1.05,pm:'alien',  om:'crystal',riv:5,soil:'rgba(90,40,150,.30)'},
 ice:     {gr:['#9fd2f0','#e8fbff'],dust:'#e8fbff',grip:.62, amp:1,   dm:1.06,pm:'ice',    om:'ice',    riv:2,soil:'rgba(140,200,255,.22)'},
 mars:    {gr:['#a8502e','#d8845a'],dust:'#d8845a',grip:.9,  amp:1.05,dm:1.04,pm:'moon',   om:'rocky',  riv:7,soil:'rgba(150,50,20,.30)'},
 moon:    {gr:['#7a7e8c','#b9bdca'],dust:'#c9ccd8',grip:.85, amp:1.1, dm:1.05,pm:'moon',   om:'rocky',  riv:8,soil:'rgba(60,64,80,.22)'}
};

/* ---- sky bodies drawn over the background (planets, moons, suns) ---- */
const ORBS={
 moon:{x:.80,y:.17,r:.075,c:['#ffffff','#c9d3ea']},
 sun:{x:.82,y:.20,r:.085,c:['#fffbe0','#ffb347']},
 redsun:{x:.20,y:.22,r:.10,c:['#ffd8b0','#d8431f']},
 blue:{x:.78,y:.20,r:.13,c:['#cfeaff','#2b6fd6']},
 ringed:{x:.74,y:.22,r:.12,c:['#ffe8c4','#d9902f'],ring:1},
 gas:{x:.70,y:.26,r:.20,c:['#ffd9a0','#b4541c'],ring:1},
 binary:{x:.72,y:.20,r:.09,c:['#fff4c8','#ff9a3a'],two:{dx:.10,dy:.06,r:.05,c:['#d6f0ff','#4aa0ff']}},
 purple:{x:.76,y:.2,r:.11,c:['#f2d4ff','#8a3fd0']}
};

/* ---- Earth landscapes: [id, name, img, biome, night?] ---- */
const A='art/';
const EARTH=[
 ['green_lake','Green Hills & Lake',A+'bg_green_lake.jpg','grass'],['eth_village','Ethiopian Village',A+'w_eth_village.jpg','grass'],
 ['simien','Simien Mountains',A+'w_simien.jpg','highland'],['lalibela','Lalibela Rock Churches',A+'w_lalibela.jpg','canyon'],['lake_tana','Lake Tana',A+'w_lake_tana.jpg','grass'],
 ['gondar','Gondar Castle',A+'w_gondar.jpg','savanna'],['bale','Bale Mountains',A+'w_bale.jpg','savanna'],['addis','Addis Ababa',A+'w_addis.jpg','city'],
 ['tigray','Axum Obelisks',A+'w_tigray.jpg','canyon'],['ras_dashen','Ras Dashen Road',A+'w_ras_dashen.jpg','highland'],['blue_nile','Blue Nile Falls',A+'w_blue_nile.jpg','grass'],
 ['danakil','Danakil Depression',A+'w_danakil.jpg','desert'],['snowy_peaks','Snowy Peaks',A+'w_snowy_peaks.jpg','snow'],['forest_river','Forest River',A+'w_forest_river.jpg','jungle'],
 ['desert_highway','Desert Highway',A+'w_desert_highway.jpg','desert'],['tropical_beach','Tropical Beach',A+'w_tropical_beach.jpg','coast'],['modern_city','Modern City',A+'w_modern_city.jpg','city'],
 ['volcanic','Volcano Fields',A+'w_volcanic.jpg','volcanic'],['jungle_falls','Jungle Falls',A+'w_jungle_falls.jpg','jungle'],['snow_village','Alpine Village',A+'w_snow_village.jpg','snow'],
 ['canyon_river','Canyon River',A+'w_canyon_river.jpg','canyon'],['highlands_lake','Highlands Lake',A+'w_highlands_lake.jpg','grass'],
 ['suspension_bridge','Suspension Bridge',A+'w_suspension_bridge.jpg','canyon'],['desert_plateau','Desert Plateau',A+'w_desert_plateau.jpg','desert'],['river_valley','River Valley',A+'w_river_valley.jpg','grass'],
 ['forest_road','Forest Road',A+'w_forest_road.jpg','grass'],['ancient_bridge','Ancient Bridge',A+'w_ancient_bridge.jpg','grass'],['waterfall','Great Waterfall',A+'w_waterfall.jpg','jungle'],
 ['offroad_trail','Off-Road Trail',A+'w_offroad_trail.jpg','highland'],['night_city','Night City',A+'w_night_city.jpg','city',1],
 ['rocky_canyon','Rocky Canyon',A+'bg_canyon.jpg','canyon'],['dry_hills','Dry Hills',A+'bg_dry.jpg','savanna'],
 ['river_bridge','River Bridge',A+'bg_river.jpg','grass'],['snow_mtn','Snow Mountains',A+'bg_snow.jpg','snow'],['snow_vil','Snow Village',A+'bg_snowvillage.jpg','snow'],
 ['sunset','Sunset Highlands',A+'bg_sunset.jpg','highland',1],['village','Village Hills',A+'bg_village.jpg','grass'],['savanna','Savanna Sunset',A+'bg_savanna.jpg','savanna',1],
 ['crater','Volcano Crater',A+'bg_volcano.jpg','volcanic',1],['sahara','Sahara',A+'bg_sahara.jpg','desert'],['aurora','Aurora Forest',A+'bg_aurora.jpg','snow',1],
 ['fuji','Cherry Blossom Fuji',A+'bg_fuji.jpg','grass'],['synthwave','Synthwave Drive',A+'bg_synthwave.jpg','city',1],['neon','Neon City',A+'bg_neon_city.jpg','city',1]
];
const MOODS=[
 {n:'Sunrise',tint:'rgba(255,170,90,.26)'},{n:'Golden Hour',tint:'rgba(255,200,70,.24)'},{n:'Dusk',tint:'rgba(150,70,170,.34)'},
 {n:'Misty Morning',tint:'rgba(225,238,246,.34)'},{n:'Storm',tint:'rgba(40,52,76,.46)'},{n:'Moonlit',tint:'rgba(30,60,140,.46)',stars:1,orb:'moon'},
 {n:'Midnight',tint:'rgba(8,12,70,.58)',stars:1,orb:'moon'}
];
/* ---- Planets: [name, img, biome, tint, gravity, orb, stars, difficulty bonus] ---- */
const PLANETS=[
 ['Alien Planet',A+'w_alien_planet.jpg','alien',null,.80,'purple',1],['Crystal Planet',A+'bg_alien_crystal.jpg','alien',null,.75,'ringed',1],['Crystal Moon',A+'bg_alien_crystal.jpg','alien','rgba(40,60,160,.40)',.70,'moon',1],
 ['Lava Moon',A+'bg_lava_moon.jpg','volcanic',null,.65,'redsun',1],['Ember Moon',A+'bg_lava_moon.jpg','volcanic','rgba(255,70,10,.28)',.65,'redsun',1],
 ['Mars Base',A+'bg_mars_base.jpg','mars',null,.60,'moon',0],['Red Planet Dusk',A+'bg_mars_base.jpg','mars','rgba(120,40,160,.32)',.60,'blue',1],
 ['Orbit Station',A+'bg_orbit.jpg','moon',null,.50,'sun',1],['Deep Orbit',A+'bg_orbit.jpg','moon','rgba(20,40,140,.40)',.50,'blue',1],
 ['Ice Planet',A+'w_snowy_peaks.jpg','ice','rgba(110,200,255,.38)',.85,'moon',1],['Frozen Moon',A+'bg_snow.jpg','ice','rgba(90,140,255,.42)',.80,'gas',1],
 ['Glacier World',A+'w_snow_village.jpg','ice','rgba(60,190,230,.40)',.85,'sun',0],['Aurora Planet',A+'bg_aurora.jpg','ice','rgba(40,200,170,.22)',.85,'ringed',1],
 ['Desert Planet',A+'w_desert_plateau.jpg','mars','rgba(255,60,20,.30)',.90,'binary',0],['Dune World',A+'bg_sahara.jpg','mars','rgba(255,120,20,.30)',.88,'redsun',0],
 ['Rust Canyon Planet',A+'w_danakil.jpg','mars','rgba(190,40,120,.34)',.88,'purple',0],
 ['Jungle Planet',A+'w_jungle_falls.jpg','alien','rgba(0,200,170,.30)',.95,'ringed',0],['Spore World',A+'w_forest_river.jpg','alien','rgba(150,60,200,.32)',.90,'moon',1],
 ['Emerald Moon',A+'w_waterfall.jpg','alien','rgba(20,200,90,.30)',.80,'gas',1],
 ['Volcanic Planet',A+'w_volcanic.jpg','volcanic','rgba(255,50,0,.22)',1.05,'redsun',1],['Magma World',A+'bg_volcano.jpg','volcanic','rgba(255,110,0,.26)',1.0,'redsun',1],
 ['Ash Planet',A+'bg_volcano.jpg','volcanic','rgba(70,70,80,.45)',1.0,'moon',1],
 ['Binary Planet',A+'bg_synthwave.jpg','alien','rgba(255,120,0,.16)',.90,'binary',1],['Neon Planet',A+'bg_neon_city.jpg','alien','rgba(0,200,255,.18)',.90,'blue',1],
 ['Ocean Planet',A+'w_tropical_beach.jpg','coast','rgba(0,170,200,.30)',.90,'ringed',0],['Gas Giant Rings',A+'bg_orbit.jpg','moon','rgba(255,140,40,.30)',.45,'gas',1]
];

/* ---- build the 120 worlds ---- */
const WORLDS=[];
(function(){
 const mk=(o)=>{const b=BIOMES[o.biome];WORLDS.push(Object.assign({id:WORLDS.length,gr:b.gr,dust:b.dust,grip:b.grip,amp:b.amp,dm:b.dm,pm:b.pm,om:b.om,riv:b.riv,soil:b.soil||null,gv:1,tint:null,stars:0,orb:null,mood:''},o))};
 /* pass 1: every Earth landscape in daylight */
 EARTH.forEach(e=>mk({n:e[1],cat:'earth',img:e[2],biome:e[3]}));
 /* pass 2: a different mood for every landscape (night bases only get day-time moods) */
 const day=[0,1,3,4],all=[0,1,2,3,4,5,6];
 const mood=(e,i,k,used)=>{const night=e[4];const p=night?day:all;let m,j=0;do{m=MOODS[p[(i*(k?3:1)+k*2+j)%p.length]];j++}while(used.includes(m.n)&&j<20);return m};
 const used=EARTH.map(()=>[]);
 EARTH.forEach((e,i)=>{const m=mood(e,i,0,used[i]);used[i].push(m.n);mk({n:e[1]+' \u00b7 '+m.n,cat:'earth',img:e[2],biome:e[3],tint:m.tint,stars:m.stars||0,orb:m.orb||null,mood:m.n})});
 /* pass 3: second mood for six landscapes -> 94 Earth worlds */
 [0,8,16,24,32,40].forEach(i=>{const e=EARTH[i],m=mood(e,i,1,used[i]);used[i].push(m.n);mk({n:e[1]+' \u00b7 '+m.n,cat:'earth',img:e[2],biome:e[3],tint:m.tint,stars:m.stars||0,orb:m.orb||null,mood:m.n})});
 /* planets */
 PLANETS.forEach(p=>mk({n:p[0],cat:'planet',img:p[1],biome:p[2],tint:p[3],gv:p[4],orb:p[5],stars:p[6],mood:'Planet'}));
})();
const WORLD_COUNT=WORLDS.length;
/* a world opens after 3 levels of the previous world are finished (stars table key 'w-l') */
const OPEN_NEED=3;
