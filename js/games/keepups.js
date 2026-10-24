import { GameBase } from './base.js';
import { ALL_PARTS } from '../body.js';
import { rand, clamp, text, FONT_BODY } from '../fx.js';

const CALLS = { head: 'HEADER!', lknee: 'KNEE!', rknee: 'KNEE!', lfoot: 'KICK!', rfoot: 'KICK!' };

// Keep the football in the air with your head, hands, knees and feet.
export class KeepUps extends GameBase {
  constructor(G) {
    super(G, { id: 'keepups', title: 'KEEPY UPPY', duration: 90, lives: 3, color: '#2ec4b6', bpm: 124,
      how: 'Keep the ball in the air! Headers and kicks score double. Everyone gets their own ball.' });
  }

  setup() {
    this.balls = [];
  }

  begin() {
    for (const p of this.ps) {
      Object.assign(p, { touches: 0, streak: 0, bestStreak: 0, respawnT: 0, ball: null });
      this.spawnBall(p);
    }
  }

  stats() {
    if (!this.multi) return [`Touches: ${this.ps[0].touches}`, `Best streak: ${this.ps[0].bestStreak}`];
    return this.ps.map((p) => `${p.name}: ${p.touches} touches · best streak ${p.bestStreak}`);
  }

  // Where a player's ball should drift towards: above their head, or their share of the screen.
  homeX(p) {
    const { W } = this.G;
    const head = p.body.parts.head;
    return head.visible ? head.x : (W * (p.idx + 0.5)) / this.ps.length;
  }

  spawnBall(p) {
    const { W, H } = this.G;
    const r = clamp(H * 0.065, 30, 90) * (this.multi ? 0.85 : 1);
    p.ball = { x: clamp(this.homeX(p), W * 0.1, W * 0.9), y: -r, vx: rand(-30, 30), vy: H * 0.15, r, rot: 0, spin: rand(-2, 2), cool: 0 };
    this.G.audio.whoosh();
  }

  step(dt) {
    const { G } = this;
    const { W, H } = G;
    for (const p of this.ps) {
      if (!p.ball) {
        p.respawnT -= dt;
        if (p.respawnT <= 0 && !p.out) this.spawnBall(p);
        continue;
      }
      const b = p.ball;
      const g = H * 1.1;
      const sub = 4;
      for (let i = 0; i < sub; i++) {
        const h = dt / sub;
        b.vy += g * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.cool -= h;
        this.collide(p, b);
      }
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; G.audio.bounce(0.7); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; G.audio.bounce(0.7); }
      b.rot += b.spin * dt;
      b.vx *= Math.pow(0.85, dt);

      if (b.y - b.r > H) {
        p.ball = null;
        p.streak = 0;
        p.respawnT = 1.3;
        this.loseLife(p);
        G.fx.popup(clamp(b.x, 100, W - 100), H * 0.85, 'DROPPED!', { size: 70, color: this.multi ? p.color : '#ff4d4d' });
      }
    }
  }

  // Each player can only touch their own ball.
  collide(owner, b) {
    if (b.cool > 0) return;
    const { G } = this;
    const { W, H, fx, audio } = G;
    for (const p of owner.body.partsFor(ALL_PARTS)) {
      const dx = b.x - p.x, dy = b.y - p.y;
      const d = Math.hypot(dx, dy);
      const R = b.r + p.r * 1.1;
      if (d >= R || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      const rvx = b.vx - p.vx * 0.6, rvy = b.vy - p.vy * 0.6;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
      // Always send it back up in a nice playable arc, and drift it back over the player.
      b.vy = clamp(Math.min(b.vy, -H * rand(0.95, 1.1) + Math.min(0, p.vy) * 0.25), -H * 1.6, 0);
      b.vx = clamp(b.vx + nx * 150 + (this.homeX(owner) - b.x) * 0.35, -W * 0.4, W * 0.4);
      b.x = p.x + nx * R;
      b.y = p.y + ny * R;
      b.spin = rand(-9, 9);
      b.cool = 0.2;

      owner.touches++;
      owner.streak++;
      owner.bestStreak = Math.max(owner.bestStreak, owner.streak);
      const call = CALLS[p.name];
      const pts = 10 * (call ? 2 : 1) * (1 + Math.floor(owner.streak / 5));
      this.addScore(owner, pts, b.x, b.y - b.r * 1.5);
      if (call) fx.popup(b.x, b.y - b.r * 2.6, call, { size: 50, color: this.multi ? owner.color : '#2ec4b6' });
      if (owner.streak % 10 === 0) {
        fx.popup(b.x, H * 0.3, `${owner.streak} IN A ROW!`, { size: 80, color: this.multi ? owner.color : '#ffcc00', life: 1.3 });
        audio.cheer();
      }
      fx.burst(b.x, b.y + b.r * 0.5, { n: 12, colors: ['#fff', this.multi ? owner.color : '#2ec4b6'], speed: 300, size: 6 });
      audio.bounce(1 + Math.min(owner.streak, 20) * 0.03);
      return;
    }
  }

  render(ctx) {
    const { W, H, t } = this.G;
    if (this.phase === 'intro') {
      drawBall(ctx, W / 2, H * 0.3 + Math.sin(t * 3) * 20, clamp(H * 0.065, 30, 90), t);
    }
    for (const p of this.ps) {
      const b = p.ball;
      if (!b) continue;
      if (b.y + b.r < 0) {
        // Off the top: show where it'll come down
        ctx.fillStyle = this.multi ? p.color : '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(b.x, 12);
        ctx.lineTo(b.x - 22, 50);
        ctx.lineTo(b.x + 22, 50);
        ctx.closePath();
        ctx.fill();
      } else {
        drawBall(ctx, b.x, b.y, b.r, b.rot, this.multi ? p.color : null);
      }
    }
    if (!this.playing) return;
    this.ps.forEach((p, i) => {
      if (p.streak < 2) return;
      const right = !this.multi || i % 2 === 1;
      const x = right ? W - 30 : 30;
      text(ctx, String(p.streak), x, H * 0.5, { size: H * 0.16, align: right ? 'right' : 'left', color: this.multi ? p.color : '#2ec4b6', stroke: '#fff', lw: 6, alpha: 0.9 });
      text(ctx, 'STREAK', x, H * 0.6, { size: H * 0.035, align: right ? 'right' : 'left', font: FONT_BODY });
    });
  }
}

function drawBall(ctx, x, y, r, rot, ring = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  ctx.rotate(rot);
  ctx.fillStyle = '#111';
  const pent = (cx, cy, s) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fill();
  };
  pent(0, 0, r * 0.32);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    pent(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.3);
  }
  ctx.restore();
  ctx.lineWidth = ring ? 6 : 3;
  ctx.strokeStyle = ring || '#222';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
