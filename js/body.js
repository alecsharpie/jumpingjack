import { clamp, lerp } from './fx.js';

export const HANDS = ['lhand', 'rhand'];
export const LIMBS = ['lhand', 'rhand', 'lfoot', 'rfoot'];
export const ALL_PARTS = ['head', 'lhand', 'rhand', 'lfoot', 'rfoot', 'lknee', 'rknee'];

// Part radius as a fraction of body scale (roughly shoulder width).
const RADIUS = { head: 0.62, lhand: 0.42, rhand: 0.42, lfoot: 0.42, rfoot: 0.42, lknee: 0.36, rknee: 0.36, mouse: 0.42 };

export const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
  [15, 17], [15, 19], [17, 19], [16, 18], [16, 20], [18, 20],
];

export const PLAYER_COLORS = ['#ffcc00', '#00e5ff', '#ff3d7f', '#7CFC00'];

const VIS = 0.5;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class Part {
  constructor(name, body) {
    this.name = name;
    this.body = body;
    this.x = this.y = this.px = this.py = 0;
    this.vx = this.vy = 0;
    this.r = 40;
    this.visible = false;
    this.lastSeen = -9;
    this.trail = [];
  }
  get speed() { return Math.hypot(this.vx, this.vy); }

  feed(x, y, ok, t, dt) {
    if (!ok) {
      if (t - this.lastSeen > 0.3) this.hide();
      return;
    }
    this.px = this.x; this.py = this.y;
    if (!this.visible) {
      this.x = this.px = x; this.y = this.py = y; this.vx = this.vy = 0;
    } else {
      const nx = lerp(this.x, x, 0.75), ny = lerp(this.y, y, 0.75);
      this.vx = lerp(this.vx, (nx - this.x) / dt, 0.6);
      this.vy = lerp(this.vy, (ny - this.y) / dt, 0.6);
      this.x = nx; this.y = ny;
    }
    this.visible = true;
    this.lastSeen = t;
    this.trail.push({ x: this.x, y: this.y, t });
    if (this.trail.length > 10) this.trail.shift();
  }
  hide() {
    this.visible = false;
    this.vx = this.vy = 0;
    this.trail.length = 0;
  }
}

// Turns raw pose landmarks into smoothed, screen-space body parts the games can hit things with.
export class Body {
  constructor(id = 0) {
    this.id = id;
    this.color = PLAYER_COLORS[id % PLAYER_COLORS.length];
    this.anchor = null;      // last known chest position, used to keep player identities stable
    this.parts = {};
    for (const n of [...ALL_PARTS, 'mouse']) this.parts[n] = new Part(n, this);
    this.lm = null;          // screen-space landmarks of the current frame
    this.present = false;
    this.scale = 0;
    this.lastDetect = -9;
    this.prevT = null;
    this.mouseT = -9;
    this.W = 1; this.H = 1;
  }

  update(raw, G, t) {
    this.W = G.W; this.H = G.H;
    const dt = clamp(t - (this.prevT ?? t - 1 / 30), 1 / 120, 0.2);
    this.prevT = t;
    if (!raw) {
      this.lm = null;
      for (const n of ALL_PARTS) this.parts[n].feed(0, 0, false, t, dt);
      return;
    }
    const pts = raw.map((l) => {
      const p = G.toScreen(l);
      p.v = l.visibility ?? 1;
      return p;
    });
    this.lm = pts;
    this.lastDetect = t;
    this.present = true;

    const torso = d(mid(pts[11], pts[12]), mid(pts[23], pts[24]));
    const s = clamp(Math.max(d(pts[11], pts[12]), torso * 0.7), G.H * 0.04, G.H * 0.5);
    this.scale = this.scale ? lerp(this.scale, s, 0.15) : s;
    this.chest = mid(pts[11], pts[12]);

    const ok = (i) => pts[i].v > VIS;
    const feed = (name, p, vis) => {
      const part = this.parts[name];
      part.r = Math.max(22, this.scale * RADIUS[name]);
      part.feed(p.x, p.y, vis, t, dt);
    };
    // Hands: push past the wrist towards the fingers so the hit circle sits on the palm.
    const hand = (w, a, b) => {
      const c = { x: (pts[w].x + pts[a].x + pts[b].x) / 3, y: (pts[w].y + pts[a].y + pts[b].y) / 3 };
      return { x: pts[w].x + (c.x - pts[w].x) * 1.4, y: pts[w].y + (c.y - pts[w].y) * 1.4 };
    };
    const foot = (a, h, f) => ({ x: (pts[a].x + pts[h].x + pts[f].x) / 3, y: (pts[a].y + pts[h].y + pts[f].y) / 3 });

    feed('head', pts[0], ok(0));
    feed('lhand', hand(15, 17, 19), ok(15));
    feed('rhand', hand(16, 18, 20), ok(16));
    feed('lfoot', foot(27, 29, 31), ok(27));
    feed('rfoot', foot(28, 30, 32), ok(28));
    feed('lknee', pts[25], ok(25));
    feed('rknee', pts[26], ok(26));
  }

  // Called every frame; drops the body if detection has gone quiet.
  tick(t) {
    if (this.present && t - this.lastDetect > 0.6) {
      this.present = false;
      this.lm = null;
      for (const n of ALL_PARTS) this.parts[n].hide();
    }
    const m = this.parts.mouse;
    if (m.visible && t - this.mouseT > 2.5) m.hide();
    if (m.visible) { m.vx *= 0.85; m.vy *= 0.85; }
  }

  // The mouse acts as an extra hand, handy for testing without a camera.
  setMouse(x, y, t) {
    const m = this.parts.mouse;
    const dt = clamp(t - this.mouseT, 1 / 240, 0.2);
    if (m.visible) {
      m.vx = lerp(m.vx, (x - m.x) / dt, 0.5);
      m.vy = lerp(m.vy, (y - m.y) / dt, 0.5);
    }
    m.px = m.x; m.py = m.y;
    m.x = x; m.y = y;
    m.r = Math.max(26, (this.scale || this.H * 0.12) * RADIUS.mouse);
    m.visible = true;
    this.mouseT = t;
  }

  partsFor(names) {
    const list = names.map((n) => this.parts[n]);
    if (names.includes('lhand') || names.includes('rhand')) list.push(this.parts.mouse);
    return list.filter((p) => p.visible);
  }

  // First part within reach of the circle (x, y, r) moving at least minSpeed px/s.
  hit(x, y, r, names = ALL_PARTS, minSpeed = 0) {
    for (const p of this.partsFor(names)) {
      if (p.speed < minSpeed) continue;
      if (Math.hypot(p.x - x, p.y - y) < r + p.r) return p;
    }
    return null;
  }

  inRect(rect, names = HANDS) {
    for (const p of this.partsFor(names)) {
      const pad = p.r * 0.3;
      if (p.x > rect.x - pad && p.x < rect.x + rect.w + pad && p.y > rect.y - pad && p.y < rect.y + rect.h + pad) return p;
    }
    return null;
  }

  center() {
    if (this.chest && this.present) return this.chest;
    return { x: this.W / 2, y: this.H * 0.4 };
  }

  // Head and shoulders in frame is enough to play most games.
  upperBodyVisible() {
    if (!this.lm) return false;
    return [0, 11, 12].every((i) => {
      const p = this.lm[i];
      return p.v > VIS && p.x > 0 && p.x < this.W && p.y > 0 && p.y < this.H;
    });
  }

  fullBodyVisible() {
    if (!this.lm) return false;
    return [0, 11, 12, 23, 24, 25, 26, 27, 28].every((i) => {
      const p = this.lm[i];
      return p.v > VIS && p.x > 0 && p.x < this.W && p.y > 0 && p.y < this.H;
    });
  }
}

// Everyone in front of the camera. Detections are matched to players by chest
// position each frame, so P1 stays P1 even if MediaPipe reorders its results.
export class Crowd {
  constructor(n) {
    this.players = Array.from({ length: n }, (_, i) => new Body(i));
  }

  get active() { return this.players.filter((b) => b.present); }
  get present() { return this.players.some((b) => b.present); }
  get mouse() { return this.players[0].parts.mouse; }

  update(list, G, t) {
    const dets = (list || []).slice(0, this.players.length).map((raw) => {
      const a = G.toScreen(raw[11]), b = G.toScreen(raw[12]);
      return { raw, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    });
    const pairs = [];
    dets.forEach((det, di) => this.players.forEach((b, bi) => {
      if (b.anchor) pairs.push({ di, bi, dist: Math.hypot(det.x - b.anchor.x, det.y - b.anchor.y) + (b.present ? 0 : G.W) });
    }));
    pairs.sort((a, b) => a.dist - b.dist);
    const usedD = new Set(), usedB = new Set(), assigned = new Map();
    for (const p of pairs) {
      if (usedD.has(p.di) || usedB.has(p.bi)) continue;
      usedD.add(p.di); usedB.add(p.bi);
      assigned.set(p.bi, dets[p.di]);
    }
    dets.forEach((det, di) => {
      if (usedD.has(di)) return;
      const bi = this.players.findIndex((_, i) => !usedB.has(i));
      if (bi < 0) return;
      usedB.add(bi);
      assigned.set(bi, det);
    });
    this.players.forEach((b, bi) => {
      const det = assigned.get(bi);
      b.update(det ? det.raw : null, G, t);
      if (det) b.anchor = { x: det.x, y: det.y };
    });
  }

  tick(t) { for (const b of this.players) b.tick(t); }
  setMouse(x, y, t) { this.players[0].setMouse(x, y, t); }
  partsFor(names) { return this.players.flatMap((b) => b.partsFor(names)); }

  hit(x, y, r, names, minSpeed) {
    for (const b of this.players) {
      const p = b.hit(x, y, r, names, minSpeed);
      if (p) return p;
    }
    return null;
  }

  inRect(rect, names) {
    for (const b of this.players) {
      const p = b.inRect(rect, names);
      if (p) return p;
    }
    return null;
  }

  upperBodyVisible() { return this.players.some((b) => b.upperBodyVisible()); }
}

export function drawSkeleton(ctx, body, { color = body.color, width = 6, alpha = 0.8 } = {}) {
  const lm = body.lm;
  if (!lm) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    if (lm[a].v < VIS || lm[b].v < VIS) continue;
    ctx.moveTo(lm[a].x, lm[a].y);
    ctx.lineTo(lm[b].x, lm[b].y);
  }
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 11; i < 33; i++) {
    if (lm[i].v < VIS) continue;
    ctx.beginPath();
    ctx.arc(lm[i].x, lm[i].y, width * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lm[0].v > VIS) {
    ctx.beginPath();
    ctx.arc(lm[0].x, lm[0].y, Math.max(20, body.scale * 0.45), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
