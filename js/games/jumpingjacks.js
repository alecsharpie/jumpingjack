import { GameBase } from './base.js';
import { drawSkeleton } from '../body.js';
import { clamp, text, panel, FONT_BODY } from '../fx.js';

// Do as many jumping jacks as you can in 30 seconds.
export class JumpingJacks extends GameBase {
  constructor(G) {
    super(G, { id: 'jumpingjacks', title: 'JUMPING JACKS', duration: 30, color: '#ff8a00', bpm: 132, scoreLabel: 'REPS', camDim: 0.1,
      how: 'As many jumping jacks as you can! Arms up and feet out, then back together.' });
  }

  setup() {
    this.state = 'closed';
    this.reps = 0;
    this.armsUp = this.armsDown = this.feetOut = this.feetIn = false;
    this.feetMode = true;
    this.pulse = 0;
  }

  stats() {
    const rpm = Math.round((this.reps / this.duration) * 60);
    return [`Pace: ${rpm} reps/min`];
  }

  detect() {
    const lm = this.G.body.lm;
    if (!lm) { this.armsUp = this.armsDown = this.feetOut = this.feetIn = false; return null; }
    const v = (i) => lm[i].v > 0.45;
    const sw = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y) || this.G.body.scale;
    const shY = (lm[11].y + lm[12].y) / 2;
    this.armsUp = v(15) && v(16) && lm[15].y < shY - 0.5 * sw && lm[16].y < shY - 0.5 * sw;
    this.armsDown = (!v(15) || lm[15].y > shY + 0.35 * sw) && (!v(16) || lm[16].y > shY + 0.35 * sw);
    this.feetMode = v(27) && v(28);
    const feet = Math.abs(lm[27].x - lm[28].x);
    this.feetOut = this.feetMode && feet > 1.45 * sw;
    this.feetIn = this.feetMode && feet < 1.1 * sw;
    const open = this.armsUp && (!this.feetMode || this.feetOut);
    const closed = this.armsDown && (!this.feetMode || this.feetIn);
    return open ? 'open' : closed ? 'closed' : null;
  }

  idle() { this.detect(); }

  step(dt) {
    const { G } = this;
    const { W, H, fx, audio, body } = G;
    this.pulse = Math.max(0, this.pulse - dt * 3);
    const s = this.detect();
    if (s === 'open' && this.state !== 'open') {
      this.state = 'open';
      audio.tone(660, 0.08, { type: 'triangle', vol: 0.12 });
    } else if (s === 'closed' && this.state === 'open') {
      this.state = 'closed';
      this.reps++;
      this.score = this.reps;
      this.pulse = 1;
      audio.rep(this.reps);
      const head = body.parts.head;
      const x = head.visible ? head.x : W / 2, y = head.visible ? head.y - head.r * 2 : H * 0.3;
      fx.burst(x, y, { n: 24, speed: 500, shape: 'star', size: 12 });
      if (this.reps % 10 === 0) {
        fx.popup(W / 2, H * 0.3, `${this.reps} REPS!`, { size: 110, color: '#ff8a00', life: 1.4 });
        fx.confetti(W, H, 60);
        audio.cheer();
      }
    }
  }

  render(ctx) {
    const { G } = this;
    const { W, H, t, body } = G;
    drawSkeleton(ctx, body, { color: this.state === 'open' ? '#ffcc00' : '#7df9ff', width: 8 });

    // Big rep counter on the right
    const s = 1 + this.pulse * 0.3;
    text(ctx, String(this.reps), W * 0.86, H * 0.45, { size: H * 0.24 * s, color: '#ff8a00', stroke: '#fff', lw: 8 });
    text(ctx, 'REPS', W * 0.86, H * 0.6, { size: H * 0.045, font: FONT_BODY });

    // Pose checklist on the left
    const pw = clamp(W * 0.16, 160, 300), ph = pw * 1.25;
    const px = 20, py = H * 0.22;
    panel(ctx, px, py, pw, ph);
    text(ctx, 'DO THIS!', px + pw / 2, py + ph * 0.1, { size: pw * 0.11, color: '#ffcc00' });
    drawGuide(ctx, px + pw / 2, py + ph * 0.48, pw * 0.5, (Math.sin(t * Math.PI * 2 * 0.9) + 1) / 2);
    const target = this.state === 'open' ? 'TOGETHER' : 'OUT';
    const pill = (label, on, y) => {
      ctx.fillStyle = on ? '#7CFC00' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(px + pw * 0.1, y, pw * 0.8, pw * 0.13, pw * 0.065);
      ctx.fill();
      text(ctx, label, px + pw / 2, y + pw * 0.067, { size: pw * 0.075, font: FONT_BODY, color: on ? '#0b3d00' : '#fff', stroke: null });
    };
    if (this.state === 'open') {
      pill('ARMS DOWN', this.armsDown, py + ph * 0.74);
      pill(this.feetMode ? 'FEET TOGETHER' : 'FEET (step back)', this.feetIn, py + ph * 0.86);
    } else {
      pill('ARMS UP', this.armsUp, py + ph * 0.74);
      pill(this.feetMode ? 'FEET OUT' : 'FEET (step back)', this.feetOut, py + ph * 0.86);
    }
    if (this.playing && !this.feetMode && body.present) {
      text(ctx, `Arms-only mode: step back to count feet too (next: ${target})`, W / 2, H * 0.93,
        { size: clamp(W * 0.016, 14, 30), font: FONT_BODY, color: '#ffcc00', lw: 4, maxWidth: W * 0.8 });
    }
  }
}

// Little animated stick figure doing a jumping jack; k = 0 closed, 1 open.
function drawGuide(ctx, cx, cy, size, k) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(4, s * 0.07);
  ctx.lineCap = 'round';
  const hipY = cy + s * 0.25, shY = cy - s * 0.25;
  ctx.beginPath();
  ctx.arc(cx, shY - s * 0.2, s * 0.13, 0, Math.PI * 2);
  ctx.moveTo(cx, shY - s * 0.07);
  ctx.lineTo(cx, hipY);
  for (const side of [-1, 1]) {
    const armA = Math.PI / 2 - side * (0.25 + k * 2.6);
    ctx.moveTo(cx, shY);
    ctx.lineTo(cx + Math.cos(armA) * s * 0.42, shY + Math.sin(armA) * s * 0.42);
    const legA = Math.PI / 2 - side * (0.08 + k * 0.45);
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + Math.cos(legA) * s * 0.5, hipY + Math.sin(legA) * s * 0.5 - k * s * 0.08);
  }
  ctx.stroke();
  ctx.restore();
}
