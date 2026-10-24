import { GameBase } from './base.js';
import { ALL_PARTS } from '../body.js';
import { rand, clamp, drawStar } from '../fx.js';

// Bubbles float up. Pop them with any part of your body. Gold ones are worth more; dodge the bombs.
export class Bubbles extends GameBase {
  constructor(G) {
    super(G, { id: 'bubbles', title: 'BUBBLE POP', duration: 45, color: '#b388ff', bpm: 118,
      how: 'Pop the bubbles with any part of your body. Gold = bonus, avoid the bombs!' });
  }

  setup() {
    this.bubbles = [];
    this.spawnT = 0;
    this.popped = 0;
    this.chain = 0;
    this.chainT = 0;
    this.elapsed = 0;
    for (let i = 0; i < 6; i++) this.spawn(rand(0.3, 1));
  }

  stats() { return [`Bubbles popped: ${this.popped}`]; }

  spawn(yFrac = 1.1) {
    const { W, H } = this.G;
    const roll = Math.random();
    const type = this.elapsed > 5 && roll < 0.08 ? 'bomb' : roll > 0.92 ? 'gold' : 'normal';
    const r = H * (type === 'gold' ? rand(0.035, 0.05) : rand(0.045, 0.085));
    this.bubbles.push({
      x: rand(W * 0.08, W * 0.92), y: H * yFrac + r, r, type,
      vy: -H * rand(0.12, 0.22) * (type === 'gold' ? 1.6 : 1) * (1 + this.elapsed / 60),
      hue: rand(0, 360), ph: rand(0, 6), t: 0, dead: false,
    });
  }

  float(dt) {
    for (const b of this.bubbles) {
      b.t += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.t * 2 + b.ph) * 40 * dt;
    }
    this.bubbles = this.bubbles.filter((b) => !b.dead && b.y > -b.r * 2);
  }

  idle(dt) { this.float(dt); }

  step(dt) {
    const { G } = this;
    const { body, fx, audio } = G;
    this.elapsed += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = clamp(0.55 - this.elapsed * 0.006, 0.25, 0.55) * rand(0.7, 1.3);
    }
    this.chainT -= dt;
    if (this.chainT <= 0) this.chain = 0;
    this.float(dt);

    for (const b of this.bubbles) {
      if (b.dead || !body.hit(b.x, b.y, b.r * 0.9, ALL_PARTS)) continue;
      b.dead = true;
      if (b.type === 'bomb') {
        this.addScore(-300, b.x, b.y, '#ff4d4d');
        this.chain = 0;
        fx.burst(b.x, b.y, { n: 40, colors: ['#222', '#ff6a00', '#ffcc00'], speed: 700, size: 14 });
        fx.shake(25);
        fx.flash('#ff6a00', 0.35);
        audio.bomb();
        continue;
      }
      this.popped++;
      this.chain++;
      this.chainT = 1;
      const pts = (b.type === 'gold' ? 250 : 50) + Math.min(this.chain, 10) * 5;
      this.addScore(pts, b.x, b.y, b.type === 'gold' ? '#ffd700' : '#fff');
      const colors = b.type === 'gold' ? ['#ffd700', '#fff8b0'] : [`hsl(${b.hue},90%,70%)`, '#fff'];
      fx.burst(b.x, b.y, { n: 16, colors, speed: 380, size: 7, gravity: 300 });
      audio.pop(1 + Math.min(this.chain, 12) * 0.08);
    }
  }

  render(ctx) {
    const { t } = this.G;
    for (const b of this.bubbles) {
      if (b.type === 'bomb') drawBomb(ctx, b, t);
      else drawBubble(ctx, b);
    }
  }
}

function drawBubble(ctx, b) {
  const { x, y, r } = b;
  const gold = b.type === 'gold';
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  if (gold) {
    g.addColorStop(0, 'rgba(255,250,200,0.95)');
    g.addColorStop(0.7, 'rgba(255,200,0,0.8)');
    g.addColorStop(1, 'rgba(200,140,0,0.95)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.75, `hsla(${b.hue},90%,70%,0.25)`);
    g.addColorStop(1, `hsla(${(b.hue + 60) % 360},90%,75%,0.85)`);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gold ? '#fff3a0' : 'rgba(255,255,255,0.8)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
  ctx.fill();
  if (gold) {
    ctx.fillStyle = '#fff';
    drawStar(ctx, x, y, r * 0.45, b.t);
  }
}

function drawBomb(ctx, b, t) {
  const { x, y, r } = b;
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + t;
    const rr = i % 2 ? r * 0.85 : r * 1.05;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff3b3b';
  ctx.font = `${r * 0.9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', x, y + r * 0.05);
}
