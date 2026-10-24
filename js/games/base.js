import { HoverButton, text, panel, FONT_BODY, clamp } from '../fx.js';

// Shared game flow: title card → 3‑2‑1 countdown → play → "time up" → results.
// Subclasses implement setup(), step(dt), render(ctx) and optionally idle(dt) and stats().
export class GameBase {
  constructor(G, cfg) {
    this.G = G;
    Object.assign(this, { duration: 60, lives: 0, scoreLabel: 'SCORE', how: '', bpm: 120, camDim: 0, color: '#ff3d7f' }, cfg);
    this.quitBtn = new HoverButton(G, { label: 'MENU', icon: '🏠', color: '#3a3a5a', hold: 1.8, small: true, onSelect: () => G.go('menu') });
    this.buttons = [this.quitBtn];
  }

  enter() {
    this.phase = 'intro';
    this.phaseT = 0;
    this.timeLeft = this.duration;
    this.score = 0;
    this.livesLeft = this.lives;
    this.count = 0;
    this.lastSec = -1;
    this.G.camDim = this.camDim;
    this.setup();
  }

  exit() { this.G.audio.stopMusic(); }

  setup() {}
  idle() {}
  step() {}
  render() {}
  stats() { return []; }

  get playing() { return this.phase === 'play'; }

  addScore(n, x, y, color = '#ffe066') {
    this.score = Math.max(0, this.score + n);
    if (x != null) this.G.fx.popup(x, y, (n > 0 ? '+' : '') + n, { color, size: 38 });
  }

  loseLife() {
    if (!this.lives || !this.playing) return;
    this.livesLeft--;
    this.G.audio.hurt();
    this.G.fx.flash('#ff0033', 0.4);
    this.G.fx.shake(20);
  }

  finish(msg) {
    if (!this.playing) return;
    this.phase = 'over';
    this.phaseT = 0;
    this.overMsg = msg;
    this.G.audio.stopMusic();
    this.G.audio.whistle();
  }

  update(dt) {
    const { G } = this;
    const { W, H } = G;
    this.phaseT += dt;
    const qw = clamp(W * 0.11, 110, 200);
    this.quitBtn.set(W - qw - 20, 20, qw, qw * 0.4);
    this.quitBtn.update(dt);

    if (this.phase === 'intro') {
      this.idle(dt);
      if (this.phaseT >= 2.5) {
        const n = Math.ceil(5.5 - this.phaseT);
        if (n !== this.count && n > 0) { this.count = n; G.audio.beep(false); }
      }
      if (this.phaseT >= 5.5) {
        this.phase = 'play';
        this.phaseT = 0;
        G.audio.beep(true);
        G.fx.popup(W / 2, H / 2, 'GO!', { size: 180, color: '#7CFC00', life: 0.9 });
        G.audio.startMusic(this.bpm);
        this.begin?.();
      }
    } else if (this.phase === 'play') {
      this.timeLeft -= dt;
      this.step(dt);
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec > 0 && sec !== this.lastSec) { this.lastSec = sec; G.audio.tick(); }
      if (this.lives && this.livesLeft <= 0) this.finish('GAME OVER');
      else if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish('TIME UP!'); }
    } else if (this.phase === 'over') {
      this.idle(dt);
      if (this.phaseT > 2.6) {
        G.go('results', { game: this.id, score: Math.round(this.score), label: this.scoreLabel, stats: this.stats() });
      }
    }
  }

  draw(ctx) {
    const { G } = this;
    const { W, H, t } = G;
    this.render(ctx);
    const big = clamp(W * 0.03, 22, 60);

    // HUD
    panel(ctx, 20, 20, big * 6.4, big * 1.6, { r: 16 });
    text(ctx, this.scoreLabel, 20 + big * 0.4, 20 + big * 0.8, { size: big * 0.45, align: 'left', font: FONT_BODY, color: '#d0d0ee', lw: 3 });
    text(ctx, String(Math.round(this.score)), 20 + big * 6, 20 + big * 0.82, { size: big, align: 'right', color: '#ffcc00' });

    const sec = Math.ceil(this.timeLeft);
    const urgent = this.playing && sec <= 5;
    text(ctx, `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, W / 2, 20 + big * 0.8,
      { size: big * (urgent ? 1.3 + Math.sin(t * 20) * 0.08 : 1.15), color: urgent ? '#ff4d4d' : '#fff' });

    if (this.lives) {
      ctx.font = `${big * 0.9}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const hx = this.quitBtn.x - 16;
      let s = '';
      for (let i = 0; i < this.lives; i++) s += i < this.livesLeft ? '❤️' : '🖤';
      ctx.fillText(s, hx, 20 + big * 0.8);
    }
    this.quitBtn.draw(ctx, t);

    if (this.phase === 'intro') {
      if (this.phaseT < 2.5) {
        const pw = Math.min(W * 0.7, 1000), ph = H * 0.34;
        const k = Math.min(1, this.phaseT * 4);
        ctx.save();
        ctx.translate(W / 2, H * 0.5);
        ctx.scale(k, k);
        panel(ctx, -pw / 2, -ph / 2, pw, ph, { r: 30, stroke: this.color });
        text(ctx, this.title, 0, -ph * 0.17, { size: pw * 0.09, color: this.color, stroke: '#fff', lw: 4, maxWidth: pw * 0.9 });
        text(ctx, this.how, 0, ph * 0.2, { size: pw * 0.04, font: FONT_BODY, maxWidth: pw * 0.9 });
        ctx.restore();
      } else if (this.count > 0) {
        const f = (this.phaseT - 2.5) % 1;
        text(ctx, String(this.count), W / 2, H / 2, { size: H * (0.3 + f * 0.1), color: '#ffcc00', alpha: 1 - f * 0.5, lw: 14 });
      }
    } else if (this.phase === 'over') {
      const k = Math.min(1, this.phaseT * 3);
      text(ctx, this.overMsg, W / 2, H * 0.45, { size: H * 0.16 * (0.6 + 0.4 * k), color: '#ff3d7f', stroke: '#fff', lw: 8 });
    }
  }
}
