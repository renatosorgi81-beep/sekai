// ══════════════════════════════════════════════════════════════
// SEKAI — VILLAGGIO CENTRALE — Motore
// Rendering scena, ciclo giorno/notte, atmosfera, avatar, interazioni
// ══════════════════════════════════════════════════════════════
'use strict';

// ── DIMENSIONI MONDO ──
const WORLD_W = 2900;
const WORLD_H = 2000;

// ── CANVAS ──
const cv = document.getElementById('scene');
const ctx = cv.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let VW = 0, VH = 0;

function resize(){
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR;
  cv.style.width = VW+'px'; cv.style.height = VH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// ── CAMERA ──
const cam = {
  x: 1500, y: 1050,        // centro vista in coordinate-mondo
  zoom: 0.62,
  tx: 1500, ty: 1050, tzoom: 0.62,
  minZoom: 0.42, maxZoom: 1.1,
};
function clampCam(){
  const halfW = VW/2/cam.zoom, halfH = VH/2/cam.zoom;
  cam.x = Math.max(halfW, Math.min(WORLD_W-halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(WORLD_H-halfH, cam.y));
}
function worldToScreen(wx, wy){
  return { x:(wx-cam.x)*cam.zoom + VW/2, y:(wy-cam.y)*cam.zoom + VH/2 };
}
function screenToWorld(sx, sy){
  return { x:(sx-VW/2)/cam.zoom + cam.x, y:(sy-VH/2)/cam.zoom + cam.y };
}

// ── TEMPO / CICLO GIORNO-NOTTE ──
const T = {
  time: 7.5,          // ore 0..24, parte all'alba
  flow: 1,            // moltiplicatore (1=lento, 8=veloce)
  flows: [1, 8, 40],
  flowIdx: 0,
  frame: 0,
};

// Palette cielo per fasi del giorno
function skyColors(h){
  // restituisce {top, mid, bot, sun, amb, light}
  // h = 0..24
  const phases = [
    { t:0,  top:'#0a1430', mid:'#142244', bot:'#28324f', amb:0.32, light:'#5a6a9a' }, // notte fonda
    { t:5,  top:'#1a2348', mid:'#3a3a5a', bot:'#6a5a6a', amb:0.45, light:'#9a7a8a' }, // pre-alba
    { t:6.5,top:'#3a4a7a', mid:'#c08a6a', bot:'#f0c088', amb:0.7,  light:'#ffd0a0' }, // alba
    { t:9,  top:'#6aa0d8', mid:'#a8d0ea', bot:'#d8eef8', amb:1.0,  light:'#fff4e0' }, // mattino
    { t:13, top:'#5a98e0', mid:'#9ac8f0', bot:'#cae8fa', amb:1.05, light:'#fffaf0' }, // mezzogiorno
    { t:17, top:'#5a8ad0', mid:'#b0c8e0', bot:'#e8d8c0', amb:0.95, light:'#fff0d8' }, // pomeriggio
    { t:18.5,top:'#4a5a9a',mid:'#d08a6a', bot:'#f0a060', amb:0.78, light:'#ffc080' }, // tramonto
    { t:20, top:'#2a2a5a', mid:'#6a4a6a', bot:'#a05a5a', amb:0.55, light:'#c08070' }, // crepuscolo
    { t:22, top:'#101a38', mid:'#1a2448', bot:'#2a3050', amb:0.38, light:'#6a7aa0' }, // sera
    { t:24, top:'#0a1430', mid:'#142244', bot:'#28324f', amb:0.32, light:'#5a6a9a' },
  ];
  let a = phases[0], b = phases[phases.length-1];
  for (let i=0; i<phases.length-1; i++){
    if (h >= phases[i].t && h < phases[i+1].t){ a = phases[i]; b = phases[i+1]; break; }
  }
  const span = b.t - a.t || 1;
  const k = Math.max(0, Math.min(1, (h - a.t)/span));
  const lerp = (c1,c2,t)=>{
    const p=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
    const A=p(c1),B=p(c2);
    return `rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`;
  };
  return {
    top: lerp(a.top,b.top,k),
    mid: lerp(a.mid,b.mid,k),
    bot: lerp(a.bot,b.bot,k),
    light: lerp(a.light,b.light,k),
    amb: a.amb + (b.amb-a.amb)*k,
  };
}

// ── RUMORE DETERMINISTICO (per posizioni stabili di alberi/erba) ──
function hash(n){ const s=Math.sin(n*127.1)*43758.5453; return s-Math.floor(s); }

// ── BACKGROUND: cielo, sole/luna, colline, terreno ──
function drawSky(sky){
  const g = ctx.createLinearGradient(0,0,0,VH);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.5, sky.mid);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,VW,VH);
}

function drawCelestial(sky){
  // Posizione sole/luna in arco. day: 6..18 sole, resto luna.
  const h = T.time;
  const isDay = h >= 5.5 && h <= 18.5;
  const prog = isDay ? (h-5.5)/13 : ((h<5.5? h+24 : h)-18.5)/11;
  const arcX = VW*0.12 + prog*VW*0.76;
  const arcY = VH*0.62 - Math.sin(prog*Math.PI)*VH*0.5;

  if (isDay){
    // Sole con bagliore
    const sg = ctx.createRadialGradient(arcX,arcY,0,arcX,arcY,140);
    sg.addColorStop(0,'rgba(255,250,225,0.95)');
    sg.addColorStop(0.3,'rgba(255,225,160,0.6)');
    sg.addColorStop(1,'rgba(255,210,140,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(arcX,arcY,140,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,252,235,0.96)';
    ctx.beginPath(); ctx.arc(arcX,arcY,30,0,Math.PI*2); ctx.fill();
  } else {
    // Luna
    const mg = ctx.createRadialGradient(arcX,arcY,0,arcX,arcY,90);
    mg.addColorStop(0,'rgba(225,232,255,0.6)');
    mg.addColorStop(1,'rgba(200,215,255,0)');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(arcX,arcY,90,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(238,242,255,0.92)';
    ctx.beginPath(); ctx.arc(arcX,arcY,24,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=sky.top;
    ctx.beginPath(); ctx.arc(arcX+9,arcY-7,22,0,Math.PI*2); ctx.fill();
    // Stelle
    ctx.fillStyle='rgba(255,255,255,'+(sky.amb<0.5?0.8:0.15)+')';
    for(let i=0;i<60;i++){
      const sx=hash(i*3.1)*VW, sy=hash(i*7.7)*VH*0.6;
      const tw=0.5+0.5*Math.sin(T.frame*0.03+i);
      ctx.globalAlpha=(sky.amb<0.5?0.8:0.1)*tw;
      ctx.fillRect(sx,sy,1.6,1.6);
    }
    ctx.globalAlpha=1;
  }
}

// ── NUVOLE ──
const clouds = [];
for(let i=0;i<8;i++){
  clouds.push({ x:Math.random()*WORLD_W, y:120+Math.random()*380, s:0.6+Math.random()*1.1, sp:4+Math.random()*8 });
}
function drawClouds(sky){
  ctx.save();
  for(const c of clouds){
    c.x += c.sp*0.016;
    if(c.x > WORLD_W+300) c.x = -300;
    const p = worldToScreen(c.x, c.y);
    const sc = c.s * cam.zoom;
    if(p.x < -300 || p.x > VW+300) continue;
    ctx.globalAlpha = (sky.amb>0.6?0.55:0.3);
    ctx.fillStyle = sky.amb>0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(200,210,235,0.7)';
    const puffs = [[0,0,60],[45,8,48],[-42,10,46],[20,-14,42],[-18,-12,40]];
    for(const pf of puffs){
      ctx.beginPath();
      ctx.ellipse(p.x+pf[0]*sc, p.y+pf[1]*sc, pf[2]*sc, pf[2]*0.7*sc, 0,0,Math.PI*2);
      ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

// ── COLLINE (parallax) ──
function drawHills(sky){
  const layers = [
    { yBase:0.62, amp:60, col:shade(sky.bot,-30), speed:0.15 },
    { yBase:0.70, amp:90, col:shade(sky.bot,-55), speed:0.3 },
    { yBase:0.80, amp:70, col:'#3a5a3a', speed:0.55 },
  ];
  for(const L of layers){
    const oy = (cam.y-1050)*L.speed*cam.zoom;
    const baseY = VH*L.yBase + oy*0.1;
    ctx.fillStyle = L.col;
    ctx.beginPath();
    ctx.moveTo(0,VH);
    for(let x=0;x<=VW;x+=20){
      const wx = (x + (cam.x-1500)*L.speed*cam.zoom)*0.5;
      const y = baseY + Math.sin(wx*0.004)*L.amp + Math.sin(wx*0.011)*L.amp*0.4;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(VW,VH); ctx.closePath(); ctx.fill();
  }
}

// ── TERRENO VILLAGGIO ──
function drawGround(sky){
  // Prato principale (ellisse grande del villaggio)
  const c = worldToScreen(1500,1100);
  const rx = 1450*cam.zoom, ry = 1000*cam.zoom;
  // base erba
  const gg = ctx.createRadialGradient(c.x,c.y-100*cam.zoom,50,c.x,c.y,rx);
  const grassL = tint('#6aa048', sky);
  const grassD = tint('#3e6e34', sky);
  gg.addColorStop(0, grassL);
  gg.addColorStop(1, grassD);
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.ellipse(c.x,c.y,rx,ry,0,0,Math.PI*2); ctx.fill();

  // Texture erba: ciuffi pseudo-casuali
  ctx.save();
  ctx.beginPath(); ctx.ellipse(c.x,c.y,rx,ry,0,0,Math.PI*2); ctx.clip();
  for(let i=0;i<260;i++){
    const gx = 150 + hash(i*1.7)*(WORLD_W-300);
    const gy = 300 + hash(i*4.3)*(WORLD_H-400);
    const p = worldToScreen(gx,gy);
    if(p.x<-20||p.x>VW+20||p.y<-20||p.y>VH+20) continue;
    const sw = Math.sin(T.frame*0.04 + i)*2*cam.zoom;
    ctx.strokeStyle = tint(hash(i)>0.5?'#5a9040':'#4a8038', sky);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5*cam.zoom;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x+sw, p.y-7*cam.zoom, p.x+sw*1.5, p.y-13*cam.zoom);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.restore();

  // Sentieri che collegano i luoghi alla piazza
  drawPaths(sky);
}

function drawPaths(sky){
  const plaza = VILLAGE_PLACES.find(p=>p.id==='plaza');
  ctx.strokeStyle = tint('#c2a878', sky);
  ctx.globalAlpha = 0.55;
  ctx.lineCap='round';
  for(const pl of VILLAGE_PLACES){
    if(pl.id==='plaza') continue;
    const a = worldToScreen(plaza.x, plaza.y);
    const b = worldToScreen(pl.x, pl.y);
    ctx.lineWidth = 26*cam.zoom;
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    const mx=(a.x+b.x)/2 + (hash(pl.x)*60-30)*cam.zoom;
    const my=(a.y+b.y)/2 + (hash(pl.y)*60-30)*cam.zoom;
    ctx.quadraticCurveTo(mx,my,b.x,b.y);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

// ── COLORI: helper ombra/tinta in base alla luce ambientale ──
function shade(hex, amt){
  const r=Math.max(0,Math.min(255,parseInt(hex.slice(1,3),16)+amt));
  const g=Math.max(0,Math.min(255,parseInt(hex.slice(3,5),16)+amt));
  const b=Math.max(0,Math.min(255,parseInt(hex.slice(5,7),16)+amt));
  return `rgb(${r},${g},${b})`;
}
function tint(hex, sky){
  // scurisce/illumina in base ad amb e dà calore al tramonto
  const amb = sky.amb;
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r*=amb; g*=amb; b*=amb;
  // calore notturno bluastro
  if(amb<0.6){ b+=(0.6-amb)*40; r-=(0.6-amb)*10; }
  return `rgb(${Math.round(Math.max(0,Math.min(255,r)))},${Math.round(Math.max(0,Math.min(255,g)))},${Math.round(Math.max(0,Math.min(255,b)))})`;
}

// ══ ALBERI ══════════════════════════════════════════════════════
// Generati una volta, mossi dal vento in render.
const trees = [];
function seedTrees(){
  // Grande Albero dei Ricordi: speciale, grande
  trees.push({ x:850, y:760, scale:2.4, special:true, hue:'#4a7a3a' });
  // Alberi sparsi attorno al villaggio (evitano i luoghi)
  for(let i=0;i<46;i++){
    const x = 200 + hash(i*2.3)*(WORLD_W-400);
    const y = 350 + hash(i*5.1)*(WORLD_H-500);
    // evita centro piazza
    if(Math.hypot(x-1500,y-1050) < 380) continue;
    let near=false;
    for(const pl of VILLAGE_PLACES){ if(Math.hypot(x-pl.x,y-pl.y)<140){near=true;break;} }
    if(near) continue;
    const greens=['#4a7a3a','#3e6e34','#568a40','#446e38'];
    trees.push({ x, y, scale:0.8+hash(i*9.9)*0.7, special:false, hue:greens[i%greens.length] });
  }
  trees.sort((a,b)=>a.y-b.y);
}

function drawTree(t, sky){
  const p = worldToScreen(t.x, t.y);
  const s = t.scale * cam.zoom;
  if(p.x < -200 || p.x > VW+200 || p.y < -200 || p.y > VH+260) return;
  const sway = Math.sin(T.frame*0.018 + t.x*0.01)*6*s;

  // ombra
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 46*s, 14*s, 0,0,Math.PI*2); ctx.fill();

  // tronco
  ctx.fillStyle = tint('#6a4a2a', sky);
  ctx.beginPath();
  ctx.moveTo(p.x-8*s, p.y);
  ctx.lineTo(p.x-5*s, p.y-58*s);
  ctx.lineTo(p.x+5*s+sway*0.3, p.y-58*s);
  ctx.lineTo(p.x+8*s, p.y);
  ctx.closePath(); ctx.fill();

  // chioma a strati
  const cy = p.y - 70*s;
  const layers = t.special ?
    [[0,-30,70],[-38,0,52],[38,0,52],[0,18,58],[-20,-18,46],[24,-20,46]] :
    [[0,-18,48],[-28,4,38],[28,4,38],[0,14,42]];
  const base = tint(t.hue, sky);
  const lite = tint(shade(t.hue,28), sky);
  for(let i=0;i<layers.length;i++){
    const L=layers[i];
    ctx.fillStyle = i%2? lite : base;
    ctx.beginPath();
    ctx.ellipse(p.x+L[0]*s+sway, cy+L[1]*s, L[2]*s, L[2]*0.9*s, 0,0,Math.PI*2);
    ctx.fill();
  }
  // luce del sole sulla chioma
  if(sky.amb>0.6){
    ctx.fillStyle='rgba(255,245,200,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x-18*s+sway, cy-22*s, 30*s,26*s,0,0,Math.PI*2); ctx.fill();
  }

  // genera foglie cadenti occasionali
  if(Math.random()<0.006*t.scale){
    leaves.push({ x:t.x+(Math.random()*80-40)*t.scale, y:t.y-90*t.scale, vx:Math.random()*0.6-0.3,
      vy:0.3+Math.random()*0.4, rot:Math.random()*6, rs:Math.random()*0.1-0.05,
      a:1, col:hash(t.x)>0.5?'#d8a850':'#c87838', size:5+Math.random()*4 });
  }
}

// ── FOGLIE CADENTI ──
const leaves = [];
function drawLeaves(sky){
  for(let i=leaves.length-1;i>=0;i--){
    const lf=leaves[i];
    lf.x += lf.vx + Math.sin(T.frame*0.04+i)*0.3;
    lf.y += lf.vy; lf.rot += lf.rs; lf.a -= 0.003;
    if(lf.a<=0 || lf.y>WORLD_H){ leaves.splice(i,1); continue; }
    const p=worldToScreen(lf.x,lf.y);
    if(p.x<-20||p.x>VW+20) continue;
    ctx.save();
    ctx.globalAlpha=lf.a*0.85;
    ctx.translate(p.x,p.y); ctx.rotate(lf.rot);
    ctx.fillStyle=tint(lf.col,sky);
    const sz=lf.size*cam.zoom;
    ctx.beginPath(); ctx.ellipse(0,0,sz,sz*0.5,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
}

// ── PARTICELLE LUMINOSE (lucciole di sera/notte, polline di giorno) ──
const sparks=[];
for(let i=0;i<40;i++){
  sparks.push({ x:Math.random()*WORLD_W, y:300+Math.random()*(WORLD_H-400),
    ph:Math.random()*6, sp:0.2+Math.random()*0.3 });
}
function drawSparks(sky){
  const night = sky.amb<0.6;
  for(let i=0;i<sparks.length;i++){
    const s=sparks[i];
    s.x += Math.sin(T.frame*0.01+s.ph)*0.4;
    s.y += Math.cos(T.frame*0.013+s.ph)*0.3 - (night?0.1:0);
    if(s.y<280) s.y=WORLD_H-120;
    const p=worldToScreen(s.x,s.y);
    if(p.x<-10||p.x>VW+10||p.y<-10||p.y>VH+10) continue;
    const tw=0.5+0.5*Math.sin(T.frame*0.05+s.ph*3);
    const sz=(night?2.4:1.6)*cam.zoom*tw;
    const col = night? '255,235,140' : '255,250,210';
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,sz*4);
    g.addColorStop(0,`rgba(${col},${(night?0.9:0.5)*tw})`);
    g.addColorStop(1,`rgba(${col},0)`);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(p.x,p.y,sz*4,0,Math.PI*2); ctx.fill();
  }
}

// ── UCCELLI OCCASIONALI ──
const birds=[];
function maybeSpawnBird(){
  if(Math.random()<0.004 && birds.length<4){
    const fromLeft=Math.random()<0.5;
    birds.push({ x:fromLeft?-100:WORLD_W+100, y:200+Math.random()*300,
      vx:(fromLeft?1:-1)*(1.4+Math.random()), ph:Math.random()*6 });
  }
}
function drawBirds(sky){
  for(let i=birds.length-1;i>=0;i--){
    const b=birds[i];
    b.x+=b.vx; b.y+=Math.sin(T.frame*0.04+b.ph)*0.4;
    if(b.x<-150||b.x>WORLD_W+150){ birds.splice(i,1); continue; }
    const p=worldToScreen(b.x,b.y);
    const flap=Math.sin(T.frame*0.3+b.ph)*8*cam.zoom;
    ctx.strokeStyle = sky.amb>0.6?'rgba(40,40,50,0.6)':'rgba(20,20,40,0.8)';
    ctx.lineWidth=2*cam.zoom; ctx.lineCap='round';
    const w=10*cam.zoom*(b.vx>0?1:-1);
    ctx.beginPath();
    ctx.moveTo(p.x-w,p.y+flap);
    ctx.quadraticCurveTo(p.x,p.y-4*cam.zoom,p.x+w,p.y+flap);
    ctx.stroke();
  }
}

// ══ LUOGHI (edifici/landmark sulla scena) ══════════════════════
function drawPlace(pl, sky){
  const p = worldToScreen(pl.x, pl.y);
  const s = cam.zoom;
  if(p.x<-160||p.x>VW+160||p.y<-160||p.y>VH+200) return;

  // ombra base
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y+8*s, 60*s, 18*s, 0,0,Math.PI*2); ctx.fill();

  // disegno specifico per tipo
  switch(pl.id){
    case 'fountain':   drawFountain(p,s,sky); break;
    case 'tree':       /* è un albero, già reso */ break;
    case 'library':    drawBuilding(p,s,sky,'#9a6a3a','📚'); break;
    case 'cafe':       drawBuilding(p,s,sky,'#b5703a','☕'); break;
    case 'plaza':      drawPlaza(p,s,sky); break;
    case 'garden':     drawGarden(p,s,sky); break;
    case 'forest':     drawSignpost(p,s,sky,'🌲','#3f7a3a'); break;
    case 'lake':       drawSignpost(p,s,sky,'🌙','#4a6a9a'); break;
    case 'port':       drawPort(p,s,sky); break;
    case 'events':     drawEventStage(p,s,sky); break;
    default:           drawBuilding(p,s,sky,pl.color,pl.icon);
  }

  // etichetta luogo (icona + nome) sopra
  const ly = p.y - 90*s;
  ctx.font = `${22*s}px serif`;
  ctx.textAlign='center';
  ctx.fillText(pl.icon, p.x, ly);
  ctx.font = `italic ${13*s}px 'Cormorant Garamond', serif`;
  ctx.fillStyle = 'rgba(246,236,214,'+(0.5+sky.amb*0.4)+')';
  ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=6*s;
  ctx.fillText(pl.name, p.x, ly+16*s);
  ctx.shadowBlur=0;
}

function drawBuilding(p,s,sky,color,icon){
  const w=90*s, h=70*s;
  // muri
  ctx.fillStyle=tint(color,sky);
  ctx.fillRect(p.x-w/2, p.y-h, w, h);
  // tetto
  ctx.fillStyle=tint(shade(color,-40),sky);
  ctx.beginPath();
  ctx.moveTo(p.x-w/2-10*s, p.y-h);
  ctx.lineTo(p.x, p.y-h-42*s);
  ctx.lineTo(p.x+w/2+10*s, p.y-h);
  ctx.closePath(); ctx.fill();
  // porta
  ctx.fillStyle=tint(shade(color,-55),sky);
  ctx.fillRect(p.x-12*s, p.y-34*s, 24*s, 34*s);
  // finestre illuminate di sera
  const lit = sky.amb<0.7;
  ctx.fillStyle = lit? 'rgba(255,220,140,0.9)' : tint('#cdd8e0',sky);
  ctx.fillRect(p.x-w/2+12*s, p.y-h+14*s, 18*s, 16*s);
  ctx.fillRect(p.x+w/2-30*s, p.y-h+14*s, 18*s, 16*s);
  if(lit){
    ctx.shadowColor='rgba(255,210,120,0.7)'; ctx.shadowBlur=12*s;
    ctx.fillRect(p.x-w/2+12*s, p.y-h+14*s, 18*s, 16*s);
    ctx.fillRect(p.x+w/2-30*s, p.y-h+14*s, 18*s, 16*s);
    ctx.shadowBlur=0;
  }
}

function drawFountain(p,s,sky){
  // vasca
  ctx.fillStyle=tint('#8a92a0',sky);
  ctx.beginPath(); ctx.ellipse(p.x,p.y,52*s,24*s,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=tint('#5a9ac0',sky);
  ctx.beginPath(); ctx.ellipse(p.x,p.y,42*s,18*s,0,0,Math.PI*2); ctx.fill();
  // riflesso acqua animato
  ctx.fillStyle='rgba(255,255,255,0.25)';
  for(let i=0;i<3;i++){
    const rr=(10+i*12)*s + Math.sin(T.frame*0.06+i)*3*s;
    ctx.globalAlpha=0.3-i*0.08;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,rr,rr*0.42,0,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;
  // colonna centrale
  ctx.fillStyle=tint('#a0a8b4',sky);
  ctx.fillRect(p.x-7*s,p.y-40*s,14*s,40*s);
  ctx.beginPath(); ctx.ellipse(p.x,p.y-40*s,18*s,7*s,0,0,Math.PI*2); ctx.fill();
  // zampillo
  ctx.strokeStyle='rgba(200,235,255,0.6)'; ctx.lineWidth=2*s;
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y-44*s);
    ctx.quadraticCurveTo(p.x+Math.cos(a)*22*s,p.y-58*s,p.x+Math.cos(a)*30*s,p.y-30*s);
    ctx.stroke();
  }
}

function drawPlaza(p,s,sky){
  // lastricato circolare
  ctx.fillStyle=tint('#c2a878',sky);
  ctx.beginPath(); ctx.ellipse(p.x,p.y,120*s,70*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=tint('#9a8458',sky); ctx.lineWidth=2*s;
  for(let i=1;i<=3;i++){ ctx.beginPath(); ctx.ellipse(p.x,p.y,40*i*s,23*i*s,0,0,Math.PI*2); ctx.stroke(); }
  // lanterne ai bordi
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2;
    const lx=p.x+Math.cos(a)*120*s, ly=p.y+Math.sin(a)*70*s;
    ctx.fillStyle=tint('#5a4a3a',sky);
    ctx.fillRect(lx-2*s,ly-26*s,4*s,26*s);
    const lit=sky.amb<0.7;
    ctx.fillStyle=lit?'rgba(255,200,110,0.95)':tint('#caa',sky);
    if(lit){ctx.shadowColor='rgba(255,190,100,0.8)';ctx.shadowBlur=14*s;}
    ctx.beginPath(); ctx.arc(lx,ly-30*s,5*s,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }
}

function drawGarden(p,s,sky){
  // aiuola
  ctx.fillStyle=tint('#4a7a3a',sky);
  ctx.beginPath(); ctx.ellipse(p.x,p.y,70*s,40*s,0,0,Math.PI*2); ctx.fill();
  // fiori
  const cols=['#e87a9a','#f0a050','#e0d060','#c080d0','#f0f0f0'];
  for(let i=0;i<22;i++){
    const a=hash(i*pl_seed(p))*Math.PI*2, r=hash(i*3.3)*60*s;
    const fx=p.x+Math.cos(a)*r, fy=p.y+Math.sin(a)*r*0.55;
    const sway=Math.sin(T.frame*0.05+i)*1.5*s;
    ctx.fillStyle=tint(cols[i%cols.length],sky);
    ctx.beginPath(); ctx.arc(fx+sway,fy-6*s,3.5*s,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=tint('#3a6a2a',sky); ctx.fillRect(fx-0.5*s,fy-6*s,1*s,6*s);
  }
  // petali nell'aria
  if(Math.random()<0.04){
    leaves.push({x:p.x+(Math.random()*120-60),y:p.y-20,vx:Math.random()*0.5-0.25,vy:0.15+Math.random()*0.25,
      rot:Math.random()*6,rs:Math.random()*0.08-0.04,a:1,col:'#f0a8c0',size:4});
  }
}
function pl_seed(p){ return (p.x*0.013+p.y*0.007); }

function drawSignpost(p,s,sky,emoji,col){
  ctx.fillStyle=tint('#6a4a2a',sky);
  ctx.fillRect(p.x-3*s,p.y-46*s,6*s,46*s);
  ctx.fillStyle=tint(col,sky);
  ctx.fillRect(p.x-26*s,p.y-46*s,52*s,22*s);
  ctx.font=`${16*s}px serif`; ctx.textAlign='center';
  ctx.fillText(emoji,p.x,p.y-30*s);
  // arco verso l'uscita
  ctx.strokeStyle=tint(col,sky); ctx.lineWidth=4*s; ctx.globalAlpha=0.5;
  ctx.beginPath(); ctx.arc(p.x,p.y+10*s,30*s,Math.PI,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=1;
}

function drawPort(p,s,sky){
  // pontile
  ctx.fillStyle=tint('#7a5a3a',sky);
  ctx.fillRect(p.x-50*s,p.y-6*s,100*s,12*s);
  // acqua
  ctx.fillStyle=tint('#3a6a9a',sky);
  ctx.beginPath(); ctx.ellipse(p.x+60*s,p.y+20*s,80*s,30*s,0,0,Math.PI*2); ctx.fill();
  // barca
  const bob=Math.sin(T.frame*0.04)*3*s;
  ctx.fillStyle=tint('#8a5a3a',sky);
  ctx.beginPath();
  ctx.moveTo(p.x+30*s,p.y+18*s+bob);
  ctx.lineTo(p.x+90*s,p.y+18*s+bob);
  ctx.lineTo(p.x+78*s,p.y+34*s+bob);
  ctx.lineTo(p.x+42*s,p.y+34*s+bob);
  ctx.closePath(); ctx.fill();
  // vela
  ctx.fillStyle=tint('#e8e0d0',sky);
  ctx.beginPath();
  ctx.moveTo(p.x+58*s,p.y+16*s+bob);
  ctx.lineTo(p.x+58*s,p.y-30*s+bob);
  ctx.lineTo(p.x+84*s,p.y+14*s+bob);
  ctx.closePath(); ctx.fill();
}

function drawEventStage(p,s,sky){
  // palco
  ctx.fillStyle=tint('#7a4a6a',sky);
  ctx.fillRect(p.x-50*s,p.y-30*s,100*s,30*s);
  // tendone
  ctx.fillStyle=tint('#a05ab0',sky);
  ctx.beginPath();
  ctx.moveTo(p.x-58*s,p.y-30*s);
  ctx.lineTo(p.x,p.y-72*s);
  ctx.lineTo(p.x+58*s,p.y-30*s);
  ctx.closePath(); ctx.fill();
  // strisce tendone
  ctx.fillStyle=tint('#c87ad0',sky);
  for(let i=-2;i<=2;i++){
    ctx.beginPath();
    ctx.moveTo(p.x+i*22*s,p.y-30*s);
    ctx.lineTo(p.x,p.y-72*s);
    ctx.lineTo(p.x+(i+1)*22*s,p.y-30*s);
    ctx.closePath();
    if((i+2)%2===0) ctx.fill();
  }
  // lanterne festose
  const lit=sky.amb<0.75;
  for(let i=0;i<5;i++){
    const lx=p.x-44*s+i*22*s;
    ctx.fillStyle=lit?['#ffd060','#ff8060','#60d0ff','#ff60a0','#a0ff60'][i]:tint('#aaa',sky);
    if(lit){ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10*s;}
    ctx.beginPath(); ctx.arc(lx,p.y-30*s,4*s,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }
}

// ══ AVATAR (NPC) — AI di movimento autonomo ════════════════════
let ALL_AVATARS = [];   // 30 generati
let ACTIVE = [];        // max 15 visibili e simulati
const MAX_ACTIVE = 15;

function initAvatars(){
  ALL_AVATARS = generateAvatars(30);
  // stato dinamico per ognuno
  for(const a of ALL_AVATARS){
    a.state = 'idle';      // idle | walking | sitting | greeting
    a.x = 1500 + (Math.random()*600-300);
    a.y = 1050 + (Math.random()*400-200);
    a.tx = a.x; a.ty = a.y;
    a.dir = 1;             // 1=destra, -1=sinistra
    a.speed = 0.5 + Math.random()*0.5;
    a.timer = Math.random()*200;
    a.walkPhase = Math.random()*6;
    a.target = null;       // luogo destinazione
    a.sitTime = 0;
    a.greetTarget = null;
    a.greetTime = 0;
  }
  // attiva i primi 15
  ACTIVE = ALL_AVATARS.slice(0, MAX_ACTIVE);
}

function pickDestination(a){
  // 60% va verso un luogo, 40% gira a caso
  if(Math.random()<0.6){
    const pl = VILLAGE_PLACES[rint(0,VILLAGE_PLACES.length-1)];
    a.target = pl;
    a.tx = pl.x + (Math.random()*120-60);
    a.ty = pl.y + 50 + (Math.random()*60-30);
  } else {
    a.target = null;
    const ang=Math.random()*Math.PI*2, dist=150+Math.random()*350;
    a.tx = Math.max(250, Math.min(WORLD_W-250, a.x+Math.cos(ang)*dist));
    a.ty = Math.max(400, Math.min(WORLD_H-250, a.y+Math.sin(ang)*dist));
  }
  a.state='walking';
}

function updateAvatar(a, dt){
  a.timer -= dt;

  switch(a.state){
    case 'idle':
      if(a.timer<=0){
        const r=Math.random();
        if(r<0.15){ a.state='sitting'; a.sitTime=120+Math.random()*240; a.timer=a.sitTime; }
        else pickDestination(a);
      }
      // saluto occasionale ad avatar vicino
      maybeGreet(a);
      break;

    case 'walking': {
      const dx=a.tx-a.x, dy=a.ty-a.y, d=Math.hypot(dx,dy);
      if(d<6){ a.state='idle'; a.timer=80+Math.random()*200; break; }
      a.dir = dx<0?-1:1;
      a.x += (dx/d)*a.speed*dt*0.6;
      a.y += (dy/d)*a.speed*dt*0.6;
      a.walkPhase += dt*0.25;
      break;
    }

    case 'sitting':
      if(a.timer<=0){ a.state='idle'; a.timer=40+Math.random()*120; }
      break;

    case 'greeting':
      a.greetTime -= dt;
      if(a.greetTime<=0){ a.state='idle'; a.timer=60+Math.random()*120; a.greetTarget=null; }
      break;
  }
}

function maybeGreet(a){
  if(Math.random()>0.01) return;
  for(const b of ACTIVE){
    if(b===a) continue;
    if(Math.hypot(a.x-b.x,a.y-b.y)<70){
      a.state='greeting'; a.greetTime=70; a.greetTarget=b;
      a.dir = b.x<a.x?-1:1;
      break;
    }
  }
}

function drawAvatar(a, sky, hovered){
  const p = worldToScreen(a.x, a.y);
  const s = cam.zoom * 1.0;
  if(p.x<-60||p.x>VW+60||p.y<-80||p.y>VH+60) return;

  const c = a.colors;
  const walking = a.state==='walking';
  const sitting = a.state==='sitting';
  const greeting = a.state==='greeting';
  const bob = walking ? Math.abs(Math.sin(a.walkPhase))*3*s : 0;
  const legSwing = walking ? Math.sin(a.walkPhase)*6*s : 0;
  const baseY = p.y - bob - (sitting?-6*s:0);

  // ombra
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y+2*s, 14*s, 5*s, 0,0,Math.PI*2); ctx.fill();

  // evidenzia se hover
  if(hovered){
    ctx.strokeStyle='rgba(224,184,100,0.8)'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+2*s, 18*s, 7*s,0,0,Math.PI*2); ctx.stroke();
  }

  const headR = 9*s;
  const bodyTop = baseY - 44*s;
  const bodyBot = baseY - (sitting?14*s:18*s);

  // gambe
  ctx.strokeStyle=tint(shade(c.cloth,-30),sky); ctx.lineWidth=4.5*s; ctx.lineCap='round';
  if(!sitting){
    ctx.beginPath(); ctx.moveTo(p.x-3*s,bodyBot); ctx.lineTo(p.x-3*s+legSwing,baseY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+3*s,bodyBot); ctx.lineTo(p.x+3*s-legSwing,baseY); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(p.x-3*s,bodyBot); ctx.lineTo(p.x-8*s,baseY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+3*s,bodyBot); ctx.lineTo(p.x+8*s,baseY); ctx.stroke();
  }

  // corpo (vestito)
  ctx.fillStyle=tint(c.cloth,sky);
  ctx.beginPath();
  ctx.moveTo(p.x-9*s,bodyBot);
  ctx.lineTo(p.x-7*s,bodyTop+6*s);
  ctx.quadraticCurveTo(p.x,bodyTop,p.x+7*s,bodyTop+6*s);
  ctx.lineTo(p.x+9*s,bodyBot);
  ctx.closePath(); ctx.fill();

  // braccia
  ctx.strokeStyle=tint(c.cloth,sky); ctx.lineWidth=4*s;
  const armSwing = walking? Math.sin(a.walkPhase+Math.PI)*5*s : 0;
  if(greeting){
    // braccio alzato a salutare
    ctx.beginPath(); ctx.moveTo(p.x+5*s,bodyTop+10*s);
    ctx.lineTo(p.x+(14+Math.sin(T.frame*0.3)*3)*s, bodyTop-6*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x-5*s,bodyTop+10*s); ctx.lineTo(p.x-7*s,bodyBot-2*s); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(p.x-5*s,bodyTop+10*s); ctx.lineTo(p.x-8*s+armSwing,bodyBot-2*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+5*s,bodyTop+10*s); ctx.lineTo(p.x+8*s-armSwing,bodyBot-2*s); ctx.stroke();
  }

  // testa
  const headY = bodyTop - headR + 2*s;
  ctx.fillStyle=tint(c.skin,sky);
  ctx.beginPath(); ctx.arc(p.x, headY, headR, 0, Math.PI*2); ctx.fill();
  // capelli
  ctx.fillStyle=tint(c.hair,sky);
  ctx.beginPath();
  ctx.arc(p.x, headY-1*s, headR+1*s, Math.PI*1.05, Math.PI*1.95);
  ctx.lineTo(p.x+headR*0.7, headY-2*s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, headY-3*s, headR, Math.PI, Math.PI*2); ctx.fill();
  // occhi (puntini, guarda nella direzione di marcia)
  ctx.fillStyle='rgba(30,25,30,0.85)';
  const ex=a.dir*2*s;
  ctx.beginPath(); ctx.arc(p.x-2.5*s+ex, headY+1*s, 1.3*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x+2.5*s+ex, headY+1*s, 1.3*s,0,Math.PI*2); ctx.fill();

  // nome (solo se zoom sufficiente o hover)
  if(cam.zoom>0.7 || hovered){
    ctx.font=`${11*s}px 'Cormorant Garamond', serif`;
    ctx.textAlign='center';
    ctx.fillStyle='rgba(246,236,214,0.92)';
    ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=4*s;
    ctx.fillText(a.name, p.x, headY-headR-6*s);
    ctx.shadowBlur=0;
    // primo interesse
    if(hovered && a.passions[0]){
      ctx.font=`italic ${9*s}px 'Cormorant Garamond', serif`;
      ctx.fillStyle='rgba(224,184,100,0.85)';
      ctx.fillText('· '+a.passions[0]+' ·', p.x, headY-headR-18*s);
    }
  }

  // bolla di saluto
  if(greeting && a.greetTime>40){
    ctx.font=`${14*s}px serif`; ctx.textAlign='center';
    ctx.globalAlpha=Math.min(1,(a.greetTime-40)/10);
    ctx.fillText('👋', p.x+12*s, headY-12*s);
    ctx.globalAlpha=1;
  }
  // compagno animale che segue (a volte)
  if(a.petEmoji && a.petEmoji!=='\ud83c\udf3f' && (a.id.charCodeAt(4)%3===0)){
    ctx.font=`${12*s}px serif`; ctx.textAlign='center';
    const px=p.x - a.dir*16*s, py=p.y;
    ctx.fillText(a.petEmoji, px, py);
  }
}

// ══ MINI-AVATAR SVG per la scheda ═══════════════════════════════
function avatarSVG(a){
  const c=a.colors;
  return `
    <ellipse cx="50" cy="122" rx="20" ry="5" fill="rgba(0,0,0,0.2)"/>
    <line x1="44" y1="92" x2="40" y2="120" stroke="${shade(c.cloth,-30)}" stroke-width="7" stroke-linecap="round"/>
    <line x1="56" y1="92" x2="60" y2="120" stroke="${shade(c.cloth,-30)}" stroke-width="7" stroke-linecap="round"/>
    <path d="M36,92 L38,52 Q50,42 62,52 L64,92 Z" fill="${c.cloth}"/>
    <line x1="40" y1="58" x2="30" y2="90" stroke="${c.cloth}" stroke-width="6" stroke-linecap="round"/>
    <line x1="60" y1="58" x2="70" y2="90" stroke="${c.cloth}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="50" cy="36" r="17" fill="${c.skin}"/>
    <path d="M33,32 Q34,16 50,16 Q66,16 67,32 Q60,24 50,24 Q40,24 33,32 Z" fill="${c.hair}"/>
    <path d="M33,36 Q33,20 50,20 Q67,20 67,36" fill="${c.hair}"/>
    <circle cx="44" cy="37" r="2" fill="#2a2228"/>
    <circle cx="56" cy="37" r="2" fill="#2a2228"/>
    <path d="M44,45 Q50,49 56,45" stroke="#9a6a5a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="42" rx="3" ry="2" fill="#e88" opacity="0.35"/>
    <ellipse cx="60" cy="42" rx="3" ry="2" fill="#e88" opacity="0.35"/>
  `;
}

// ══ INPUT: drag, zoom, click ════════════════════════════════════
let dragging=false, dragMoved=false, lastX=0, lastY=0;
let pointerScreen={x:-999,y:-999};

cv.addEventListener('pointerdown', e=>{
  dragging=true; dragMoved=false; lastX=e.clientX; lastY=e.clientY;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e=>{
  pointerScreen={x:e.clientX,y:e.clientY};
  if(dragging){
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    if(Math.abs(dx)+Math.abs(dy)>3) dragMoved=true;
    cam.x -= dx/cam.zoom; cam.y -= dy/cam.zoom;
    cam.tx=cam.x; cam.ty=cam.y;
    lastX=e.clientX; lastY=e.clientY;
    clampCam();
  }
});
cv.addEventListener('pointerup', e=>{
  dragging=false;
  if(!dragMoved) handleClick(e.clientX, e.clientY);
});
cv.addEventListener('pointercancel', ()=>{ dragging=false; });

// zoom con rotellina
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  const before=screenToWorld(e.clientX,e.clientY);
  cam.tzoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.tzoom * (e.deltaY<0?1.12:0.89)));
  cam.zoom = cam.tzoom;
  const after=screenToWorld(e.clientX,e.clientY);
  cam.x += before.x-after.x; cam.y += before.y-after.y;
  cam.tx=cam.x; cam.ty=cam.y;
  clampCam();
},{passive:false});

// pinch zoom mobile
let pinchDist=0;
cv.addEventListener('touchmove', e=>{
  if(e.touches.length===2){
    e.preventDefault();
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    if(pinchDist){
      cam.tzoom=Math.max(cam.minZoom,Math.min(cam.maxZoom,cam.tzoom*(d/pinchDist)));
      cam.zoom=cam.tzoom; clampCam();
    }
    pinchDist=d;
  }
},{passive:false});
cv.addEventListener('touchend', ()=>{ pinchDist=0; });

function handleClick(sx, sy){
  // trova avatar più vicino al click
  let best=null, bestD=40;
  for(const a of ACTIVE){
    const p=worldToScreen(a.x,a.y);
    const d=Math.hypot(p.x-sx, p.y-(sy-20*cam.zoom));
    if(d<bestD){ bestD=d; best=a; }
  }
  if(best){ openAvatarCard(best); return; }

  // altrimenti: click su luogo → centra
  const w=screenToWorld(sx,sy);
  for(const pl of VILLAGE_PLACES){
    if(Math.hypot(w.x-pl.x, w.y-pl.y)<90){ focusPlace(pl); return; }
  }
}

// ══ HOVER: rileva avatar/luogo sotto il puntatore ═══════════════
let hoverAvatar=null, hoverPlace=null;
function updateHover(){
  hoverAvatar=null; hoverPlace=null;
  if(pointerScreen.x<0) return;
  let bestD=40;
  for(const a of ACTIVE){
    const p=worldToScreen(a.x,a.y);
    const d=Math.hypot(p.x-pointerScreen.x, p.y-(pointerScreen.y-20*cam.zoom));
    if(d<bestD){ bestD=d; hoverAvatar=a; }
  }
  if(!hoverAvatar){
    const w=screenToWorld(pointerScreen.x,pointerScreen.y);
    for(const pl of VILLAGE_PLACES){
      if(Math.hypot(w.x-pl.x,w.y-pl.y)<90){ hoverPlace=pl; break; }
    }
  }
  // tooltip luogo
  const tip=document.getElementById('place-tip');
  if(hoverPlace && !hoverAvatar){
    tip.innerHTML=`<div class="pt-name">${hoverPlace.icon} ${hoverPlace.name}</div><div class="pt-desc">${hoverPlace.desc}</div>`;
    tip.style.left=Math.min(VW-250,pointerScreen.x+14)+'px';
    tip.style.top=(pointerScreen.y+14)+'px';
    tip.classList.add('show');
    cv.style.cursor='pointer';
  } else {
    tip.classList.remove('show');
    cv.style.cursor = hoverAvatar? 'pointer' : (dragging?'grabbing':'grab');
  }
}

// ══ CAMERA helpers ══════════════════════════════════════════════
function focusPlace(pl){
  cam.tx=pl.x; cam.ty=pl.y-40; cam.tzoom=0.85;
}
function recenterView(){ cam.tx=1500; cam.ty=1050; cam.tzoom=0.62; }


// ══ SCHEDA AVATAR + INTERAZIONI ═════════════════════════════════
let selectedAvatar=null;

function openAvatarCard(a){
  selectedAvatar=a;
  document.getElementById('ac-avatar').innerHTML=avatarSVG(a);
  document.getElementById('ac-name').textContent=a.name;
  document.getElementById('ac-age').textContent=a.age+' anni';
  document.getElementById('ac-phrase').textContent='“'+a.phrase+'”';
  document.getElementById('ac-passions').innerHTML=
    a.passions.map(p=>`<span class="ac-tag">${p}</span>`).join('');
  document.getElementById('ac-story').textContent=a.story;
  document.getElementById('ac-pet').innerHTML=
    `<span class="pet-emoji">${a.petEmoji}</span> ${a.pet.charAt(0).toUpperCase()+a.pet.slice(1)}`;
  document.getElementById('avatar-card').classList.add('open');
  // l'avatar si ferma e ti guarda
  a.state='idle'; a.timer=300;
  cam.tx=a.x; cam.ty=a.y-30; cam.tzoom=Math.max(cam.tzoom,0.8);
}
function closeAvatarCard(){
  document.getElementById('avatar-card').classList.remove('open');
  selectedAvatar=null;
}
window.closeAvatarCard=closeAvatarCard;

const REACTIONS = {
  greet:      a=>`${a.name} ti sorride e ricambia il saluto. 🙋`,
  thank:      a=>`${a.name} arrossisce. «Grazie a te, davvero.» 🙏`,
  compliment: a=>`${a.name} sorride imbarazzata. «Che gentile…» ✨`,
  passion:    a=>`Parli di ${a.passions[0]} con ${a.name}. Gli occhi le brillano. 💛`,
  visit:      a=>{
    const pl=VILLAGE_PLACES[rint(0,VILLAGE_PLACES.length-1)];
    a.target=pl; a.tx=pl.x+(Math.random()*80-40); a.ty=pl.y+50; a.state='walking';
    return `${a.name} ti accompagna verso ${pl.name}. ${pl.icon}`;
  },
};

function interact(kind){
  if(!selectedAvatar) return;
  const a=selectedAvatar;
  const msg = REACTIONS[kind](a);
  showToast(msg);
  if(kind==='greet'){ a.state='greeting'; a.greetTime=80; a.dir=1; }
  if(kind==='visit'){ closeAvatarCard(); }
}
window.interact=interact;

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'), 3200);
}

// ══ BARRA LUOGHI ════════════════════════════════════════════════
function buildPlacesBar(){
  const bar=document.getElementById('places-bar');
  bar.innerHTML=VILLAGE_PLACES.map(pl=>
    `<div class="place-chip" data-id="${pl.id}"><span class="pc-icon">${pl.icon}</span><span class="pc-name">${pl.name}</span></div>`
  ).join('');
  bar.querySelectorAll('.place-chip').forEach(chip=>{
    chip.onclick=()=>{
      const pl=VILLAGE_PLACES.find(p=>p.id===chip.dataset.id);
      if(pl) focusPlace(pl);
    };
  });
}

// ══ TEMPO: orologio + flusso ════════════════════════════════════
function updateClockUI(){
  const h=Math.floor(T.time), m=Math.floor((T.time-h)*60);
  document.getElementById('clock-time').textContent=
    String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  let ic='🌅';
  if(T.time>=6.5&&T.time<9) ic='🌅';
  else if(T.time>=9&&T.time<17) ic='☀️';
  else if(T.time>=17&&T.time<19) ic='🌇';
  else if(T.time>=19&&T.time<21) ic='🌆';
  else ic='🌙';
  document.getElementById('clock-icon').textContent=ic;
}
function toggleTimeFlow(){
  T.flowIdx=(T.flowIdx+1)%T.flows.length;
  T.flow=T.flows[T.flowIdx];
  document.getElementById('time-btn').textContent=['⏩','⏩⏩','⏩⏩⏩'][T.flowIdx];
  showToast('Velocità tempo: '+['lenta','media','veloce'][T.flowIdx]);
}
window.toggleTimeFlow=toggleTimeFlow;
window.recenterView=recenterView;

// ══ RITORNO ALLA MAPPA (postMessage al parent) ══════════════════
function goBack(){
  if(window.parent && window.parent!==window){
    window.parent.postMessage({type:'BACK_TO_MAP'},'*');
  } else {
    showToast('Sei già nel villaggio. (Modalità standalone)');
  }
}
window.goBack=goBack;
// mostra il pulsante "Mappa" solo se in iframe
if(window.parent && window.parent!==window){
  document.getElementById('back-btn').style.display='flex';
}

// ══ NOTTE: overlay luce ambientale ══════════════════════════════
function drawAmbientOverlay(sky){
  if(sky.amb<0.9){
    const a=(0.9-sky.amb);
    ctx.fillStyle=`rgba(20,28,60,${a*0.5})`;
    ctx.fillRect(0,0,VW,VH);
  }
  // vignettatura
  const vg=ctx.createRadialGradient(VW/2,VH/2,VH*0.3,VW/2,VH/2,VH*0.8);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,VW,VH);
}

// ══ LOOP PRINCIPALE ═════════════════════════════════════════════
let lastT=performance.now();
function loop(now){
  const dt=Math.min(2,(now-lastT)/16.67); lastT=now;
  T.frame++;
  T.time += dt * 0.0016 * T.flow;
  if(T.time>=24) T.time-=24;

  // camera smoothing
  cam.x += (cam.tx-cam.x)*0.08;
  cam.y += (cam.ty-cam.y)*0.08;
  cam.zoom += (cam.tzoom-cam.zoom)*0.08;
  clampCam();

  const sky=skyColors(T.time);

  // --- render ---
  drawSky(sky);
  drawCelestial(sky);
  drawClouds(sky);
  drawHills(sky);
  drawGround(sky);

  // luoghi + alberi + avatar ordinati per y (profondità)
  const renderables=[];
  for(const pl of VILLAGE_PLACES) if(pl.id!=='tree') renderables.push({y:pl.y, fn:()=>drawPlace(pl,sky)});
  for(const t of trees) renderables.push({y:t.y, fn:()=>drawTree(t,sky)});

  // aggiorna + aggiungi avatar
  for(const a of ACTIVE){
    updateAvatar(a, dt);
    const av=a;
    renderables.push({y:a.y, fn:()=>drawAvatar(av,sky, av===hoverAvatar)});
  }
  renderables.sort((a,b)=>a.y-b.y);
  for(const r of renderables) r.fn();

  // atmosfera sopra
  drawLeaves(sky);
  drawSparks(sky);
  maybeSpawnBird();
  drawBirds(sky);

  drawAmbientOverlay(sky);

  updateHover();
  updateClockUI();

  requestAnimationFrame(loop);
}

// ══ AVVIO ═══════════════════════════════════════════════════════
function start(){
  seedTrees();
  initAvatars();
  buildPlacesBar();
  // nascondi loading
  setTimeout(()=>{
    document.getElementById('loading').classList.add('hidden');
  }, 700);
  requestAnimationFrame(loop);
}

// ricevi sessione dal parent (facoltativo)
window.addEventListener('message', e=>{
  if(e.data?.type==='SESSION_DATA' && e.data.session){
    // qui potremmo inserire l'avatar del giocatore — per ora NPC only
  }
});

start();
