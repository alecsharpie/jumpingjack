import { GameBase } from './base.js';
import { ALL_PARTS } from '../body.js';
import { rand, pick, clamp, text, FONT_BODY } from '../fx.js';

const GRIME = [
  { name: 'SOAPY', base: [236, 242, 252], blobs: [[255, 255, 255], [200, 220, 245], [225, 235, 255]], bubbles: true },
  { name: 'MUDDY', base: [112, 82, 52], blobs: [[90, 62, 38], [140, 104, 70], [70, 50, 30]] },
  { name: 'SLIMY', base: [96, 176, 64], blobs: [[60, 140, 40], [140, 210, 90], [80, 160, 30]], bubbles: true },
  { name: 'FROSTY', base: [205, 232, 255], blobs: [[255, 255, 255], [170, 210, 245], [225, 245, 255]] },
  { name: 'PAINTY', base: [250, 240, 220], blobs: [[255, 61, 127], [0, 210, 255], [255, 204, 0], [124, 252, 0]] },
];
const CLEAN_TARGET = 0.9;

// The screen is covered in grime. Wipe it clean with your whole body.
export class WishiWashi extends GameBase {
  constructor(G) {
    super(G, { id: 'wishiwashi', title: 'WISHI WASHI', duration: 60, color: '#00a8e8', bpm: 112,
      how: 'Wipe the windows clean! Use your hands, arms… anything. Move around!' });
  }

  setup() {
    const { W, H } = this.G;
    this.mask = document.createElement('canvas');
    this.mask.width = 240;
    this.mask.height = Math.round((240 * H) / W);
    this.mctx = this.mask.getContext('2d', { willReadFrequently: true });
    this.windows = 0;
    this.prev = {};
    this.squeakT = 0;
    this.newWindow();
  }

  stats() { return [`Windows cleaned: ${this.windows}`]; }

  newWindow() {
    const m = this.mctx, w = this.mask.width, h = this.mask.height;
    const g = GRIME[this.windows % GRIME.length];
    this.grime = g;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, w, h);
    m.fillStyle = `rgba(${g.base},0.96)`;
    m.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const c = pick(g.blobs);
      m.fillStyle = `rgba(${c},${rand(0.4, 0.95)})`;
      m.beginPath();
      m.arc(rand(0, w), rand(0, h), rand(2, 12), 0, Math.PI * 2);
      m.fill();
    }
    if (g.bubbles) {
      m.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        m.strokeStyle = `rgba(255,255,255,${rand(0.5, 0.9)})`;
        m.beginPath();
        m.arc(rand(0, w), rand(0, h), rand(1.5, 6), 0, Math.PI * 2);
        m.stroke();
      }
    }
    this.clean = 0;
    this.windowT = 0;
    this.checkT = 0;
    this.shine = 0;
  }

  measure() {
    const { data } = this.mctx.getImageData(0, 0, this.mask.width, this.mask.height);
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 60) clear++;
    this.clean = clear / (data.length / 4);
  }

  step(dt) {
    const { G } = this;
    const { W, body, audio, fx } = G;
    this.windowT += dt;
    if (this.shine > 0) {
      this.shine -= dt;
      if (this.shine <= 0) this.newWindow();
      return;
    }
    const k = this.mask.width / W;
    const m = this.mctx;
    m.globalCompositeOperation = 'destination-out';
    m.lineCap = 'round';
    m.strokeStyle = '#000';
    let wiping = false;
    for (const p of body.partsFor(ALL_PARTS)) {
      const prev = this.prev[p.name];
      const r = p.r * (p.name === 'head' ? 0.9 : 1.25);
      m.lineWidth = r * 2 * k;
      m.beginPath();
      m.moveTo((prev?.x ?? p.x) * k, (prev?.y ?? p.y) * k);
      m.lineTo(p.x * k + 0.01, p.y * k);
      m.stroke();
      this.prev[p.name] = { x: p.x, y: p.y };
      if (p.speed > (body.scale || 100) * 2) wiping = true;
    }
    // Wipe along the forearms too, so sweeping an arm cleans a band, not just dots.
    const lm = body.lm;
    if (lm) {
      m.lineWidth = (body.scale || 100) * 0.45 * k;
      m.beginPath();
      for (const [a, b] of [[13, 15], [14, 16], [11, 13], [12, 14]]) {
        if (lm[a].v < 0.5 || lm[b].v < 0.5) continue;
        m.moveTo(lm[a].x * k, lm[a].y * k);
        m.lineTo(lm[b].x * k, lm[b].y * k);
      }
      m.stroke();
    }
    for (const n of Object.keys(this.prev)) if (!body.parts[n].visible) delete this.prev[n];

    this.squeakT -= dt;
    if (wiping && this.squeakT <= 0) { audio.squeak(); this.squeakT = 0.1; }

    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.2;
      this.measure();
      if (this.clean >= CLEAN_TARGET) {
        this.windows++;
        const bonus = Math.max(0, Math.round((20 - this.windowT) * 50));
        this.addScore(1000 + bonus, G.W / 2, G.H * 0.4);
        if (bonus > 0) fx.popup(G.W / 2, G.H * 0.55, `SPEED BONUS +${bonus}`, { size: 44, color: '#7CFC00', life: 1.4 });
        fx.popup(G.W / 2, G.H * 0.25, 'SPARKLING!', { size: 100, color: '#00d2ff', life: 1.4 });
        fx.confetti(G.W, G.H, 80);
        audio.cheer();
        m.globalCompositeOperation = 'source-over';
        m.clearRect(0, 0, this.mask.width, this.mask.height);
        this.shine = 1.3;
      }
    }
  }

  render(ctx) {
    const { W, H, t } = this.G;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.mask, 0, 0, W, H);
    ctx.restore();

    if (this.shine > 0) {
      // A glint sweeping across the clean glass
      const x = (1 - this.shine / 1.3) * (W + 600) - 300;
      const g = ctx.createLinearGradient(x - 200, 0, x + 200, H);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Window frame
    const f = clamp(W * 0.012, 10, 26);
    ctx.lineWidth = f;
    ctx.strokeStyle = '#f4f1ea';
    ctx.strokeRect(f / 2, f / 2, W - f, H - f);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#a89f8c';
    ctx.strokeRect(f, f, W - f * 2, H - f * 2);

    // Progress bar
    const bw = Math.min(W * 0.4, 600), bh = clamp(H * 0.035, 18, 36);
    const bx = W / 2 - bw / 2, by = H - bh - f * 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, bw + 8, bh + 8, bh); ctx.fill();
    const p = clamp(this.clean / CLEAN_TARGET, 0, 1);
    ctx.fillStyle = p > 0.85 ? '#7CFC00' : '#00d2ff';
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * p), bh, bh / 2); ctx.fill();
    text(ctx, `${this.grime.name} WINDOW ${this.windows + 1} · ${Math.round(p * 100)}% CLEAN`, W / 2, by - bh * 0.9,
      { size: bh * 0.9, font: FONT_BODY, lw: 5 });
    if (this.playing && this.windowT > 8 && this.clean < 0.7 && Math.sin(t * 4) > 0) {
      text(ctx, '← move around! →', W / 2, by - bh * 2.2, { size: bh * 0.9, font: FONT_BODY, color: '#ffcc00', lw: 5 });
    }
  }
}
