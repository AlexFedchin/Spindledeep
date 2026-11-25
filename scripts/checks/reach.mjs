// what can be reached on foot (no thread) from a start, in the game's own physics: search over run/jump macros
const src=process.argv[2]||new URL('../../app/src/', import.meta.url).href;const {buildTerrain}=await import(src+'terrain.js');const {Player}=await import(src+'player.js');
const T=buildTerrain();const DT=1/120;
const th={locked:false,anchored:false,pivots:[],n:0,x:[0],y:[0]};const ctx={gates:[],hooks:[],budgetLeft:()=>99};
const key=(x,y)=>Math.round(x/0.3)+','+Math.round(y/0.5);
const M=[];for(const d of[-1,1]){M.push({d,walk:0.15});M.push({d,walk:0.5});for(const h of[0.06,0.14,0.3])for(const a of[0.15,0.3,0.45,2])M.push({d,h,a});}M.push({d:-1,h:.3,back:1,a:2},{d:1,h:.3,back:1,a:2});
function settle(P){for(let i=0;i<30&&!P.grounded;i++)P.update(DT,{axisX:0,axisY:0,held:{},pressed:{}},th,ctx)}
function run(s,m,box){const P=new Player(T);P.reset(s.x,s.y);settle(P);P.vx=m.h!==undefined?m.d*(s.v??0):0;let t=0;
 for(let i=0;i<480;i++){t+=DT;let ax;if(m.walk!==undefined)ax=t<m.walk||!P.grounded&&t<m.walk+0.4?m.d:0;else if(m.back)ax=t<0.12?-m.d:m.d;else ax=t<m.a?m.d:0;
  P.update(DT,{axisX:ax,axisY:0,held:{jump:m.h!==undefined&&t<m.h},pressed:{jump:m.h!==undefined&&i===0}},th,ctx);
  if(P.x<box[0]||P.x>box[2]||P.y<box[1]||P.y>box[3])return null;
  if(i>6&&P.grounded&&(m.walk===undefined||t>m.walk))break;}
 settle(P);return P.grounded?{x:P.x,y:P.y,v:Math.abs(P.vx)}:null;}
export function reach(x,y,box,goals){const seen=new Map(),q=[];const st={x,y};const P=new Player(T);P.reset(x,y);for(let i=0;i<400&&!P.grounded;i++)P.update(DT,{axisX:0,axisY:0,held:{},pressed:{}},th,ctx);st.x=P.x;st.y=P.y;q.push(st);seen.set(key(st.x,st.y),st);
 const got={};while(q.length){const s=q.shift();for(const[g,f]of Object.entries(goals))if(!got[g]&&f(s.x,s.y))got[g]=s;
  for(const m of M)for(const v of(m.h!==undefined?[0,4.9]:[0])){const r=run({...s,v},m,box);if(!r)continue;const k=key(r.x,r.y);if(seen.has(k))continue;r.prev=s;seen.set(k,r);q.push(r);}}
 return {n:seen.size,got,seen};}
const C=[['G1 from the way in',36.2,-51.5,[4,-63,44,-44],{alcove:(x,y)=>x<10&&y>-50.5&&y<-48,floor:(x,y)=>y<-60}],
['G1 from the floor',30,-60,[4,-63,44,-44],{alcove:(x,y)=>x<10&&y>-50.5&&y<-48,'the way in':(x,y)=>x>36&&y>-53}],
['Hall from pole 13',41.6,-246,[8,-250,78,-214],{'over the hole':(x,y)=>x>47&&x<48.6&&y>-239,ledge:(x,y)=>x>58&&x<64&&y>-239.8,room:(x,y)=>x>67&&x<72.5&&y>-244.5&&y<-240.4,'east floor':(x,y)=>x>51&&x<57&&y<-243}],
['Last Basket, out again',70,-243,[8,-262,78,-214],{'east floor':(x,y)=>x>51&&x<57&&y<-243,'out by the crawl':(x,y)=>x<60&&y<-243}]];
for(const[n,x,y,b,g]of C){const r=reach(x,y,b,g);console.log(n,'states',r.n);for(const k in g){let s=r.got[k],h=0,path=[];while(s){h++;path.unshift(s.x.toFixed(1)+','+s.y.toFixed(1));s=s.prev}console.log('   ',k.padEnd(18),r.got[k]?h+' moves':'NOT REACHED',process.argv[3]?path.join(' '):'')}}
