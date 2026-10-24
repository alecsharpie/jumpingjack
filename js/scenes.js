import { HoverButton, text, panel, FONT_BODY, clamp } from './fx.js';
import { drawSkeleton } from './body.js';

// Quick "can I see you?" check before the menu. Head and shoulders are enough.
export class CalibrateScene {
  constructor(G) {
    this.G = G;
    this.ok = 0;
    this.doneT = -1;
    this.skip = new HoverButton(G, { label: 'SKIP', icon: '⏭', color: '#5b5b7a', hold: 1.2, small: true, onSelect: () => G.go('menu') });
    this.buttons = [this.skip];
  }

  enter() { this.G.camDim = 0.3; }

  update(dt) {
    const { G } = this;
    const bw = Math.min(260, G.W * 0.2), bh = bw * 0.36;
    this.skip.set(G.W - bw - 24, 24, bw, bh);
    this.skip.update(dt);
    if (this.doneT >= 0) {
      this.doneT += dt;
      if (this.doneT > 1) G.go('menu');
      return;
    }
    if (G.body.upperBodyVisible()) this.ok += dt;
    else this.ok = Math.max(0, this.ok - dt * 0.6);
    if (this.ok >= 1) {
      this.doneT = 0;
      G.audio.cheer();
      const n = G.body.active.length;
      G.fx.popup(G.W / 2, G.H * 0.5, n > 1 ? `${n} PLAYERS!` : 'HELLO!', { size: 110, color: '#7CFC00', life: 1.2 });
    }
  }

  draw(ctx) {
    const { G } = this;
    const { W, H, body } = G;
    const seen = body.upperBodyVisible();
    for (const b of body.active) drawSkeleton(ctx, b, { color: seen ? '#7CFC00' : b.color });

    let msg, color = '#fff';
    if (!body.present) msg = 'Step in front of the camera';
    else if (!seen) msg = 'Get your head and shoulders in view';
    else { msg = 'Great! Hold still…'; color = '#7CFC00'; }
    text(ctx, 'GET READY', W / 2, H * 0.07, { size: clamp(W * 0.05, 36, 90), color: '#ffcc00' });
    text(ctx, msg, W / 2, H * 0.16, { size: clamp(W * 0.028, 22, 52), font: FONT_BODY, color, maxWidth: W * 0.6 });

    if (this.ok > 0 && this.doneT < 0) {
      const cx = W / 2, cy = H * 0.5, r = Math.min(W, H) * 0.08;
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#7CFC00';
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.ok); ctx.stroke();
    }

    text(ctx, 'Close up is fine. Step back for full-body games like Jumping Jacks. Up to 2 players!', W / 2, H * 0.95,
      { size: clamp(W * 0.014, 14, 26), font: FONT_BODY, color: '#d0d0ee', lw: 4, maxWidth: W * 0.9 });
  }
}

export class MenuScene {
  constructor(G) {
    this.G = G;
    this.buttons = G.games.map((g) => new HoverButton(G, {
      label: g.title, icon: g.icon, color: g.color, hold: 1.3, game: g,
      onSelect: () => G.go(g.id),
    }));
  }

  enter() {
    this.G.camDim = 0.2;
    for (const b of this.buttons) {
      const best = this.G.best(b.game.id);
      b.sub = best ? `BEST ${best}` : '';
    }
  }

  update(dt) {
    const { W, H } = this.G;
    // Arc of tiles over the player's head: the outer ones sit lower, nearer
    // where the hands reach, and the middle of the screen is left clear.
    const n = this.buttons.length;
    const span = W * 0.9;
    const tw = Math.min(clamp(W * 0.13, 110, 280), span / (n * 1.08)), th = tw * 1.1;
    this.buttons.forEach((b, i) => {
      const k = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
      const cx = W / 2 + k * (span - tw);
      const cy = H * 0.06 + th / 2 + Math.pow(Math.abs(k) * 2, 2) * H * 0.22;
      b.set(cx - tw / 2, cy - th / 2, tw, th);
      b.update(dt);
    });
  }

  draw(ctx) {
    const { W, H, t, body } = this.G;
    for (const b of this.buttons) b.draw(ctx, t);
    const hovered = this.buttons.find((b) => b.hover);
    const by = H * 0.86;
    if (hovered) {
      text(ctx, hovered.game.desc, W / 2, by, { size: clamp(W * 0.028, 20, 52), font: FONT_BODY, color: '#fff', maxWidth: W * 0.8 });
    } else {
      text(ctx, 'JUMPING JACK', W / 2, by - H * 0.02, { size: clamp(W * 0.05, 34, 96), color: '#ffcc00', stroke: '#7a1f00' });
      text(ctx, 'Hold your hand over a game to play', W / 2, by + H * 0.065, { size: clamp(W * 0.02, 16, 38), font: FONT_BODY });
    }
    const n = body.active.length;
    if (n) {
      const label = n > 1 ? `👥 ${n} PLAYERS` : '👤 1 PLAYER';
      text(ctx, label, W - 24, H - 28, { size: clamp(W * 0.016, 14, 30), font: FONT_BODY, align: 'right', color: n > 1 ? '#7CFC00' : '#d0d0ee', lw: 4 });
    }
  }
}

export class ResultsScene {
  constructor(G, { game, scores, label = 'SCORE', stats = [] }) {
    this.G = G;
    this.game = G.games.find((g) => g.id === game);
    this.scores = scores;
    this.label = label;
    this.stats = stats;
    this.t = 0;
    this.again = new HoverButton(G, { label: 'AGAIN', icon: '🔁', color: '#00b36b', hold: 1.2, onSelect: () => G.go(game) });
    this.menu = new HoverButton(G, { label: 'MENU', icon: '🏠', color: '#5b5bd6', hold: 1.2, onSelect: () => G.go('menu') });
    this.buttons = [this.again, this.menu];
  }

  enter() {
    const { G } = this;
    G.camDim = 0.45;
    const humans = this.scores.filter((s) => !s.cpu);
    this.top = Math.max(...humans.map((s) => s.score));
    this.best = G.best(this.game.id);
    this.record = this.top > this.best && this.top > 0;
    if (this.record) G.saveBest(this.game.id, this.top);

    // Head-to-head: who won?
    this.headline = '';
    if (this.scores.length > 1) {
      const max = Math.max(...this.scores.map((s) => s.score));
      const winners = this.scores.filter((s) => s.score === max);
      this.winner = winners.length === 1 ? winners[0] : null;
      this.headline = !this.winner ? "IT'S A DRAW!" : this.winner.name === 'YOU' ? 'YOU WIN!' : `${this.winner.name} WINS!`;
    }
    const celebrate = this.record || (this.winner && !this.winner.cpu);
    if (celebrate) setTimeout(() => { G.fx.confetti(G.W, G.H, 160); G.audio.cheer(); }, 900);
  }

  update(dt) {
    const { W, H } = this.G;
    this.t += dt;
    const bw = clamp(W * 0.16, 140, 300), bh = bw * 0.9;
    this.again.set(W * 0.13 - bw / 2 + 20, H * 0.12, bw, bh);
    this.menu.set(W * 0.87 - bw / 2 - 20, H * 0.12, bw, bh);
    this.again.update(dt);
    this.menu.update(dt);
  }

  draw(ctx) {
    const { W, H, t } = this.G;
    const pw = Math.min(W * 0.5, 760), ph = H * 0.66;
    const px = W / 2 - pw / 2, py = H * 0.17;
    const k = Math.min(1, this.t / 1.2);
    panel(ctx, px, py, pw, ph, { r: 30 });
    const g = this.game;
    text(ctx, `${g.icon} ${g.title}`, W / 2, py + ph * 0.1, { size: pw * 0.07, color: g.color, stroke: '#fff', lw: 3, maxWidth: pw * 0.9 });

    if (this.scores.length === 1) {
      const s = this.scores[0];
      text(ctx, s.name === 'TEAM' ? `TEAM ${this.label}` : this.label, W / 2, py + ph * 0.25, { size: pw * 0.045, font: FONT_BODY, color: '#d0d0ee' });
      text(ctx, String(Math.round(s.score * k)), W / 2, py + ph * 0.42, { size: pw * 0.17, color: '#ffcc00' });
    } else {
      text(ctx, this.headline, W / 2, py + ph * 0.24, { size: pw * 0.075 * (1 + Math.sin(t * 6) * 0.03), color: this.winner?.color || '#fff', stroke: '#000', maxWidth: pw * 0.9 });
      const n = this.scores.length;
      this.scores.forEach((s, i) => {
        const x = px + (pw * (i + 0.5)) / n;
        text(ctx, s.name, x, py + ph * 0.36, { size: pw * 0.05, font: FONT_BODY, color: s.color });
        text(ctx, String(Math.round(s.score * k)), x, py + ph * 0.47, { size: pw * 0.11, color: s === this.winner ? '#ffcc00' : '#fff' });
      });
    }
    if (this.record && this.t > 1) {
      const s = 1 + Math.sin(t * 8) * 0.06;
      text(ctx, '★ NEW RECORD! ★', W / 2, py + ph * 0.6, { size: pw * 0.055 * s, color: '#ff3d7f', stroke: '#fff', lw: 4 });
    } else {
      text(ctx, `BEST ${Math.max(this.best, this.top)}`, W / 2, py + ph * 0.6, { size: pw * 0.042, font: FONT_BODY });
    }
    this.stats.forEach((s, i) => {
      text(ctx, s, W / 2, py + ph * (0.73 + i * 0.08), { size: pw * 0.036, font: FONT_BODY, color: '#cfe8ff', lw: 4, maxWidth: pw * 0.92 });
    });
    this.again.draw(ctx, t);
    this.menu.draw(ctx, t);
  }
}
