/* ──────────────────────────────────────────────────────────────
   长明山谷 · Eternal Valley
   ────────────────────────────────────────────────────────────── */

// ───────── DOM ─────────
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx    = bgCanvas.getContext('2d');
const canvas   = document.getElementById('mainCanvas');
const ctx      = canvas.getContext('2d');
const cursor   = document.getElementById('cursor');
const navEl    = document.getElementById('nav');
const heroEl   = document.getElementById('hero');
const heroNarr = document.getElementById('heroNarrative');
const heroLines= heroNarr.querySelectorAll('.line');
const tipEl    = document.getElementById('tooltip');
const tipName  = document.getElementById('tipName');
const tipSub   = document.getElementById('tipSub');
const tipAction= document.getElementById('tipAction');
const hintEl   = document.getElementById('hint');
const audioBtn = document.getElementById('audioBtn');
const inputOv  = document.getElementById('inputOverlay');
const inputFld = document.getElementById('inputField');
const inputSub = document.getElementById('inputSubmit');
const inputCnl = document.getElementById('inputCancel');

let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

// ───────── TWEAKABLE PARAMS (driven by the Tweaks panel) ─────────
let valleyBright = 1.0;    // background brightness multiplier
let glowMult     = 1.0;    // horizon warm-glow intensity
let fireDistance = 0.85;   // 0 = near & crisp .. 1 = far, muffled campfire
let fireVolume   = 0.7;    // ignite (burning) sound volume
function adj(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * valleyBright));
  g = Math.min(255, Math.round(g * valleyBright));
  b = Math.min(255, Math.round(b * valleyBright));
  return `rgb(${r},${g},${b})`;
}
window.evSetBright   = v => { valleyBright = +v; if (W) drawBackground(); };
window.evSetGlow     = v => { glowMult = +v; if (W) drawBackground(); };
window.evSetFireDist = v => { fireDistance = +v; };
window.evSetFireVol  = v => { fireVolume = +v; };

// ───────── STATE ─────────
const mouse = { x: -9999, y: -9999, inside: false };
let hoverLantern = null;
let hintHidden = false;

// ───────── PRESET LANTERNS ─────────
const PRESET = [
  {
    name: '主权灯',
    dedication: '为从等待被理解中抽身的人',
    inscription: '我已经成为自己的引路灯',
  },
  {
    name: '慢光灯',
    dedication: '为不急着发光的人',
    inscription: '我会在我自己的时辰里亮起来',
  },
  {
    name: '同在灯',
    dedication: '为陪过别人黑夜的人',
    inscription: '我曾在场，那就够了',
  },
];

// ───────── AUDIO ─────────
let audioCtx = null;
let audioOn = true;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playIgnite() {
  if (!audioOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const dist = Math.max(0, Math.min(1, fireDistance));

  const master = audioCtx.createGain();
  master.gain.value = 0.9 * fireVolume * (1 - 0.45 * dist);
  // ── distance muffle: the farther away, the more highs roll off ──
  const muffle = audioCtx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 4400 - dist * 3550;   // far -> ~850 Hz, soft & woolly
  muffle.Q.value = 0.4;
  master.connect(muffle).connect(audioCtx.destination);

  // ── warm fire bed: low filtered noise, gently breathing (the roar) ──
  const bedDur = 2.4;
  const bedLen = Math.floor(audioCtx.sampleRate * bedDur);
  const bedBuf = audioCtx.createBuffer(1, bedLen, audioCtx.sampleRate);
  const bedData = bedBuf.getChannelData(0);
  for (let i = 0; i < bedLen; i++) {
    const wob = 0.5 + 0.5 * Math.sin(i / bedLen * Math.PI * 9 + Math.random() * 0.6);
    bedData[i] = (Math.random() * 2 - 1) * wob;
  }
  const bed = audioCtx.createBufferSource();
  bed.buffer = bedBuf;
  const bedFilt = audioCtx.createBiquadFilter();
  bedFilt.type = 'lowpass';
  bedFilt.frequency.setValueAtTime(360, t0);
  bedFilt.frequency.linearRampToValueAtTime(480, t0 + 0.5);
  const bedGain = audioCtx.createGain();
  // distant fire = the low roar carries more than the sharp pops
  const bedPeak = 0.06 + 0.05 * dist;
  bedGain.gain.setValueAtTime(0, t0);
  bedGain.gain.linearRampToValueAtTime(bedPeak, t0 + 0.3);
  bedGain.gain.linearRampToValueAtTime(bedPeak * 0.65, t0 + 1.4);
  bedGain.gain.exponentialRampToValueAtTime(0.001, t0 + bedDur);
  bed.connect(bedFilt).connect(bedGain).connect(master);
  bed.start(t0);
  bed.stop(t0 + bedDur);

  // ── crackle pops: softer & lower-pitched as distance grows ──
  const popCount = 24;
  for (let k = 0; k < popCount; k++) {
    const r = Math.random();
    const when = t0 + Math.pow(r, 1.7) * 2.0 + 0.02;
    const popDur = 0.012 + Math.random() * 0.05;
    const pLen = Math.max(2, Math.floor(audioCtx.sampleRate * popDur));
    const pBuf = audioCtx.createBuffer(1, pLen, audioCtx.sampleRate);
    const pData = pBuf.getChannelData(0);
    for (let i = 0; i < pLen; i++) {
      const env = Math.pow(1 - i / pLen, 2.2);   // sharp snap decay
      pData[i] = (Math.random() * 2 - 1) * env;
    }
    const pop = audioCtx.createBufferSource();
    pop.buffer = pBuf;
    const pFilt = audioCtx.createBiquadFilter();
    pFilt.type = 'bandpass';
    // crackle pitch + spread shrink with distance
    pFilt.frequency.value = 600 + Math.random() * (2300 * (1 - 0.62 * dist));
    pFilt.Q.value = 1.0 + Math.random() * 2.2;
    const pGain = audioCtx.createGain();
    const decayK = Math.max(0.35, 1 - (when - t0) / 2.2);
    pGain.gain.value = (0.05 + Math.random() * 0.11) * decayK * (1 - 0.5 * dist);
    pop.connect(pFilt).connect(pGain).connect(master);
    pop.start(when);
    pop.stop(when + popDur + 0.03);
  }
}
function playRelease() {
  if (!audioOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;

  // airy upward sweep — gentle 'letting go'
  const dur = 2.4;
  const bufLen = Math.floor(audioCtx.sampleRate * dur);
  const noiseBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(500, t0);
  filt.frequency.linearRampToValueAtTime(1600, t0 + dur);
  filt.Q.value = 2.5;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0, t0);
  nGain.gain.linearRampToValueAtTime(0.07, t0 + 0.6);
  nGain.gain.linearRampToValueAtTime(0.0, t0 + dur);
  noise.connect(filt).connect(nGain).connect(audioCtx.destination);
  noise.start(t0);
  noise.stop(t0 + dur);

  // gentle rising sine
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(380, t0);
  osc.frequency.exponentialRampToValueAtTime(820, t0 + dur);
  const oGain = audioCtx.createGain();
  oGain.gain.setValueAtTime(0, t0);
  oGain.gain.linearRampToValueAtTime(0.045, t0 + 0.4);
  oGain.gain.linearRampToValueAtTime(0.0, t0 + dur);
  osc.connect(oGain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

audioBtn.addEventListener('click', () => {
  audioOn = !audioOn;
  audioBtn.innerHTML = audioOn ? '♪ &nbsp;ON' : '♪ &nbsp;OFF';
  if (audioOn) ensureAudio();
});

// ───────── RESIZE ─────────
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  [bgCanvas, canvas].forEach(c => {
    c.width  = W * DPR;
    c.height = H * DPR;
    c.style.width  = W + 'px';
    c.style.height = H + 'px';
    c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  });
  initLanterns();
  drawBackground();
}

// ───────── BACKGROUND (drawn once per resize) ─────────
function drawBackground() {
  // INK-INDIGO sky with subtle warm horizon (brightened)
  const sky = bgCtx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.00, adj('#1a2146'));   // deep upper
  sky.addColorStop(0.35, adj('#242c58'));
  sky.addColorStop(0.65, adj('#2b3260'));
  sky.addColorStop(0.85, adj('#332e52'));   // warmer toward horizon
  sky.addColorStop(1.00, adj('#382c46'));
  bgCtx.fillStyle = sky;
  bgCtx.fillRect(0, 0, W, H);

  // distant warm horizon glow (the valley's far light)
  const glow = bgCtx.createRadialGradient(W*0.50, H*0.74, 0, W*0.50, H*0.74, W*0.58);
  glow.addColorStop(0.00, `rgba(230,165,75,${0.17 * glowMult})`);
  glow.addColorStop(0.35, `rgba(195,125,50,${0.10 * glowMult})`);
  glow.addColorStop(0.75, `rgba(110,80,35,${0.035 * glowMult})`);
  glow.addColorStop(1.00, 'transparent');
  bgCtx.fillStyle = glow;
  bgCtx.fillRect(0, 0, W, H);

  // a soft cool wash in the upper half (atmospheric)
  const cool = bgCtx.createLinearGradient(0, 0, 0, H*0.6);
  cool.addColorStop(0, 'rgba(95,120,180,0.06)');
  cool.addColorStop(1, 'transparent');
  bgCtx.fillStyle = cool;
  bgCtx.fillRect(0, 0, W, H*0.6);

  // ── FAR MOUNTAINS (deepest in valley, narrow opening) ──
  // valley vanishing point ~ center
  bgCtx.fillStyle = adj('#1e2548');
  bgCtx.beginPath();
  bgCtx.moveTo(0, H);
  const far = [
    [0,        H*0.62],
    [W*0.18,   H*0.55],
    [W*0.28,   H*0.60],
    [W*0.38,   H*0.65],
    [W*0.46,   H*0.69],
    [W*0.50,   H*0.72],   // valley floor / vanishing
    [W*0.54,   H*0.69],
    [W*0.62,   H*0.65],
    [W*0.72,   H*0.60],
    [W*0.82,   H*0.56],
    [W,        H*0.62],
    [W,        H],
  ];
  far.forEach(([x,y]) => bgCtx.lineTo(x, y));
  bgCtx.closePath();
  bgCtx.fill();

  // ── MID MOUNTAINS (forming the V of the valley) ──
  bgCtx.fillStyle = adj('#181d3c');
  bgCtx.beginPath();
  bgCtx.moveTo(0, H);
  const mid = [
    [0,        H*0.55],
    [W*0.08,   H*0.50],
    [W*0.16,   H*0.58],
    [W*0.24,   H*0.62],
    [W*0.34,   H*0.70],
    [W*0.42,   H*0.76],
    [W*0.50,   H*0.80],   // deep valley
    [W*0.58,   H*0.76],
    [W*0.66,   H*0.70],
    [W*0.76,   H*0.62],
    [W*0.84,   H*0.58],
    [W*0.92,   H*0.50],
    [W,        H*0.55],
    [W,        H],
  ];
  mid.forEach(([x,y]) => bgCtx.lineTo(x, y));
  bgCtx.closePath();
  bgCtx.fill();

  // ── COOL MIST band (between far and mid layers - the deep) ──
  const coolMist = bgCtx.createLinearGradient(0, H*0.55, 0, H*0.85);
  coolMist.addColorStop(0,   'rgba(110,130,180,0.00)');
  coolMist.addColorStop(0.5, 'rgba(95,115,170,0.16)');
  coolMist.addColorStop(1,   'rgba(60,75,120,0.06)');
  bgCtx.fillStyle = coolMist;
  bgCtx.fillRect(0, H*0.55, W, H*0.32);

  // ── NEAR mountains / valley walls (closer to camera) ──
  bgCtx.fillStyle = adj('#10142e');
  bgCtx.beginPath();
  bgCtx.moveTo(0, H);
  const near = [
    [0,        H*0.48],
    [W*0.06,   H*0.45],
    [W*0.12,   H*0.58],
    [W*0.16,   H*0.74],
    [W*0.21,   H*0.86],
    [W*0.27,   H*0.91],
    [W*0.35,   H*0.89],
    [W*0.43,   H*0.93],
    [W*0.50,   H*0.92],
    [W*0.57,   H*0.94],
    [W*0.65,   H*0.90],
    [W*0.73,   H*0.91],
    [W*0.79,   H*0.84],
    [W*0.84,   H*0.73],
    [W*0.88,   H*0.58],
    [W*0.94,   H*0.45],
    [W,        H*0.48],
    [W,        H],
  ];
  near.forEach(([x,y]) => bgCtx.lineTo(x, y));
  bgCtx.closePath();
  bgCtx.fill();

  // ── FOREGROUND CLIFFS (very close, very dark — frame the valley) ──
  bgCtx.fillStyle = adj('#0a0c20');
  // LEFT cliff
  bgCtx.beginPath();
  bgCtx.moveTo(0, H);
  bgCtx.lineTo(0, H*0.15);
  bgCtx.lineTo(W*0.04, H*0.20);
  bgCtx.lineTo(W*0.08, H*0.35);
  bgCtx.lineTo(W*0.12, H*0.30);
  bgCtx.lineTo(W*0.14, H*0.50);
  bgCtx.lineTo(W*0.18, H*0.65);
  bgCtx.lineTo(W*0.16, H*0.82);
  bgCtx.lineTo(W*0.20, H);
  bgCtx.closePath();
  bgCtx.fill();
  // RIGHT cliff
  bgCtx.beginPath();
  bgCtx.moveTo(W, H);
  bgCtx.lineTo(W, H*0.15);
  bgCtx.lineTo(W*0.96, H*0.22);
  bgCtx.lineTo(W*0.92, H*0.32);
  bgCtx.lineTo(W*0.88, H*0.30);
  bgCtx.lineTo(W*0.86, H*0.50);
  bgCtx.lineTo(W*0.82, H*0.65);
  bgCtx.lineTo(W*0.84, H*0.82);
  bgCtx.lineTo(W*0.80, H);
  bgCtx.closePath();
  bgCtx.fill();

  // ── valley floor mist (cool→warm gradient) ──
  const floorMist = bgCtx.createLinearGradient(0, H*0.78, 0, H);
  floorMist.addColorStop(0,   'rgba(110,130,180,0.00)');
  floorMist.addColorStop(0.4, 'rgba(80,95,140,0.15)');
  floorMist.addColorStop(0.8, 'rgba(50,55,90,0.30)');
  floorMist.addColorStop(1,   'rgba(20,22,40,0.55)');
  bgCtx.fillStyle = floorMist;
  bgCtx.fillRect(0, H*0.78, W, H*0.22);

  // a touch of warm haze at the very horizon dip
  const warmHaze = bgCtx.createRadialGradient(W*0.50, H*0.80, 0, W*0.50, H*0.80, W*0.30);
  warmHaze.addColorStop(0,   `rgba(232,172,90,${0.12 * glowMult})`);
  warmHaze.addColorStop(0.6, `rgba(195,122,58,${0.045 * glowMult})`);
  warmHaze.addColorStop(1,   'transparent');
  bgCtx.fillStyle = warmHaze;
  bgCtx.fillRect(0, H*0.65, W, H*0.30);
}

// ───────── STARS ─────────
let stars = [];
function makeStars() {
  stars = [];
  for (let i = 0; i < 240; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.70,
      r: Math.random() * 1.1 + 0.2,
      op: Math.random() * 0.55 + 0.12,
      sp: Math.random() * 0.4 + 0.1,
      ph: Math.random() * Math.PI * 2,
      warm: Math.random() > 0.7,
    });
  }
}
function drawStars(t) {
  stars.forEach(s => {
    const fl = 0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.warm
      ? `rgba(220,185,110,${s.op * fl})`
      : `rgba(200,200,180,${s.op * fl})`;
    ctx.fill();
  });
}

// ───────── DEEP-VALLEY AMBIENT LIGHTS (persistent across visits) ─────────
let ambient = [];
function loadAmbient() {
  try {
    const saved = JSON.parse(localStorage.getItem('ev_ambient') || 'null');
    if (saved && Array.isArray(saved) && saved.length) {
      ambient = saved.map(a => ({ ...a, ph: Math.random()*Math.PI*2 }));
      return;
    }
  } catch (e) {}
  // seed with random ones (positioned deep in valley near horizon)
  ambient = [];
  for (let i = 0; i < 7; i++) {
    ambient.push({
      // normalized coords stored
      nx: 0.30 + Math.random() * 0.40,
      ny: 0.68 + Math.random() * 0.10,
      size: 0.6 + Math.random() * 1.2,
      warm: 0.7 + Math.random() * 0.3,
      ph: Math.random() * Math.PI * 2,
      text: null,
    });
  }
  saveAmbient();
}
function saveAmbient() {
  try {
    localStorage.setItem('ev_ambient', JSON.stringify(ambient.map(a => ({
      nx: a.nx, ny: a.ny, size: a.size, warm: a.warm, text: a.text,
    }))));
  } catch (e) {}
}
function drawAmbient(t) {
  ambient.forEach(a => {
    const x = a.nx * W;
    const y = a.ny * H;
    const fl = 0.7 + 0.3 * Math.sin(t * 0.0008 + a.ph);
    // glow
    const r = 18 * a.size;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0,   `rgba(255,180,80,${0.35 * fl * a.warm})`);
    grd.addColorStop(0.5, `rgba(220,120,40,${0.15 * fl * a.warm})`);
    grd.addColorStop(1,   'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // core
    ctx.beginPath();
    ctx.arc(x, y, 1.4 * a.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,225,150,${0.85 * fl})`;
    ctx.fill();
  });
}

// ───────── LANTERNS ─────────
let lanterns = [];
function initLanterns() {
  // 3 preset (named) + 1 empty (custom) + several plain (light-for-fun)
  // positions inside valley opening (avoid 0-18% left and 82-100% right)
  const slots = [
    { x: 0.26, y: 0.46, depth: 0.80, type: 'preset', p: 0 },
    { x: 0.45, y: 0.55, depth: 0.96, type: 'preset', p: 1 },
    { x: 0.63, y: 0.45, depth: 0.86, type: 'preset', p: 2 },
    { x: 0.78, y: 0.53, depth: 0.78, type: 'empty' },
    // plain lanterns — deeper / smaller, scattered, light for fun
    { x: 0.34, y: 0.62, depth: 0.55, type: 'plain' },
    { x: 0.55, y: 0.64, depth: 0.50, type: 'plain' },
    { x: 0.69, y: 0.60, depth: 0.58, type: 'plain' },
    { x: 0.40, y: 0.40, depth: 0.66, type: 'plain' },
    { x: 0.58, y: 0.37, depth: 0.62, type: 'plain' },
    { x: 0.71, y: 0.68, depth: 0.46, type: 'plain' },
  ];
  lanterns = slots.map((s, i) => makeLantern(s, i));
}
function makeLantern(slot, idx) {
  const type = slot.type || 'plain';
  const isEmpty = type === 'empty';
  const isPlain = type === 'plain';
  const preset = type === 'preset' ? PRESET[slot.p] : null;
  return {
    slot,
    slotIdx: idx,
    isEmpty,
    isPlain,
    name:        preset ? preset.name        : (isEmpty ? '空灯' : ''),
    dedication:  preset ? preset.dedication  : (isEmpty ? '写下你想说的' : ''),
    inscription: preset ? preset.inscription : '',
    baseX: slot.x * W,
    baseY: slot.y * H,
    x: slot.x * W,
    y: slot.y * H,
    depth: slot.depth,
    scale: 0.55 + slot.depth * 0.50,
    stringLen: 60 + (1 - slot.depth) * 120,
    swayPhase: Math.random() * Math.PI * 2,
    swayAmp: 2.5 + Math.random() * 3.5,
    swaySpeed: 0.25 + Math.random() * 0.25,
    flickerPhase: Math.random() * Math.PI * 2,

    lit: false,
    litTime: 0,
    hover: false,
    hoverFrames: 0,
    lastHoverTime: 0,

    drifting: false,   // moving to background
    driftStart: 0,
    driftFromX: 0, driftFromY: 0,
    driftToX: 0,   driftToY: 0,

    releasing: false,  // ascending
    releaseStart: 0,
    releaseVy: 0,
    releaseVx: 0,

    inscriptionFlash: 0,  // 0..1 fades after lighting
  };
}

// hit test in screen coords
function hitTest(l, mx, my) {
  if (l.drifting || l.releasing) return false;
  const w = 30 * l.scale * 1.5;
  const h = 44 * l.scale * 1.6;
  return Math.abs(mx - l.x) < w/2 && Math.abs(my - l.y) < h/2;
}

// draw a single lantern
function drawLantern(l, t) {
  const sway = Math.sin(t * 0.001 * l.swaySpeed + l.swayPhase) * l.swayAmp * l.scale;
  const cx = l.x + sway;
  const cy = l.y;
  const w  = 30 * l.scale;
  const h  = 42 * l.scale;

  const flicker = l.lit
    ? 0.78 + 0.22 * (Math.sin(t * 0.009 + l.flickerPhase) * Math.sin(t * 0.014 + l.flickerPhase * 1.7))
    : 0;

  ctx.save();

  // global depth-based opacity
  let alpha = 0.7 + l.depth * 0.3;
  if (l.releasing) {
    const e = (t - l.releaseStart) / 1000;
    alpha *= Math.max(0, 1 - e / 5);
  }
  if (l.drifting) {
    // drifting fades and shrinks slightly already via scale anim
    alpha *= 0.55 + 0.45 * (1 - getDriftT(l, t));
  }
  ctx.globalAlpha = alpha;

  // warm glow (when lit)
  if (l.lit) {
    const gr = (90 + 60 * flicker) * l.scale;
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    gg.addColorStop(0,   `rgba(255,190,70,${0.30 * flicker})`);
    gg.addColorStop(0.35,`rgba(230,130,40,${0.16 * flicker})`);
    gg.addColorStop(1,   'transparent');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // hover halo (unlit, only when hovered)
  if (l.hover && !l.lit) {
    const hr = 55 * l.scale;
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr);
    hg.addColorStop(0,   'rgba(220,180,100,0.16)');
    hg.addColorStop(0.6, 'rgba(180,140,70,0.06)');
    hg.addColorStop(1,   'transparent');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fill();
  }

  // body path helper
  function bodyPath(ww, hh) {
    const r = ww * 0.30;
    ctx.beginPath();
    ctx.moveTo(-ww/2 + r, -hh/2);
    ctx.lineTo(ww/2 - r,  -hh/2);
    ctx.quadraticCurveTo(ww/2, -hh/2, ww/2, -hh/2 + r);
    ctx.lineTo(ww/2, hh/2 - r);
    ctx.quadraticCurveTo(ww/2, hh/2, ww/2 - r, hh/2);
    ctx.lineTo(-ww/2 + r, hh/2);
    ctx.quadraticCurveTo(-ww/2, hh/2, -ww/2, hh/2 - r);
    ctx.lineTo(-ww/2, -hh/2 + r);
    ctx.quadraticCurveTo(-ww/2, -hh/2, -ww/2 + r, -hh/2);
    ctx.closePath();
  }

  ctx.save();
  ctx.translate(cx, cy);

  // lantern body
  if (l.lit) {
    const fl = flicker;
    bodyPath(w, h);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    grad.addColorStop(0,   `rgba(255,210,100,${0.95 * fl})`);
    grad.addColorStop(0.55,`rgba(230,140,40, ${0.78 * fl})`);
    grad.addColorStop(1,   `rgba(160,70,15,  ${0.55 * fl})`);
    ctx.fillStyle = grad;
    ctx.fill();

    // inner core
    ctx.save();
    ctx.globalAlpha = 0.55 * fl;
    bodyPath(w * 0.6, h * 0.6);
    ctx.fillStyle = `rgba(255,240,180,0.7)`;
    ctx.fill();
    ctx.restore();
  } else {
    bodyPath(w, h);
    if (l.isEmpty) {
      // empty lantern: subtly different - dashed feel
      ctx.fillStyle = l.hover ? 'rgba(70,60,45,0.45)' : 'rgba(45,42,38,0.35)';
      ctx.fill();
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = l.hover ? 'rgba(212,168,75,0.55)' : 'rgba(140,120,80,0.35)';
      ctx.lineWidth = 0.9 * l.scale;
      bodyPath(w, h);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = l.hover ? 'rgba(80,65,45,0.65)' : 'rgba(58,48,32,0.55)';
      ctx.fill();
      bodyPath(w, h);
      ctx.strokeStyle = l.hover ? 'rgba(180,140,75,0.55)' : 'rgba(110,90,55,0.38)';
      ctx.lineWidth = 0.8 * l.scale;
      ctx.stroke();
    }
  }

  // ribs
  ctx.strokeStyle = l.lit
    ? `rgba(180,90,15,${0.42 * flicker})`
    : 'rgba(85,70,40,0.32)';
  ctx.lineWidth = 0.7 * l.scale;
  ctx.beginPath();
  ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
  ctx.moveTo(0, -h/2); ctx.lineTo(0, h/2);
  ctx.stroke();

  // caps
  const capH = 7 * l.scale;
  const capW = w * 0.55;
  ctx.fillStyle = l.lit
    ? `rgba(170,85,15,${0.92 * flicker})`
    : 'rgba(55,45,28,0.75)';
  ctx.beginPath();
  ctx.rect(-capW/2, -h/2 - 1, capW, capH);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-capW/2, h/2 - capH + 1, capW, capH);
  ctx.fill();

  // top knob
  ctx.beginPath();
  ctx.arc(0, -h/2 - capH * 0.6, 1.6 * l.scale, 0, Math.PI * 2);
  ctx.fillStyle = l.lit ? `rgba(200,120,40,${0.9 * flicker})` : 'rgba(70,55,32,0.7)';
  ctx.fill();

  // tassel (bottom)
  ctx.strokeStyle = l.lit ? `rgba(200,140,60,${0.6 * flicker})` : 'rgba(80,65,40,0.4)';
  ctx.lineWidth = 0.7 * l.scale;
  ctx.beginPath();
  ctx.moveTo(0, h/2 + capH * 0.5);
  ctx.lineTo(0, h/2 + capH * 1.6);
  ctx.stroke();

  // flame inside
  if (l.lit) {
    const fh = 11 * l.scale * flicker;
    ctx.save();
    ctx.globalAlpha = 0.75 * flicker;
    ctx.fillStyle = `rgba(255,235,120,${flicker})`;
    ctx.beginPath();
    ctx.moveTo(0, capH - h/2 + 4);
    ctx.bezierCurveTo(4*l.scale, capH - h/2 - fh*0.3, 6*l.scale, capH - h/2 - fh*0.7, 0, capH - h/2 - fh);
    ctx.bezierCurveTo(-6*l.scale, capH - h/2 - fh*0.7, -4*l.scale, capH - h/2 - fh*0.3, 0, capH - h/2 + 4);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // translate

  // string from top cap up to anchor (offscreen above)
  if (!l.releasing) {
    const topX = cx;
    const topY = cy - h/2 - capH * 0.5;
    const ancX = l.baseX;
    const ancY = cy - h/2 - l.stringLen * l.scale;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo((topX + ancX) / 2, (topY + ancY) / 2 + 4, ancX, ancY);
    ctx.strokeStyle = l.lit
      ? `rgba(180,135,65,${0.30 * l.depth})`
      : `rgba(90,75,50,${0.28 * l.depth})`;
    ctx.lineWidth = 0.7 * l.scale;
    ctx.stroke();
  }

  ctx.restore();

  // record screen pos for tooltip
  l._screenX = cx;
  l._screenY = cy;
}

// drift progress 0..1 (over 18s)
function getDriftT(l, t) {
  if (!l.drifting) return 0;
  return Math.min(1, (t - l.driftStart) / 18000);
}

// ───────── WARM MIST around lit lanterns ─────────
function drawWarmMist(t) {
  // global warm low-mist that responds to lit lanterns
  const lit = lanterns.filter(l => l.lit && !l.releasing);
  if (!lit.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  lit.forEach(l => {
    const fl = 0.7 + 0.3 * Math.sin(t * 0.0007 + l.flickerPhase);
    const r = 220 * l.scale;
    const cx = l._screenX || l.x;
    const cy = (l._screenY || l.y) + 30 * l.scale;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0,   `rgba(230,150,70,${0.045 * fl})`);
    grd.addColorStop(0.4, `rgba(200,120,50,${0.025 * fl})`);
    grd.addColorStop(1,   'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ───────── SLOW DRIFTING COOL MIST (subtle motion) ─────────
function drawCoolMist(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const wave = Math.sin(t * 0.00012) * 8;
  // distant mist band
  const grd = ctx.createLinearGradient(0, H*0.55, 0, H*0.82);
  grd.addColorStop(0,   'rgba(110,130,180,0.00)');
  grd.addColorStop(0.5, `rgba(100,120,170,${0.04 + 0.015 * Math.sin(t*0.00018)})`);
  grd.addColorStop(1,   'rgba(70,85,130,0.01)');
  ctx.fillStyle = grd;
  ctx.fillRect(-20, H*0.55 + wave*0.2, W+40, H*0.30);
  ctx.restore();
}

// ───────── PARTICLES ─────────
const particles = [];
function spawnIgniteParticles(x, y, scale) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.4 + Math.random() * 2.4;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1.2,
      life: 1,
      decay: 0.018 + Math.random() * 0.025,
      r: (1.3 + Math.random() * 2.8) * scale,
      warm: Math.random() > 0.3,
    });
  }
}
function spawnTrailParticle(x, y, scale) {
  if (Math.random() > 0.4) return;
  particles.push({
    x: x + (Math.random() - 0.5) * 8 * scale,
    y: y + (Math.random() - 0.5) * 4 * scale,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -(0.15 + Math.random() * 0.4),
    life: 0.85,
    decay: 0.012 + Math.random() * 0.012,
    r: (1 + Math.random() * 1.8) * scale,
    warm: true,
  });
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.025;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life) * 0.85;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * Math.max(0.2, p.life), 0, Math.PI * 2);
    ctx.fillStyle = p.warm
      ? `rgba(255,${160 + Math.floor(p.life * 60)},60,${p.life})`
      : `rgba(255,235,160,${p.life})`;
    ctx.fill();
    ctx.restore();
  });
}

// ───────── LANTERN STATE TRANSITIONS ─────────
function igniteLantern(l, t, customText) {
  if (l.lit) return;
  if (customText !== undefined) {
    l.inscription = customText;
  }
  l.lit = true;
  l.litTime = t;
  l.inscriptionFlash = 1;
  spawnIgniteParticles(l.x, l.y, l.scale);
  playIgnite();
  if (!hintHidden) {
    hintEl.classList.add('fadeout');
    setTimeout(() => hintEl.classList.remove('show', 'fadeout'), 1800);
    hintHidden = true;
  }
}

function releaseLantern(l, t) {
  if (l.releasing || l.drifting) return;
  l.releasing = true;
  l.releaseStart = t;
  l.releaseVy = -0.6 - Math.random() * 0.3;
  l.releaseVx = (Math.random() - 0.5) * 0.4;
  playRelease();
}

function startDrift(l, t) {
  if (l.drifting || l.releasing) return;
  l.drifting = true;
  l.driftStart = t;
  l.driftFromX = l.x;
  l.driftFromY = l.y;
  // target: deep valley, near horizon, with some scatter
  l.driftToX = (0.30 + Math.random() * 0.40) * W;
  l.driftToY = (0.68 + Math.random() * 0.10) * H;
}

function commitToAmbient(l) {
  // when drift finishes, save as ambient point
  ambient.push({
    nx: l.driftToX / W,
    ny: l.driftToY / H,
    size: 0.6 + Math.random() * 0.8,
    warm: 0.85 + Math.random() * 0.15,
    ph: Math.random() * Math.PI * 2,
    text: l.inscription || null,
  });
  if (ambient.length > 60) ambient.shift();
  saveAmbient();
}

function respawnLantern(l) {
  // reset to fresh unlit
  const slot = l.slot;
  const idx = l.slotIdx;
  const fresh = makeLantern(slot, idx);
  Object.assign(l, fresh);
}

// ───────── MAIN LOOP ─────────
let lastT = 0;
function loop(t) {
  ctx.clearRect(0, 0, W, H);

  drawStars(t);
  drawAmbient(t);
  drawCoolMist(t);

  // update lantern positions for drift / release
  lanterns.forEach(l => {
    if (l.drifting) {
      const k = getDriftT(l, t);
      // ease-in-out
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      l.x = l.driftFromX + (l.driftToX - l.driftFromX) * e;
      l.y = l.driftFromY + (l.driftToY - l.driftFromY) * e;
      l.scale = (0.55 + l.depth * 0.50) * (1 - e * 0.75);
      if (k >= 1) {
        commitToAmbient(l);
        respawnLantern(l);
      }
    } else if (l.releasing) {
      const e = (t - l.releaseStart) / 1000;
      l.releaseVy -= 0.012;
      l.y += l.releaseVy;
      l.x += l.releaseVx + Math.sin(t * 0.001 + l.flickerPhase) * 0.4;
      spawnTrailParticle(l.x, l.y + 18 * l.scale, l.scale);
      if (e > 5.5 || l.y < -50) {
        respawnLantern(l);
      }
    }

    // auto-drift trigger: lit, not hovered, idle for 16s
    if (l.lit && !l.drifting && !l.releasing && !l.hover) {
      const elapsed = t - Math.max(l.litTime, l.lastHoverTime);
      if (elapsed > 16000) startDrift(l, t);
    }
  });

  // draw warm mist behind lanterns
  drawWarmMist(t);

  // draw lanterns
  lanterns.forEach(l => drawLantern(l, t));

  updateParticles();
  drawParticles();

  lastT = t;
  requestAnimationFrame(loop);
}

// ───────── HOVER / TOOLTIP ─────────
function updateTooltip(t) {
  const h = hoverLantern;
  if (!h || h.drifting || h.releasing) {
    tipEl.classList.remove('show');
    return;
  }

  // anchor below the lantern
  const x = h._screenX || h.x;
  const y = (h._screenY || h.y) + 36 * h.scale;
  tipEl.style.left = x + 'px';
  tipEl.style.top  = y + 'px';

  if (h.lit) {
    tipName.textContent = h.name || '';
    tipSub.textContent  = h.inscription || '';
    tipAction.textContent = '· 再触一次 · 让它升空 ·';
  } else if (h.isEmpty) {
    tipName.textContent = '空灯';
    tipSub.textContent  = '写下你想说的';
    tipAction.textContent = '· 轻触以书写 ·';
  } else if (h.isPlain) {
    tipName.textContent = '';
    tipSub.textContent  = '';
    tipAction.textContent = '· 轻触以点燃 ·';
  } else {
    tipName.textContent = h.name;
    tipSub.textContent  = h.dedication;
    tipAction.textContent = '· 轻触以点燃 ·';
  }
  tipEl.classList.add('show');
}

// ───────── INTERACTION ─────────
function getPos(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function onMove(e) {
  const { x, y } = getPos(e);
  mouse.x = x; mouse.y = y; mouse.inside = true;
  cursor.style.left = x + 'px';
  cursor.style.top  = y + 'px';
  // update hovers
  let found = null;
  for (let i = lanterns.length - 1; i >= 0; i--) {
    const l = lanterns[i];
    l.hover = hitTest(l, x, y);
    if (l.hover) found = l;
  }
  if (found && found !== hoverLantern) {
    found.lastHoverTime = performance.now();
  }
  hoverLantern = found;
  updateTooltip(performance.now());
}

function onClick(e) {
  ensureAudio();
  const { x, y } = getPos(e);
  // hero fades out on first interaction
  hideHero();

  for (let i = lanterns.length - 1; i >= 0; i--) {
    const l = lanterns[i];
    if (!hitTest(l, x, y)) continue;
    if (l.isEmpty && !l.lit) {
      openInput(l);
      return;
    }
    if (!l.lit) {
      igniteLantern(l, performance.now());
      return;
    } else if (!l.releasing && !l.drifting) {
      releaseLantern(l, performance.now());
      return;
    }
  }
}

window.addEventListener('mousemove', onMove);
window.addEventListener('mousedown', onClick);
window.addEventListener('mouseleave', () => { mouse.inside = false; });
window.addEventListener('touchstart', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  e.preventDefault();
  onMove(e);
  onClick(e);
}, { passive: false });

// ───────── INPUT PANEL ─────────
let activeEmpty = null;
function openInput(l) {
  activeEmpty = l;
  inputFld.value = '';
  inputOv.classList.add('open');
  setTimeout(() => inputFld.focus(), 200);
  // hide custom cursor over modal — bring back default
  document.body.style.cursor = 'auto';
  inputFld.style.cursor = 'text';
  inputSub.style.cursor = 'pointer';
  inputCnl.style.cursor = 'pointer';
  cursor.style.display = 'none';
}
function closeInput() {
  inputOv.classList.remove('open');
  activeEmpty = null;
  document.body.style.cursor = 'none';
  cursor.style.display = '';
}
inputCnl.addEventListener('click', closeInput);
inputSub.addEventListener('click', submitInput);
inputFld.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitInput();
  } else if (e.key === 'Escape') {
    closeInput();
  }
});
inputOv.addEventListener('click', e => {
  if (e.target === inputOv) closeInput();
});
function submitInput() {
  const txt = inputFld.value.trim();
  if (!txt || !activeEmpty) { closeInput(); return; }
  const l = activeEmpty;
  closeInput();
  setTimeout(() => {
    igniteLantern(l, performance.now(), txt);
  }, 200);
}

// ───────── HERO SEQUENCE ─────────
let heroHidden = false;
function hideHero() {
  if (heroHidden) return;
  heroHidden = true;
  heroNarr.classList.add('fadeout');
  setTimeout(() => { heroEl.style.display = 'none'; }, 2200);
  if (!hintHidden) hintEl.classList.add('show');
}
function runHero() {
  heroLines.forEach((line, i) => {
    setTimeout(() => line.classList.add('show'), 1600 + i * 1700);
  });
  // auto fade after full sequence + read time
  setTimeout(() => hideHero(), 14000);
}

// ───────── INIT ─────────
function init() {
  loadAmbient();
  resize();
  makeStars();
  window.addEventListener('resize', () => {
    resize();
    makeStars();
  });
  runHero();
  requestAnimationFrame(loop);
}
init();
