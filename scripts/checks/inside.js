// What is drawn inside solid rock: draws every layer over the whole world and lists spots deeper than 0.45 m in rock.
// Run in the game as one --shots step: {js: <this file>, log: 'window.__AUD'}; set window.__OPEN = true first to count hidden rooms as found.
// Expected leftovers: shelf roots at the roof, the candles' glow.
(async()=>{
const M=await import(new URL('src/draw.js',location.href)), P=await import(new URL('src/props.js',location.href)), DD=await import(new URL('src/drawdeep.js',location.href)), DS=await import(new URL('src/drawshelf.js',location.href));
const W=window.__SD.W,T=W.T,D=new M.Drawer(W);
const w=1280,h=720,c=new OffscreenCanvas(w,h),x=c.getContext('2d',{willReadFrequently:true}),e=new OffscreenCanvas(w/2,h/2),ex=e.getContext('2d',{willReadFrequently:true});
D.time=3;D.dtLast=1/60;D.wind=0;
for(const s of W.secrets){s.open=window.__OPEN||false;s.rev=null;s.fade=1}
const layers={trees:()=>D.drawTrees(x),lore:()=>P.drawLore(D,x,ex),shelves:()=>DS.drawShelves(D,x,ex),thorns:()=>D.drawThorns(x,ex),gates:()=>D.drawGates(x,ex),hooks:()=>D.drawHooks(x,ex),pegs:()=>D.drawPegs(x,ex),bells:()=>D.drawBells(x,ex),skeins:()=>D.drawSkeins(x,ex),keeps:()=>P.drawKeepsakes(D,x,ex),mem:()=>D.drawMemories(x,ex),deep:()=>DD.drawDeep(D,x,ex),drips:()=>D.drawDrips(x),cottage:()=>D.drawCottage(x,ex)};
const depth=(X,Y)=>{let d=T.d(X,Y);if(!window.__OPEN)for(const s of W.secrets){const q=s.hide;const i=Math.min(X-q[0],q[2]-X,Y-q[1],q[3]-Y);if(i>0)d=Math.min(d,-i)}return d};
const out=[];
const VH=24;
for(let cy=2;cy>-600;cy-=22)for(let cx=20;cx<125;cx+=40){
 D.setView([cx,cy],VH,w,h);const k=D.k;
 for(const n in layers){x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,w,h);ex.setTransform(1,0,0,1,0,0);ex.clearRect(0,0,w/2,h/2);ex.setTransform(.5,0,0,.5,0,0);
  try{layers[n]()}catch(err){out.push(['ERR',n,String(err).slice(0,80)]);continue}
  const a=x.getImageData(0,0,w,h).data,b=ex.getImageData(0,0,w/2,h/2).data;
  const cells=new Map();
  for(let j=0;j<h;j+=3)for(let i=0;i<w;i+=3){const al=a[(j*w+i)*4+3];const q=(((j>>1)*(w/2))+(i>>1))*4;const em=(b[q]+b[q+1]+b[q+2])/3*Math.sqrt(b[q+3]/255);
   if(al<60&&em<12)continue;const X=cx+(i-w/2)/k,Y=cy-(j-h/2)/k,d=depth(X,Y);if(d>-0.45)continue;
   const key=Math.round(X/2)*2+','+Math.round(Y/2)*2;const o=cells.get(key)||[0,0,0];o[al>=60?0:1]++;o[2]=Math.min(o[2],d);cells.set(key,o)}
  for(const [key,o] of cells)if(o[0]+o[1]>4)out.push([n,key,o[0],o[1],o[2].toFixed(2)]);
 }}
const seen=new Map();for(const r of out){const k=r[0]+' '+r[1];seen.set(k,r)}
window.__AUD=[...seen.values()].map(r=>r.join(' ')).join('\n');
})()
