import { HoverButton, text, panel, FONT_BODY, clamp } from './fx.js';
import { drawSkeleton } from './body.js';

// "Step back so I can see you" check before the menu.
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
    if (G.body.fullBodyVisible()) this.ok += dt;
    else this.ok = Math.max(0, this.ok - dt * 0.6);
    if (this.ok >= 1.5) {
      this.doneT = 0;
      G.audio.cheer();
      G.fx.popup(G.W / 2, G.H * 0.5, 'PERFECT!', { size: 110, color: '#7CFC00', life: 1.2 });
    }
  }

  draw(ctx) {
    const { G } = this;
    const { W, H, body } = G;
    const full = body.fullBodyVisible();
    // Ghost outline the player should fill
    const gh = H * 0.86, gw = gh * 0.42;
    ctx.save();
    ctx.setLineDash([18, 14]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = full ? '#7CFC00' : 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - gw / 2, H * 0.08, gw, gh, 40);
    ctx.stroke();
    ctx.restore();

    drawSkeleton(ctx, body, { color: full ? '#7CFC00' : '#7df9ff' });

    let msg, color = '#fff';
    if (!body.present) msg = 'Step in front of the camera';
    else if (!full) msg = 'Step back. I need to see you from head to toe';
    else { msg = 'Great! Hold still…'; color = '#7CFC00'; }
    text(ctx, 'GET READY', W / 2, H * 0.07, { size: clamp(W * 0.05, 36, 90), color: '#ffcc00' });
    text(ctx, msg, W / 2, H * 0.16, { size: clamp(W * 0.028, 22, 52), font: FONT_BODY, color, maxWidth: W * 0.6 });

    if (this.ok > 0 && this.doneT < 0) {
      const cx = W / 2, cy = H * 0.5, r = Math.min(W, H) * 0.08;
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#7CFC00';
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * this.ok) / 1.5); ctx.stroke();
    }

    text(ctx, 'Tip: use a bright room, and keep the camera at the front centre of the TV', W / 2, H * 0.95,
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
    const tw = clamp(W * 0.13, 120, 280), th = tw * 1.1;
    const span = Math.min(W * 0.8, n * tw * 1.18);
    this.buttons.forEach((b, i) => {
      const k = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
      const cx = W / 2 + k * (span - tw);
      const cy = H * 0.07 + th / 2 + Math.pow(Math.abs(k) * 2, 2) * H * 0.2;
      b.set(cx - tw / 2, cy - th / 2, tw, th);
      b.update(dt);
    });
  }

  draw(ctx) {
    const { W, H, t } = this.G;
    for (const b of this.buttons) b.draw(ctx, t);
    const hovered = this.buttons.find((b) => b.hover);
    const by = H * 0.86;
    if (hovered) {
      text(ctx, hovered.game.desc, W / 2, by, { size: clamp(W * 0.028, 20, 52), font: FONT_BODY, color: '#fff', maxWidth: W * 0.8 });
    } else {
      text(ctx, 'JUMPING JACK', W / 2, by - H * 0.02, { size: clamp(W * 0.05, 34, 96), color: '#ffcc00', stroke: '#7a1f00' });
      text(ctx, 'Hold your hand over a game to play', W / 2, by + H * 0.065, { size: clamp(W * 0.02, 16, 38), font: FONT_BODY });
    }
  }
}

export class ResultsScene {
  constructor(G, { game, score, label = 'SCORE', stats = [] }) {
    this.G = G;
    this.game = G.games.find((g) => g.id === game);
    this.score = score;
    this.label = label;
    this.stats = stats;
    this.shown = 0;
    this.t = 0;
    this.again = new HoverButton(G, { label: 'AGAIN', icon: '🔁', color: '#00b36b', hold: 1.2, onSelect: () => G.go(game) });
    this.menu = new HoverButton(G, { label: 'MENU', icon: '🏠', color: '#5b5bd6', hold: 1.2, onSelect: () => G.go('menu') });
    this.buttons = [this.again, this.menu];
  }

  enter() {
    const { G } = this;
    G.camDim = 0.45;
    this.best = G.best(this.game.id);
    this.record = this.score > this.best && this.score > 0;
    if (this.record) {
      G.saveBest(this.game.id, this.score);
      setTimeout(() => { G.fx.confetti(G.W, G.H, 160); G.audio.cheer(); }, 900);
    }
  }

  update(dt) {
    const { W, H } = this.G;
    this.t += dt;
    this.shown = Math.min(this.score, Math.round(this.score * Math.min(1, this.t / 1.2)));
    const bw = clamp(W * 0.16, 140, 300), bh = bw * 0.9;
    this.again.set(W * 0.17 - bw / 2, H * 0.12, bw, bh);
    this.menu.set(W * 0.83 - bw / 2, H * 0.12, bw, bh);
    this.again.update(dt);
    this.menu.update(dt);
  }

  draw(ctx) {
    const { W, H, t } = this.G;
    const pw = Math.min(W * 0.5, 760), ph = H * 0.6;
    const px = W / 2 - pw / 2, py = H * 0.2;
    panel(ctx, px, py, pw, ph, { r: 30 });
    const g = this.game;
    text(ctx, `${g.icon} ${g.title}`, W / 2, py + ph * 0.12, { size: pw * 0.07, color: g.color, stroke: '#fff', lw: 3, maxWidth: pw * 0.9 });
    text(ctx, this.label, W / 2, py + ph * 0.28, { size: pw * 0.045, font: FONT_BODY, color: '#d0d0ee' });
    text(ctx, String(this.shown), W / 2, py + ph * 0.45, { size: pw * 0.17, color: '#ffcc00' });
    if (this.record && this.t > 1) {
      const s = 1 + Math.sin(t * 8) * 0.06;
      text(ctx, '★ NEW RECORD! ★', W / 2, py + ph * 0.62, { size: pw * 0.06 * s, color: '#ff3d7f', stroke: '#fff', lw: 4 });
    } else {
      text(ctx, `BEST ${Math.max(this.best, this.score)}`, W / 2, py + ph * 0.62, { size: pw * 0.045, font: FONT_BODY });
    }
    this.stats.forEach((s, i) => {
      text(ctx, s, W / 2, py + ph * (0.76 + i * 0.08), { size: pw * 0.038, font: FONT_BODY, color: '#cfe8ff', lw: 4 });
    });
    this.again.draw(ctx, t);
    this.menu.draw(ctx, t);
  }
}
