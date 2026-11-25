// the 12 ring gaps of the Gallery and the Mere: release times that land, old build vs new
const GAPS=[["B0-P1",1,25.6,-117.4,35.4,44.8,-122.4,29.5],["P1-P2",1,43,-122,51,59.2,-121.4,44.8],["P2-P3",1,57.6,-121,65.4,71.8,-123.4,59.2],["P3-P4",1,70.4,-123,78,85.8,-122.8,71.8],["P4-P5",1,84.2,-122.4,91.2,94.8,-122,85.8],["P5-B1",1,93.6,-121.6,98.5,112,-121.6,94.8],
["E-I1",-1,100.5,-193.7,86.2,91.2,-193,96.5],["I1-I2",-1,89.5,-192.5,74.2,79.8,-192,86],["I2-I3",-1,77.5,-191.5,60.7,68.5,-190.4,74],["I3-I4",-1,64.5,-189.9,47.7,54.3,-192,60.5],["I4-I5",-1,51.5,-191.5,35.2,41.3,-193,47.5],["I5-I6",-1,39,-192.5,24.8,28.4,-193.4,35]];
const idle={axisX:0,axisY:0,held:{},pressed:{}};
for(const src of (process.argv[2]?[process.argv[2]]:[]).concat(new URL('../../app/src/', import.meta.url).href)){
 const {buildTerrain}=await import(src+'terrain.js'),{World}=await import(src+'world.js');const T=buildTerrain();Math.random=()=>0.5;
 const res=[];
 for(const g of GAPS){const [n,dir,sx,sy,x0,x1,ty,edge]=g;let good=0;
  for(let rel=0.2;rel<5;rel+=0.1){const W=new World(T,process.env.MODE||'');W.nests.forEach(q=>q.spawned=99);W.drips.length=0;W.thread.reset(sx,sy+.4);W.thread.tie(sx,sy+.4);W.player.reset(sx,sy);for(let i=0;i<30;i++)W.update(1/120,idle,true);
   let t=0,ph=0,tj=0,ok=0;for(let i=0;i<1500;i++){t+=1/120;const p=W.player,inp={axisX:dir,axisY:0,held:{},pressed:{}};
    if(ph===0&&p.coyote>.02&&(T.d(p.x+dir*.9,p.y-.6)>.3||dir*(p.x-edge)>-.9)){inp.pressed.jump=inp.held.jump=true;ph=1;tj=t;}
    if(ph===1){inp.held.jump=t-tj<.3;if(t-tj>.12)inp.held.grip=true;if(W.thread.pivots.some(q=>q.hook)){ph=2;tj=t;}}
    if(ph===2){inp.held.grip=true;if(t-tj>rel){inp.pressed.jump=inp.held.jump=true;inp.held.grip=false;ph=3;tj=t;}}
    if(ph===3)inp.held.jump=t-tj<.3;
    W.update(1/120,inp,true);W.events.length=0;if(p.dead)break;
    if(ph>=2&&p.grounded&&p.x>x0-.6&&p.x<x1+.6&&Math.abs(p.y-ty)<1.2){ok=1;break;} if(ph===3&&p.grounded)break;}
   good+=ok;}
  res.push(n+':'+good);}
 console.log(res.join(' '));}
