"""The trailer's clips, recorded from the running game (hidden, muted smoke window; canvas + the game's own sound).
    python scripts/trailer/capture.py <dir>    writes <dir>/cap.json for --shots; run it, then  cut.py <dir>"""
import json
import sys

OUT = sys.argv[1]
JS = r"""
window.REC=(ms)=>{(async()=>{window.B64='';const c=__SD.A.ctx;if(c.state!=='running')await c.resume();const d=c.createMediaStreamDestination();__SD.A.out.connect(d);
const v=document.getElementById('view').captureStream(30);const st=new MediaStream([...v.getVideoTracks(),...d.stream.getAudioTracks()]);
const m=new MediaRecorder(st,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:16000000,audioBitsPerSecond:160000});const ch=[];m.ondataavailable=e=>ch.push(e.data);m.start(1000);setTimeout(()=>m.stop(),ms);
m.onstop=()=>{const r=new FileReader();r.onload=()=>{window.B64=r.result.split(',')[1]};r.readAsDataURL(new Blob(ch))}})()};
window.BOT=null;
window.SET=(peg,x,y,o={})=>{const W=__SD.W;W.deep.hands.forEach(h=>h.cool=o.hands?0:99);W.memories.forEach(m=>{m.heard=true;m.at=-99});W.skeins.forEach(s=>s.taken=true);W.areaSeen=new Set(['brink','throat','gardens','gallery','mere','hall','hush','treadles','loom']);
 __SD.from(peg);const W2=__SD.W;W2.intro&&(W2.intro.done=true);W2.memories.forEach(m=>{m.heard=true;m.at=-99});W2.skeins.forEach(s=>s.taken=true);W2.areaSeen=W.areaSeen;W2.nests.forEach(n=>n.spawned=o.moths?0:99);__SD.go(x,y);
 if(o.dark){const r=W2.deep.rise;r.on=true;r.woke=true;r.t=12;r.level=y-11;}
 if(!W2.__p){W2.__p=1;const u=W2.update.bind(W2);W2.update=(dt,inp,c)=>{if(window.BOT){inp={axisX:0,axisY:0,held:{},pressed:{}};window.BOT(W2,W2.player,inp,dt)}u(dt,inp,c)}}
 window.BOT=()=>{}};
window.hk=(W)=>{const q=W.thread.pivots[W.thread.pivots.length-1];return W.thread.locked&&q&&q.hook};
window.ring=(d,edge,rel,then)=>{let ph=0,t=0,tj=0;return(W,p,i,dt)=>{t+=dt;if(ph<4)i.axisX=d;
 if(ph===0&&d*(p.x-edge)>-.35&&p.coyote>.02){i.pressed.jump=i.held.jump=true;ph=1;tj=t}
 else if(ph===1){i.held.jump=t-tj<.3;if(t-tj>.1)i.held.grip=true;if(hk(W)){ph=2;tj=t}}
 else if(ph===2){i.held.grip=true;const P=W.thread.pivots[W.thread.pivots.length-1];if(P&&t-tj>rel&&d*p.vx>0&&d*(p.x-P.x)>.2){i.pressed.jump=i.held.jump=true;ph=3;tj=t}}
 else if(ph===3){i.held.jump=t-tj<.3;if(p.grounded&&t-tj>.1)ph=4}
 else if(ph===4&&then)then(W,p,i,dt)}};
window.run=(d,to,plucks=[])=>{let t=0;return(W,p,i,dt)=>{t+=dt;if(d*(p.x-to)<0)i.axisX=d;const wall=W.T.d(p.x+d*.55,p.y+.2)<.12,gap=W.T.ground(p.x+d*.75,p.y,1.5)===null;if(p.coyote>.02&&(wall||gap)&&d*(p.x-to)<0)i.pressed.jump=i.held.jump=true;if(!p.grounded&&p.vy>0)i.held.jump=true;if(plucks.length&&t>plucks[0]){plucks.shift();i.pressed.pluck=true}}};
window.hops=(d,E,then)=>{let k=0,t=0,tj=-9;return(W,p,i,dt)=>{t+=dt;i.axisX=d;while(k<E.length&&d*(p.x-E[k])>.6)k++;if(k>=E.length&&p.grounded&&then){then(W,p,i,dt);return}if(k<E.length&&p.coyote>.02&&d*(p.x-E[k])>-.3&&t-tj>.3){i.pressed.jump=i.held.jump=true;tj=t}if(!p.grounded&&t-tj<.35)i.held.jump=true;const c=W.deep.crawler;if(c.on&&c.gap<4&&t-(window.lp||-9)>1.5){window.lp=t;i.pressed.pluck=true}}};
"""
L = [{'js': "document.head.insertAdjacentHTML('beforeend','<style>#card,#sub,#toast,#prompt,#hint,#clock{display:none!important}</style>');" + JS + "__SD.R.gamma=1.12;__SD.begin()", 'wait': 3000}]


VIEW = {'brink': 13, 'throat': 15, 'gardens': 11, 'gallery': 12, 'mere': 12.5, 'hall': 12, 'weigh': 12, 'hush': 12, 'bobbin': 9.5, 'tread': 11, 'loom1': 13.5, 'loom2': 13.5}


def clip(n, setup, bot, ms, wait=3200):
    L.append({'js': f'__SD.viewLock={VIEW[n]};' + setup, 'wait': wait})
    L.append({'js': f"REC({ms});setTimeout(()=>{{window.BOT={bot}}},500);0", 'wait': ms + 2200, 'log': f"'REC {n} '+(window.B64||'none')"})


clip('brink', "SET(0,24,1.2)", "run(1,39)", 5200)
clip('throat', "SET(11,41,0.6)", "(()=>{const a=run(1,60);return(W,p,i,dt)=>{i.axisX=p.y>-8?1:p.x<51?1:0}})()", 4200)
clip('gardens', "SET(3,20,-80.5,{moths:1})", "run(1,33,[1.8])", 5200, 4200)
clip('gallery', "SET(5,56,-121)", "ring(1,59.2,2.0,run(1,69,[0.4]))", 6800)
clip('mere', "SET(8,62,-190)", "ring(-1,60.5,2.4)", 6200)
clip('hall', "SET(13,27,-246)", "run(1,40)", 4000)
clip('weigh', "SET(31,33,-258.6)", "ring(-1,29.4,3.0,run(-1,12))", 8200)
clip('hush', "SET(36,27.4,-302.6,{hands:1})", "(()=>{const a=run(-1,24);return(W,p,i,dt)=>{i.axisX=p.y<-311?1:p.y<-305?1:-1;const h=W.deep.hands.some(q=>q.st==='lunge');if(h&&!window.hp){window.hp=1;i.pressed.pluck=true}}})()", 5200)
clip('bobbin', "SET(39,88.6,-404.6);{const b=__SD.W.rig.bobbins[0];b.x=70;b.dir=1;b.v=5}", "(W,p,i)=>{i.axisX=p.x>86.1?-1:0}", 6000, 1100)
clip('tread', "SET(19,24,-365.6)", "ring(1,26,1.4)", 5600)
clip('loom1', "SET(44,36,-487.6,{dark:1})", "hops(1,[39.1,43.0,48.1],ring(1,53.9,1.2))", 9000, 2600)
clip('loom2', "SET(45,60.6,-486.2,{dark:1})", "hops(1,[64.3,68.7,73.3,77.8],(W,p,i)=>{if(p.x<86.3)i.axisX=1;if(Math.abs(p.x-86.6)<.75||p.climb){i.held.grip=true;i.axisY=1;i.axisX=0}})", 8500, 2200)
L.append({'js': '0', 'wait': 50, 'log': "JSON.stringify(__SD.errors)"})
json.dump(L, open(OUT + '/cap.json', 'w'))
