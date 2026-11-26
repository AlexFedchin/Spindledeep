// the whole way with the real thread: shelf to shelf, into the room, out, back to the main way
const A=new URL('../../app/src/', import.meta.url).href;
const {buildTerrain}=await import(A+'terrain.js');const {World}=await import(A+'world.js');const L=await import(A+'level.js');
const T=buildTerrain(),DT=1/120;
function run(name,peg,start,pts,goal,skeins){
 const W=new World(T);W.nests.forEach(n=>n.spawned=99);W.moths.length=0;W.skeinCount=skeins;const pg=W.pegs[peg];W.thread.reset(pg.x,pg.y+.35);W.checkpoint=pg;W.player.reset(...start);
 const ev=[];let minB=99,t=0;const step=(ax,j,h)=>{t+=DT;W.update(DT,{axisX:ax,axisY:0,held:{jump:h},pressed:{jump:j}},true);for(const e of W.events)if(['death','tie','secret','keepsake','secretOpen','taut','skein'].includes(e.k))ev.push(e.k+(e.k==='tie'?W.checkpoint.i:'')+'@'+t.toFixed(1));W.events.length=0;minB=Math.min(minB,W.wholeLeft());};
 for(let i=0;i<120;i++)step(0);
 const P=W.player;let fell=0;
 for(const [x,y] of pts){let ok=false;for(let tries=0;tries<1&&!ok;tries++){
   let air=0;for(let i=0;i<120*6;i++){const dx=x-P.x;if(P.grounded&&Math.abs(dx)<0.35&&Math.abs(P.y-y)<0.9){ok=true;break}
    const dir=Math.sign(dx);let j=false;
    if(P.grounded){const gap=T.ground(P.x+dir*0.3,P.y,0.9)===null,wall=T.d(P.x+dir*.6,P.y+.1)<.28,up=y-P.y>0.7&&Math.abs(dx)<2.9;if((gap&&y>P.y-1.6)||wall||up){j=true;}}
    step(Math.abs(dx)<0.15?0:dir,j,true);if(P.dead)break}}
  if(!ok){ev.push('MISSED '+x+','+y+' at '+P.x.toFixed(1)+','+P.y.toFixed(1));break}}
 console.log(goal(W)?'OK  ':'FAIL',name,'t',t.toFixed(0),'least whole',minB.toFixed(0),ev.join(' '));}
const G=L.SHELVES.filter(s=>s[3]==='root'),H=L.SHELVES.filter(s=>s[3]==='seat'),c=([a,b,y])=>[(a+b)/2,y+.3];
run('Root Gardens, along the top from where you come in',1,[36.2,-51.5],[...G.slice(0,7).map(c),[9.2,-50.4]],W=>W.skeins[0].taken,0);
run('Root Gardens, up from the floor',2,[27.8,-60],[...[7,8,9,10,11].map(i=>c(G[i])),...G.slice(3,7).map(c),[9.2,-50.4]],W=>W.skeins[0].taken,0);
const room=[[60,-239.3],[65,-239.6],[69.4,-243.8],[62,-243.9],[57,-244.1],[53.4,-245.2]];
run('Hall of Chairs from pole 13',13,[41.6,-246],[[23.6,-246.1],...H.map(c),...room],W=>W.secrets[5].taken&&W.checkpoint.i===30,0);
run('Hall of Chairs from pole 10, no skeins',10,[18,-245],[[23.6,-246.1],...H.map(c),...room],W=>W.secrets[5].taken&&W.checkpoint.i===30,0);
run('...and from pole 30 down the hole, by the mat, to the Weighing Room',30,[53.2,-245.2],[[50.6,-246],[46.8,-258.7],[39.4,-258.7]],W=>W.player.x<40&&W.player.y<-257&&!W.player.dead,0);
