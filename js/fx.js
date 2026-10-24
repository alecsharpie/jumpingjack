export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const FONT_HEAD = '"Bungee", "Arial Black", sans-serif';
export const FONT_BODY = '"Fredoka", "Trebuchet MS", sans-serif';
export const PALETTE = ['#ff3d7f', '#ffcc00', '#00d2ff', '#7CFC00', '#b388ff', '#ff8a00'];

export function text(ctx, str, x, y, { size = 40, color = '#fff', align = 'center', baseline = 'middle', font = FONT_HEAD, stroke = '#000', lw, alpha = 1, maxWidth } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${font === FONT_BODY ? '700 ' : ''}${size}px ${font}`;
  if (maxWidth) {
    const w = ctx.measureText(str).width;
    if (w > maxWidth) {
      size *= maxWidth / w;
      ctx.font = `${font === FONT_BODY ? '700 ' : ''}${size}px ${font}`;
    }
  }
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw ?? Math.max(3, size * 0.18);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function panel(ctx, x, y, w, h, { fill = 'rgba(10,10,30,0.72)', stroke = 'rgba(255,255,255,0.35)', r = 18 } = {}) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// Particles, floating text, screen shake and flashes shared by every scene.
export class FX {
  constructor() { this.clear(); }

  clear() {
    this.particles = [];
    this.popups = [];
    this.shakeAmt = 0;
    this.flashA = 0;
    this.flashColor = '#fff';
  }

  burst(x, y, { n = 20, colors = PALETTE, speed = 450, size = 9, life = 0.9, gravity = 900, shape = 'circle' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.2,
        size: rand(0.5, 1.2) * size, life, t: 0, color: pick(colors), gravity, shape,
        rot: rand(0, 6), vr: rand(-10, 10),
      });
    }
  }

  confetti(W, H, n = 120) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: rand(0, W), y: rand(-H * 0.3, -10), vx: rand(-80, 80), vy: rand(100, 300),
        size: rand(8, 16), life: rand(2.5, 4), t: 0, color: pick(PALETTE), gravity: 120, shape: 'rect',
        rot: rand(0, 6), vr: rand(-8, 8),
      });
    }
  }

  popup(x, y, str, { color = '#ffe066', size = 48, life = 1 } = {}) {
    this.popups.push({ x, y, str, color, size, life, t: 0 });
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  flash(color = '#fff', a = 0.5) { this.flashColor = color; this.flashA = a; }

  update(dt) {
    for (const p of this.particles) {
      p.t += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);
    this.shakeAmt *= Math.pow(0.002, dt);
    if (this.shakeAmt < 0.3) this.shakeAmt = 0;
    this.flashA = Math.max(0, this.flashA - dt * 1.6);
  }

  applyShake(ctx) {
    if (this.shakeAmt) ctx.translate(rand(-1, 1) * this.shakeAmt, rand(-1, 1) * this.shakeAmt);
  }

  draw(ctx, W, H) {
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, p.size * k + 2, p.rot);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      const k = p.t / p.life;
      const pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : 1.2 - Math.min(0.2, (k - 0.15) * 2);
      text(ctx, p.str, p.x, p.y - k * 60, { size: p.size * pop, color: p.color, alpha: k > 0.7 ? (1 - k) / 0.3 : 1 });
    }
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-50, -50, W + 100, H + 100);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawStar(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// A big on-screen button you activate by holding a hand over it (or clicking it).
export class HoverButton {
  constructor(G, opts) {
    this.G = G;
    Object.assign(this, { x: 0, y: 0, w: 100, h: 100, label: '', icon: '', sub: '', color: '#ff3d7f', hold: 1.2, small: false }, opts);
    this.progress = 0;
    this.hover = false;
    this.cool = 0.8; // ignore hands that are already over the button when it appears
  }

  set(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }

  contains(x, y) { return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h; }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    const over = !!this.G.body.inRect(this) && this.cool <= 0;
    if (over && !this.hover) this.G.audio.tick();
    this.hover = over;
    if (over) {
      this.progress += dt / this.hold;
      if (this.progress >= 1) this.fire();
    } else {
      this.progress = Math.max(0, this.progress - dt * 1.5);
    }
  }

  fire() {
    this.progress = 0;
    this.cool = 1;
    this.G.audio.select();
    this.G.fx.burst(this.x + this.w / 2, this.y + this.h / 2, { n: 30, colors: [this.color, '#fff', '#ffcc00'] });
    this.onSelect?.();
  }

  draw(ctx, t = 0) {
    const { x, y, w, h } = this;
    const cx = x + w / 2, cy = y + h / 2;
    const s = this.hover ? 1.06 + Math.sin(t * 12) * 0.015 : 1;
    const r = Math.min(w, h) * 0.18;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    if (this.hover) { ctx.shadowColor = this.color; ctx.shadowBlur = 40; }
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, this.color);
    g.addColorStop(1, shade(this.color, -0.35));
    ctx.globalAlpha = this.small ? 0.75 : 0.92;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineWidth = this.hover ? 7 : 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    if (this.progress > 0) {
      ctx.save();
      roundRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-w / 2, h / 2 - h * this.progress, w, h * this.progress);
      ctx.restore();
    }

    const m = Math.min(w, h);
    if (this.small) {
      text(ctx, `${this.icon} ${this.label}`, 0, 2, { size: h * 0.36, font: FONT_BODY, maxWidth: w * 0.85, lw: 5 });
    } else {
      if (this.icon) {
        ctx.font = `${m * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, 0, -h * 0.13);
      }
      text(ctx, this.label, 0, h * 0.24, { size: m * 0.15, maxWidth: w * 0.88 });
      if (this.sub) text(ctx, this.sub, 0, h * 0.39, { size: m * 0.085, font: FONT_BODY, color: '#fff7c2', maxWidth: w * 0.88, lw: 4 });
    }
    ctx.restore();
  }
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}
