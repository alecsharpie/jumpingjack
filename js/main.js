import { createPoseDetector } from './pose.js';
import { Body, drawSkeleton } from './body.js';
import { Sfx } from './audio.js';
import { FX, text, FONT_BODY, clamp } from './fx.js';
import { CalibrateScene, MenuScene, ResultsScene } from './scenes.js';
import { GAMES } from './games/index.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const video = document.getElementById('cam');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const camSel = document.getElementById('camera');
const fsCheck = document.getElementById('fs');
const statusEl = document.getElementById('status');

// Shared game context passed to every scene.
const G = {
  ctx, canvas, video,
  W: innerWidth, H: innerHeight, dpr: 1, t: 0,
  body: new Body(), audio: new Sfx(), fx: new FX(),
  games: GAMES,
  mirror: params.get('mirror') !== '0',
  showSkeleton: params.has('skeleton'),
  debug: params.has('debug'),
  camDim: 0,
  camRect: { x: 0, y: 0, w: 1, h: 1 },
  scene: null, detector: null, stream: null, cameras: [],
  toast: null, fps: 0, detMs: 0,
};
if (G.debug) window.__G = G;

G.go = (name, args) => {
  G.scene?.exit?.();
  G.fx.clear();
  let s;
  if (name === 'calibrate') s = new CalibrateScene(G);
  else if (name === 'menu') s = new MenuScene(G);
  else if (name === 'results') s = new ResultsScene(G, args);
  else s = GAMES.find((g) => g.id === name).make(G);
  G.scene = s;
  s.enter?.();
};

G.toScreen = (lm) => ({
  x: G.camRect.x + (G.mirror ? 1 - lm.x : lm.x) * G.camRect.w,
  y: G.camRect.y + lm.y * G.camRect.h,
});

G.showToast = (msg) => { G.toast = { msg, t: 2.2 }; };
G.best = (id) => { try { return +localStorage.getItem('jj.best.' + id) || 0; } catch { return 0; } };
G.saveBest = (id, v) => { try { localStorage.setItem('jj.best.' + id, String(v)); } catch { /* storage unavailable */ } };

function resize() {
  G.dpr = Math.min(devicePixelRatio || 1, 2);
  G.W = innerWidth;
  G.H = innerHeight;
  canvas.width = Math.round(G.W * G.dpr);
  canvas.height = Math.round(G.H * G.dpr);
}
addEventListener('resize', resize);
resize();

// The camera fills the screen ("cover"), so landmarks map through the same rectangle.
function updateCamRect() {
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const s = Math.max(G.W / vw, G.H / vh);
  const w = vw * s, h = vh * s;
  G.camRect = { x: (G.W - w) / 2, y: (G.H - h) / 2, w, h };
}

function drawCamera() {
  if (video.readyState >= 2) {
    const r = G.camRect;
    ctx.save();
    if (G.mirror) { ctx.translate(G.W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, r.x, r.y, r.w, r.h);
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#1b1b3a');
    g.addColorStop(1, '#0b0b1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
  }
  if (G.camDim > 0) {
    ctx.fillStyle = `rgba(5,5,20,${G.camDim})`;
    ctx.fillRect(0, 0, G.W, G.H);
  }
  // Soft vignette, like an old TV
  const v = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.45, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, G.W, G.H);
}

function drawCursors() {
  for (const n of ['lhand', 'rhand', 'mouse', 'lfoot', 'rfoot']) {
    const p = G.body.parts[n];
    if (!p.visible) continue;
    const hand = n !== 'lfoot' && n !== 'rfoot';
    const color = n === 'mouse' ? '#ffffff' : hand ? '#ffcc00' : '#00d2ff';
    // Motion trail
    if (p.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      for (let i = 1; i < p.trail.length; i++) {
        ctx.globalAlpha = (i / p.trail.length) * 0.35;
        ctx.lineWidth = p.r * (i / p.trail.length) * 0.9;
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = hand ? 0.9 : 0.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
    ctx.lineWidth = hand ? 6 : 4;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

let lastVideoTime = -1;
let lostFor = 0;
function detect(now) {
  if (!G.detector || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const t0 = performance.now();
  try {
    const res = G.detector.detectForVideo(video, now);
    G.body.update(res.landmarks?.[0], G, now / 1000);
  } catch (err) {
    console.error(err);
  }
  G.detMs = G.detMs * 0.9 + (performance.now() - t0) * 0.1;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.t += dt;
  G.fps = G.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;

  updateCamRect();
  detect(now);
  G.body.tick(now / 1000);

  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.clearRect(0, 0, G.W, G.H);
  ctx.save();
  G.fx.applyShake(ctx);
  drawCamera();
  if (G.scene) {
    G.scene.update(dt);
    G.scene.draw(ctx);
  }
  if (G.showSkeleton) drawSkeleton(ctx, G.body, { alpha: 0.6 });
  if (G.scene) drawCursors();
  G.fx.update(dt);
  G.fx.draw(ctx, G.W, G.H);
  ctx.restore();

  // "Can't see you" banner while the player has left the frame
  lostFor = G.body.present || G.body.parts.mouse.visible || !G.scene ? 0 : lostFor + dt;
  if (lostFor > 1.2 && !(G.scene instanceof CalibrateScene)) {
    const s = clamp(G.W * 0.02, 16, 38), y = G.H * 0.76;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(G.W / 2 - s * 14, y - s * 1.1, s * 28, s * 2.2, s);
    ctx.fill();
    text(ctx, "👀 Can't see you. Step in front of the camera", G.W / 2, y, { size: s, font: FONT_BODY, maxWidth: s * 26 });
  }
  if (G.toast) {
    G.toast.t -= dt;
    text(ctx, G.toast.msg, G.W / 2, G.H - 40, { size: 26, font: FONT_BODY, alpha: Math.min(1, G.toast.t) });
    if (G.toast.t <= 0) G.toast = null;
  }
  if (G.debug) {
    text(ctx, `${G.fps.toFixed(0)} fps · pose ${G.detMs.toFixed(1)} ms · ${video.videoWidth}×${video.videoHeight}`, 12, G.H - 16,
      { size: 16, font: FONT_BODY, align: 'left', lw: 3 });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- startup ---
function setStatus(msg, err = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('err', err);
}

const detectorReady = createPoseDetector(params.get('model') || 'full')
  .then((d) => { G.detector = d; setStatus('Ready! Press PLAY.'); })
  .catch((err) => { console.error(err); setStatus(`Couldn't load the pose model (${err.message}). Check your connection and reload.`, true); });

async function startCamera(deviceId) {
  G.stream?.getTracks().forEach((t) => t.stop());
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      facingMode: deviceId ? undefined : 'user',
      width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
    },
  });
  G.stream = stream;
  video.srcObject = stream;
  await video.play();
  await listCameras();
}

async function listCameras() {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  G.cameras = devices;
  const current = G.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  camSel.replaceChildren(...devices.map((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || `Camera ${i + 1}`;
    o.selected = d.deviceId === current;
    return o;
  }));
  if (!devices.length) camSel.replaceChildren(new Option('Default camera', ''));
}

async function cycleCamera() {
  if (G.cameras.length < 2) { G.showToast('Only one camera found'); return; }
  const current = G.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  const i = G.cameras.findIndex((c) => c.deviceId === current);
  const next = G.cameras[(i + 1) % G.cameras.length];
  try {
    await startCamera(next.deviceId);
    G.showToast(`📷 ${next.label || 'Camera'}`);
  } catch (err) {
    G.showToast(`Camera error: ${err.message}`);
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  G.audio.init();
  if (fsCheck.checked) document.documentElement.requestFullscreen?.().catch(() => {});
  setStatus('Starting camera…');
  try {
    await startCamera(camSel.value || undefined);
  } catch (err) {
    console.error(err);
    setStatus(`Camera error: ${err.message}. Allow camera access and try again.`, true);
    startBtn.disabled = false;
    return;
  }
  if (!G.detector) {
    setStatus('Loading pose model…');
    await detectorReady;
  }
  if (!G.detector) { startBtn.disabled = false; return; }
  overlay.hidden = true;
  G.go('calibrate');
});

addEventListener('keydown', (e) => {
  if (!overlay.hidden) return;
  const k = e.key.toLowerCase();
  if (k === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (k === 'm') {
    G.audio.setMuted(!G.audio.muted);
    G.showToast(G.audio.muted ? '🔇 Muted' : '🔊 Sound on');
  } else if (k === 's') {
    G.showSkeleton = !G.showSkeleton;
  } else if (k === 'v') {
    G.mirror = !G.mirror;
    G.showToast(G.mirror ? 'Mirror on' : 'Mirror off');
  } else if (k === 'c') {
    cycleCamera();
  } else if (k === 'd') {
    G.debug = !G.debug;
  } else if (k === 'escape' || k === 'backspace' || k === 'q') {
    G.go('menu');
  } else if (k === 'enter' && G.scene instanceof CalibrateScene) {
    G.go('menu');
  }
});

canvas.addEventListener('pointermove', (e) => G.body.setMouse(e.clientX, e.clientY, performance.now() / 1000));
canvas.addEventListener('click', (e) => {
  const b = G.scene?.buttons?.find((b) => b.contains(e.clientX, e.clientY));
  if (b) b.fire();
});

document.fonts?.load('40px "Bungee"');
