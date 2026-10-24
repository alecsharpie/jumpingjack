import { GameBase } from './base.js';
import { GESTURES, drawHand } from '../gestures.js';
import { pick, clamp, text, panel, FONT_BODY } from '../fx.js';

const SIGNS = Object.keys(GESTURES);

// A hand sign is shown; copy it as fast as you can. With friends, the first to match gets a bonus.
export class HandSigns extends GameBase {
  constructor(G) {
    super(G, { id: 'handsigns', title: 'HAND SIGNS', duration: 45, color: '#00bbf9', bpm: 116, usesHands: true, camDim: 0.1,
      how: 'Copy the hand sign as fast as you can! Hold your hand up with your palm towards the camera.' });
  }

  setup() {
    this.card = null;
    this.elapsed = 0;
    this.noHandsT = 0;
  }

  begin() {
    for (const p of this.ps) Object.assign(p, { matchT: 0, done: false, hits: 0, firsts: 0 });
    this.nextCard();
  }

  stats() {
    if (!this.multi) return [`Signs matched: ${this.ps[0].hits}`];
    return this.ps.map((p) => `${p.name}: ${p.hits} matched · ${p.firsts} first`);
  }

  nextCard() {
    const prev = this.card?.sign;
    let sign;
    do sign = pick(SIGNS); while (sign === prev);
    this.card = { sign, t: 0, limit: clamp(4.5 - this.elapsed * 0.05, 2.2, 4.5), doneT: -1, first: null };
    for (const p of this.ps) { p.matchT = 0; p.done = false; }
    this.G.audio.tone(880, 0.1, { type: 'triangle', vol: 0.12 });
  }

  step(dt) {
    const { G } = this;
    const { fx, audio, W, H } = G;
    this.elapsed += dt;
    this.noHandsT = G.hands.length ? 0 : this.noHandsT + dt;
    const c = this.card;
    c.t += dt;
    if (c.doneT >= 0) {
      c.doneT += dt;
      if (c.doneT > 0.6) this.nextCard();
      return;
    }
    for (const p of this.ps) {
      if (p.done) continue;
      const h = this.handsOf(p).find((h) => h.gesture === c.sign);
      // Must hold the sign briefly so a flicker of the recogniser doesn't count.
      p.matchT = h ? p.matchT + dt : Math.max(0, p.matchT - dt);
      if (h && p.matchT >= 0.2) {
        p.done = true;
        p.hits++;
        let pts = Math.round(100 + 200 * Math.max(0, 1 - c.t / c.limit));
        if (this.multi && !c.first) {
          c.first = p;
          p.firsts++;
          pts += 100;
          fx.popup(h.x, h.y - h.size * 3.2, 'FIRST!', { size: 50, color: p.color });
        }
        this.addScore(p, pts, h.x, h.y - h.size * 2);
        fx.burst(h.x, h.y, { n: 24, shape: 'star', size: 12, colors: this.multi ? [p.color, '#fff'] : undefined });
        audio.rep(p.hits);
      }
    }
    if (this.ps.every((p) => p.done)) {
      c.doneT = 0;
    } else if (c.t >= c.limit) {
      c.doneT = 0;
      fx.popup(W / 2, H * 0.5, 'TOO SLOW!', { size: 70, color: '#ff4d4d' });
      audio.tone(220, 0.25, { type: 'sawtooth', vol: 0.1, slide: 140 });
    }
  }

  render(ctx) {
    const { G } = this;
    const { W, H, t } = G;
    for (const h of G.hands) {
      const owner = this.ps.length ? this.handOwner(h) : null;
      drawHand(ctx, h, owner && this.multi ? owner.color : '#ffcc00');
    }
    const c = this.card;
    if (!c || !this.playing) return;

    const cw = clamp(W * 0.2, 200, 380), ch = cw * 1.05;
    const cx = W / 2 - cw / 2, cy = H * 0.12;
    const solved = this.ps.every((p) => p.done);
    const pop = c.t < 0.15 ? 0.6 + (c.t / 0.15) * 0.4 : 1;
    ctx.save();
    ctx.translate(W / 2, cy + ch / 2);
    ctx.scale(pop, pop);
    ctx.translate(-W / 2, -(cy + ch / 2));
    panel(ctx, cx, cy, cw, ch, { r: 26, stroke: solved ? '#7CFC00' : '#00bbf9', fill: 'rgba(10,10,30,0.8)' });
    ctx.font = `${cw * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GESTURES[c.sign].emoji, W / 2, cy + ch * 0.42);
    text(ctx, GESTURES[c.sign].name, W / 2, cy + ch * 0.8, { size: cw * 0.1, maxWidth: cw * 0.9 });
    // Time left
    const k = Math.max(0, 1 - c.t / c.limit);
    ctx.fillStyle = k < 0.3 ? '#ff4d4d' : '#00bbf9';
    ctx.fillRect(cx + 14, cy + ch - 18, (cw - 28) * (c.doneT >= 0 ? 0 : k), 8);
    ctx.restore();

    if (this.multi) {
      this.ps.forEach((p, i) => {
        const x = W / 2 + (i - (this.ps.length - 1) / 2) * cw * 0.5;
        text(ctx, `${p.name} ${p.done ? '✓' : '…'}`, x, cy + ch + 34, { size: 30, font: FONT_BODY, color: p.done ? p.color : '#888' });
      });
    } else if (solved) {
      text(ctx, '✓', W / 2 + cw * 0.42, cy + 10, { size: cw * 0.3, color: '#7CFC00' });
    }

    if (this.noHandsT > 1.5 && Math.sin(t * 5) > -0.3) {
      text(ctx, '✋ Hold your hand up towards the camera', W / 2, H * 0.88, { size: clamp(W * 0.02, 16, 40), font: FONT_BODY, color: '#ffcc00' });
    }
  }
}
