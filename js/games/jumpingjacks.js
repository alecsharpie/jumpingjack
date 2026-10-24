import { GameBase } from './base.js';
import { drawSkeleton } from '../body.js';
import { clamp, text, panel, FONT_BODY } from '../fx.js';

// Do as many jumping jacks as you can in 30 seconds. With two players it's a race.
export class JumpingJacks extends GameBase {
  constructor(G) {
    super(G, { id: 'jumpingjacks', title: 'JUMPING JACKS', duration: 30, color: '#ff8a00', bpm: 132, scoreLabel: 'REPS', camDim: 0.1,
      how: 'As many jumping jacks as you can! Arms up and feet out, then back together.' });
  }

  begin() {
    for (const p of this.ps) Object.assign(p, { state: 'closed', pulse: 0, armsUp: false, armsDown: false, feetOut: false, feetIn: false, feetMode: true });
  }

  stats() {
    const rpm = (p) => Math.round((p.score / this.duration) * 60);
    if (!this.multi) return [`Pace: ${rpm(this.ps[0])} reps/min`];
    return this.ps.map((p) => `${p.name}: ${rpm(p)} reps/min`);
  }

  detect(p) {
    const lm = p.body.lm;
    if (!lm) { p.armsUp = p.armsDown = p.feetOut = p.feetIn = false; return null; }
    const v = (i) => lm[i].v > 0.45;
    const sw = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y) || p.body.scale;
    const shY = (lm[11].y + lm[12].y) / 2;
    p.armsUp = v(15) && v(16) && lm[15].y < shY - 0.5 * sw && lm[16].y < shY - 0.5 * sw;
    p.armsDown = (!v(15) || lm[15].y > shY + 0.35 * sw) && (!v(16) || lm[16].y > shY + 0.35 * sw);
    p.feetMode = v(27) && v(28);
    const feet = Math.abs(lm[27].x - lm[28].x);
    p.feetOut = p.feetMode && feet > 1.45 * sw;
    p.feetIn = p.feetMode && feet < 1.1 * sw;
    const open = p.armsUp && (!p.feetMode || p.feetOut);
    const closed = p.armsDown && (!p.feetMode || p.feetIn);
    return open ? 'open' : closed ? 'closed' : null;
  }

  step(dt) {
    const { G } = this;
    const { W, H, fx, audio } = G;
    for (const p of this.ps) {
      p.pulse = Math.max(0, p.pulse - dt * 3);
      const s = this.detect(p);
      if (s === 'open' && p.state !== 'open') {
        p.state = 'open';
        audio.tone(660, 0.08, { type: 'triangle', vol: 0.12 });
      } else if (s === 'closed' && p.state === 'open') {
        p.state = 'closed';
        p.score++;
        p.pulse = 1;
        audio.rep(p.score);
        const head = p.body.parts.head;
        const x = head.visible ? head.x : W / 2, y = head.visible ? head.y - head.r * 2 : H * 0.3;
        fx.burst(x, y, { n: 24, speed: 500, shape: 'star', size: 12, colors: this.multi ? [p.color, '#fff'] : undefined });
        if (p.score % 10 === 0) {
          fx.popup(x, H * 0.3, `${this.multi ? p.name + ': ' : ''}${p.score} REPS!`, { size: 90, color: this.multi ? p.color : '#ff8a00', life: 1.4 });
          fx.confetti(W, H, 60);
          audio.cheer();
        }
      }
    }
  }

  render(ctx) {
    const { G } = this;
    const { W, H, t } = G;
    if (!this.ps.length) {
      for (const b of G.body.active) drawSkeleton(ctx, b, { width: 8 });
    }
    for (const p of this.ps) {
      drawSkeleton(ctx, p.body, { color: p.state === 'open' ? '#ffcc00' : this.multi ? p.color : '#7df9ff', width: 8 });
    }

    // Big rep counters: right side for one player, outer edges for two.
    this.ps.forEach((p, i) => {
      const x = !this.multi ? W * 0.86 : i % 2 === 0 ? W * 0.1 : W * 0.9;
      const s = 1 + p.pulse * 0.3;
      text(ctx, String(p.score), x, H * 0.45, { size: H * 0.22 * s, color: this.multi ? p.color : '#ff8a00', stroke: '#fff', lw: 8 });
      text(ctx, this.multi ? p.name : 'REPS', x, H * 0.59, { size: H * 0.045, font: FONT_BODY });
      const pw = clamp(W * 0.15, 150, 280);
      const pill = (label, on, y) => {
        ctx.fillStyle = on ? '#7CFC00' : 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(x - pw / 2, y, pw, pw * 0.15, pw * 0.075);
        ctx.fill();
        text(ctx, label, x, y + pw * 0.077, { size: pw * 0.085, font: FONT_BODY, color: on ? '#0b3d00' : '#fff', stroke: null });
      };
      const feet = p.feetMode ? '' : ' (step back)';
      if (p.state === 'open') {
        pill('ARMS DOWN', p.armsDown, H * 0.64);
        pill('FEET TOGETHER' + feet, p.feetIn, H * 0.64 + pw * 0.19);
      } else {
        pill('ARMS UP', p.armsUp, H * 0.64);
        pill('FEET OUT' + feet, p.feetOut, H * 0.64 + pw * 0.19);
      }
    });

    // Demo figure: left panel for one player, bottom centre for two.
    const pw = clamp(W * (this.multi ? 0.1 : 0.16), 120, 300), ph = pw * (this.multi ? 1 : 1.1);
    const px = this.multi ? W / 2 - pw / 2 : 20, py = this.multi ? H - ph - 20 : H * 0.22;
    panel(ctx, px, py, pw, ph);
    text(ctx, 'DO THIS!', px + pw / 2, py + ph * 0.12, { size: pw * 0.11, color: '#ffcc00' });
    drawGuide(ctx, px + pw / 2, py + ph * 0.56, pw * 0.55, (Math.sin(t * Math.PI * 2 * 0.9) + 1) / 2);
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
