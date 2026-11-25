// random players from every peg; measures how much of the drawn red thread lies inside rock
const src = process.argv[2] || new URL('../../app/src/', import.meta.url).href;
const {buildTerrain}=await import(src+'terrain.js'); const {World}=await import(src+'world.js'); const {mulberry}=await import(src+'util.js');
const T=buildTerrain(); const SEC=+(process.argv[3]||25), SEEDS=+(process.argv[4]||2), TRACE=process.argv[5];
let frames=0, bad=0, worst=[], cause={}, tsim=0, deep=0;
Math.random=mulberry(5);
const DT=1/120;
for(let pi=0;pi<30;pi++) for(let sd=0;sd<SEEDS;sd++){
  const r=mulberry(pi*97+sd*13+1);
  const W=new World(T); W.nests.forEach(n=>n.spawned=99); W.deep.hands.length=0; W.deep.stampers.forEach(s=>{s.per=1e9;s.ph=0;}); W.drips.length=0; W.thorns.length=0; W.gates.forEach(g=>g.open=1); W.ink=[];
  const pg=W.pegs[pi]; W.thread.reset(pg.x,pg.y+0.35); W.checkpoint=pg; pg.tied=true; W.player.reset(pg.x+0.6,pg.y+0.6);
  let dir=r()<.5?-1:1, t=0, next=0, grip=false, ay=0, jump=0, jumpH=0;
  for(let i=0;i<SEC*120;i++){
    t+=DT;
    if(t>next){ next=t+0.3+r()*1.6; const u=r(); if(u<.25)dir=-dir; else if(u<.35)dir=0; else if(u<.5) dir=r()<.5?-1:1; grip=r()<.45; ay=r()<.35?(r()<.5?1:-1):0; jump=r()<.6?1:0; jumpH=.1+r()*.35; }
    const inp={axisX:dir,axisY:grip?ay:0,held:{grip,jump:jumpH>0},pressed:{jump:jump===1}}; if(jump===1)jump=0; jumpH-=DT;
    const s=performance.now(); W.update(DT,inp,true); tsim+=performance.now()-s;
    W.events.length=0; if(W.player.dead)break;
    if(i%6) continue;
    frames++;
    const th=W.thread,P=th.poly,N=th.polyN; let fr=0,fx=0,fy=0,fs=0;
    for(let j=1;j<N;j++){ const st=P[j*5+2]; if(st===4) continue; const ax=P[j*5-5],ay2=P[j*5-4],bx=P[j*5],by=P[j*5+1]; const L=Math.hypot(bx-ax,by-ay2); const m=Math.max(1,Math.ceil(L/.08));
      for(let q=0;q<=m;q++){const x=ax+(bx-ax)*q/m,y=ay2+(by-ay2)*q/m; const d=T.d(x,y); if(d<fr){fr=d;fx=x;fy=y;fs=(j===1?'doll':j-1<(th.locked?th.pivots.length+1:1)?'taut':st===0?'fixed':'live');}}}
    if(fr<-0.06){bad++; cause[fs]=(cause[fs]||0)+1; if(fr<-0.3)deep++; worst.push([fr.toFixed(2),fx.toFixed(1),fy.toFixed(1),fs,'peg'+pi+'s'+sd,'t'+t.toFixed(1),th.locked?'L':'',W.deep?'':'' ]);}
  }
}
worst.sort((a,b)=>a[0]-b[0]);
console.log('frames',frames,'bad',bad,(100*bad/frames).toFixed(1)+'%','deep(<-0.3)',deep,JSON.stringify(cause),'ms/frame',(tsim/frames/6).toFixed(3));
const seen=new Set(); let k=0; for(const w of worst){const key=w[4]; if(seen.has(key))continue; seen.add(key); console.log(w.join(' ')); if(++k>14)break;}
