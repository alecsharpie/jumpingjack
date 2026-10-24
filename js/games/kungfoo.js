import { GameBase } from './base.js';
import { LIMBS } from '../body.js';
import { rand, pick, clamp, text } from '../fx.js';

const WORDS = ['POW!', 'BAM!', 'WHACK!', 'KAPOW!', 'BOOF!', 'HI-YAH!', 'THWACK!'];

// Ninjas leap in from the edges of the screen. Punch or kick them before they reach your head.
export class KungFoo extends GameBase {
  constructor(G) {
    super(G, { id: 'kungfoo', title: 'KUNG FOO', duration: 60, lives: 5, color: '#e63946', bpm: 128,
      how: 'Punch and kick the ninjas before they reach your head!' });
  }

  setup() {
    this.enemies = [];
    this.spawnT = 0.6;
    this.elapsed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.ko = 0;
  }

  stats() { return [`Ninjas defeated: ${this.ko}`, `Best combo: ${this.bestCombo}`]; }

  target() {
    const h = this.G.body.parts.head;
    return h.visible ? { x: h.x, y: h.y + h.r * 0.4, r: h.r } : { x: this.G.W / 2, y: this.G.H * 0.35, r: this.G.H * 0.08 };
  }

  spawn() {
    const { W, H, body } = this.G;
    const scale = body.scale || H * 0.12;
    const side = Math.random() < 0.5 ? -1 : 1;
    const roll = Math.random();
    const type = this.elapsed > 12 && roll < 0.18 ? 'red' : roll > 0.93 ? 'gold' : 'black';
    const r = clamp(scale * 0.55, 34, 110) * (type === 'gold' ? 0.8 : 1);
    const fromTop = Math.random() < 0.3;
    const x = fromTop ? W / 2 + side * rand(W * 0.15, W * 0.45) : side < 0 ? -r : W + r;
    const y = fromTop ? -r : rand(H * 0.1, H * 0.75);
    const tgt = this.target();
    const travel = clamp(2.4 - this.elapsed * 0.022, 1.15, 2.4) * (type === 'red' ? 0.65 : 1);
    const dist = Math.hypot(tgt.x - x, tgt.y - y);
    this.enemies.push({ x, y, vx: 0, vy: 0, r, type, speed: dist / travel, state: 'in', rot: 0, vr: 0, t: 0, side });
    this.G.audio.whoosh();
  }

  step(dt) {
    const { G } = this;
    const { W, H, body, fx, audio } = G;
    this.elapsed += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      if (this.elapsed > 20 && Math.random() < 0.25) this.spawn();
      this.spawnT = clamp(1.5 - this.elapsed * 0.017, 0.5, 1.5) * rand(0.8, 1.2);
    }
    const tgt = this.target();
    const minSpeed = Math.max(220, (body.scale || H * 0.12) * 1.8);

    for (const e of this.enemies) {
      e.t += dt;
      if (e.state === 'in') {
        // Home in on the head, steering gently so they're dodgeable but persistent.
        const dx = tgt.x - e.x, dy = tgt.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(e.t * 9) * e.speed * 0.15;
        const desiredX = (dx / d) * e.speed - (dy / d) * wob;
        const desiredY = (dy / d) * e.speed + (dx / d) * wob;
        const k = Math.min(1, dt * 4);
        e.vx += (desiredX - e.vx) * k;
        e.vy += (desiredY - e.vy) * k;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot = Math.sin(e.t * 6) * 0.25;

        const p = body.hit(e.x, e.y, e.r, LIMBS, minSpeed);
        if (p) {
          e.state = 'hit';
          const sp = Math.max(p.speed, 1);
          const push = 900;
          e.vx = (p.vx / sp) * push + rand(-100, 100);
          e.vy = (p.vy / sp) * push - 400;
          e.vr = rand(12, 20) * Math.sign(e.vx || 1);
          this.combo++;
          this.ko++;
          this.bestCombo = Math.max(this.bestCombo, this.combo);
          const pts = (e.type === 'gold' ? 500 : e.type === 'red' ? 200 : 100) * (1 + Math.floor(this.combo / 5));
          this.addScore(pts, e.x, e.y - e.r * 1.6, e.type === 'gold' ? '#ffd700' : '#ffe066');
          fx.popup(e.x, e.y, pick(WORDS), { size: 64, color: pick(['#fff', '#ffcc00', '#00d2ff']), life: 0.7 });
          fx.burst(e.x, e.y, { n: 26, colors: e.type === 'gold' ? ['#ffd700', '#fff'] : ['#fff', '#ffcc00', '#ff3d7f'], speed: 600, shape: 'star', size: 14 });
          fx.shake(8);
          audio.hit();
          if (this.combo > 0 && this.combo % 10 === 0) {
            fx.popup(W / 2, H * 0.25, `${this.combo} COMBO!`, { size: 90, color: '#ff3d7f', life: 1.3 });
            audio.cheer();
          }
          continue;
        }
        if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < e.r * 0.6 + tgt.r * 0.6) {
          e.state = 'gone';
          this.combo = 0;
          this.loseLife();
          fx.popup(tgt.x, tgt.y - tgt.r * 1.5, 'OUCH!', { size: 70, color: '#ff4d4d' });
          fx.burst(tgt.x, tgt.y, { n: 18, colors: ['#ff0033', '#fff'] });
        }
      } else if (e.state === 'hit') {
        e.vy += 2200 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
        if (e.y > H + 200 || e.x < -300 || e.x > W + 300 || e.y < -600) e.state = 'gone';
      }
    }
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');
  }

  idle(dt) {
    for (const e of this.enemies || []) {
      if (e.state !== 'hit') continue;
      e.vy += 2200 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt;
    }
  }

  render(ctx) {
    const { G } = this;
    // A hint ring around the head so the player knows what to protect.
    if (this.playing) {
      const tgt = this.target();
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,80,80,0.6)';
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, tgt.r * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const e of this.enemies) drawNinja(ctx, e, G.t);
    if (this.combo >= 3 && this.playing) {
      const big = clamp(G.W * 0.03, 22, 60);
      text(ctx, `x${this.combo} COMBO`, 28, 20 + big * 2.3, { size: big * 0.8, align: 'left', color: '#ff3d7f' });
    }
  }
}

function drawNinja(ctx, e, t) {
  const r = e.r;
  const body = e.type === 'red' ? '#b3001b' : e.type === 'gold' ? '#d4a017' : '#1d1d2b';
  const band = e.type === 'red' ? '#111' : e.type === 'gold' ? '#fff' : '#e63946';
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  // Headband tails fluttering behind
  const back = e.vx >= 0 ? -1 : 1;
  ctx.fillStyle = band;
  for (let i = 0; i < 2; i++) {
    const f = Math.sin(t * 25 + i * 2) * r * 0.15;
    ctx.beginPath();
    ctx.moveTo(back * r * 0.8, -r * 0.45);
    ctx.lineTo(back * r * 1.8, -r * 0.6 + i * r * 0.35 + f);
    ctx.lineTo(back * r * 1.7, -r * 0.35 + i * r * 0.35 + f);
    ctx.closePath();
    ctx.fill();
  }
  // Fists
  ctx.fillStyle = body;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-back * r * 0.85, r * (0.25 + s * 0.25), r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Body
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Face slot
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.roundRect(-r * 0.65, -r * 0.3, r * 1.3, r * 0.42, r * 0.2);
  ctx.fill();
  // Eyes
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = Math.max(3, r * 0.08);
  if (e.state === 'hit') {
    for (const s of [-1, 1]) {
      const ex = s * r * 0.3, ey = -r * 0.09, k = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k);
      ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.3, -r * 0.06, r * 0.1, r * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * r * 0.48, -r * 0.26);
      ctx.lineTo(s * r * 0.14, -r * 0.16);
      ctx.stroke();
    }
  }
  // Headband
  ctx.fillStyle = band;
  ctx.fillRect(-r * 0.92, -r * 0.55, r * 1.84, r * 0.2);
  ctx.restore();
}
