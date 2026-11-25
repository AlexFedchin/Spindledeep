const A=new URL('../../app/src/', import.meta.url).href;
const {buildTerrain}=await import(A+'terrain.js');const {World}=await import(A+'world.js');
const T=buildTerrain();const DT=1/120,idle={axisX:0,axisY:0,held:{},pressed:{}};
// last 3.2 m before every ring's take-off edge: where is she off the ground / unable to jump
const E=[['Throat L3',1,50,-25,54.5],['B0-P1',1,25.6,-117.4,29.5],['P1-P2',1,41,-122,44.8],['P2-P3',1,56,-121,59.2],['P3-P4',1,68.6,-123,71.8],['P4-P5',1,82.4,-122.4,85.8],['P5-B1',1,92,-121.6,94.8],['E-I1',-1,100.5,-193.7,96.5],['I1-I2',-1,90.5,-192.5,86],['I2-I3',-1,78,-191.5,74],['I3-I4',-1,64.5,-189.9,60.5],['I4-I5',-1,51.5,-191.5,47.5],['I5-I6',-1,39,-192.5,35]];
for(const [n,d,sx,sy,ex] of E){const W=new World(T);W.nests.forEach(q=>q.spawned=99);W.drips.length=0;W.thread.reset(sx,sy+.4);W.thread.tie(sx,sy+.4);W.player.reset(sx,sy);for(let i=0;i<40;i++)W.update(DT,idle,true);
 let air=[],lastJ=null,y0=1e9,y1=-1e9,first=null;for(let i=0;i<240;i++){W.update(DT,{axisX:d,axisY:0,held:{},pressed:{}},true);W.events.length=0;const p=W.player;if(p.y<sy-2.2)break;
  if(!p.grounded){if(first===null)first=p.x;if(d*(p.x-ex)<0.2)air.push(p.x.toFixed(2)+(p.coyote>0?'':'!'));}if(p.coyote>0)lastJ=p.x;if(p.grounded&&Math.abs(p.x-ex)<3){y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)}}
 console.log(n.padEnd(10),'edge',ex,'first off ground',first?.toFixed(2),'last jump possible',lastJ?.toFixed(2),'height range',(y1-y0).toFixed(2),'air before edge:',air.slice(0,14).join(' '));}
