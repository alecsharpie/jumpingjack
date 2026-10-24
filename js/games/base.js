import { HoverButton, text, panel, FONT_BODY, clamp } from '../fx.js';
import { PLAYER_COLORS } from '../body.js';

// Shared game flow: title card → 3‑2‑1 countdown → play → "time up" → results.
// Whoever is in front of the camera at "GO!" plays; this.ps holds one entry per player
// ({ body, name, color, score, lives, out }), sorted left to right. Team games share a single entry.
// Subclasses implement setup(), begin(), step(dt), render(ctx) and optionally idle(dt) and stats().
export class GameBase {
  constructor(G, cfg) {
    this.G = G;
    Object.assign(this, {
      duration: 60, lives: 0, scoreLabel: 'SCORE', how: '', bpm: 120, camDim: 0, color: '#ff3d7f',
      maxPlayers: 4, team: false, usesHands: false,
    }, cfg);
    this.quitBtn = new HoverButton(G, { label: 'MENU', icon: '🏠', color: '#3a3a5a', hold: 1.8, small: true, onSelect: () => G.go('menu') });
    this.buttons = [this.quitBtn];
  }

  enter() {
    this.phase = 'intro';
    this.phaseT = 0;
    this.timeLeft = this.duration;
    this.count = 0;
    this.lastSec = -1;
    this.ps = [];
    this.bodies = [];
    this.multi = false;
    this.G.camDim = this.camDim;
    this.setup();
  }

  exit() { this.G.audio.stopMusic(); }

  setup() {}
  begin() {}
  idle() {}
  step() {}
  render() {}
  stats() { return []; }

  get playing() { return this.phase === 'play'; }
  get ready() { return !this.usesHands || !!this.G.gestures; }
  get alive() { return this.ps.filter((p) => !p.out); }

  assignPlayers() {
    const { G } = this;
    let bodies = G.body.active.slice(0, this.maxPlayers);
    if (!bodies.length) bodies = [G.body.players[0]];
    bodies.sort((a, b) => (a.anchor?.x ?? 0) - (b.anchor?.x ?? 0));
    bodies.forEach((b, i) => { b.color = PLAYER_COLORS[i]; });
    this.bodies = bodies;
    this.multi = bodies.length > 1;
    const entry = (extra) => ({ score: 0, lives: this.lives, out: false, ...extra });
    this.ps = this.team
      ? [entry({ idx: 0, name: this.multi ? 'TEAM' : this.scoreLabel, color: '#ffcc00', body: null })]
      : bodies.map((body, i) => entry({ idx: i, body, name: this.multi ? `P${i + 1}` : this.scoreLabel, color: PLAYER_COLORS[i] }));
  }

  // Which player a body part belongs to (null for someone not in this game).
  ownerOf(part) {
    if (this.team || !this.multi) return this.ps[0];
    return this.ps.find((p) => p.body === part.body) || null;
  }

  // Which player a recognised hand belongs to: the nearest tracked hand, else by side of the screen.
  handOwner(h) {
    const humans = this.ps.filter((p) => p.body);
    if (humans.length <= 1) return humans[0] || this.ps[0];
    let best = null, bestD = Infinity;
    for (const p of humans) {
      for (const part of [p.body.parts.lhand, p.body.parts.rhand]) {
        if (!part.visible) continue;
        const d = Math.hypot(part.x - h.x, part.y - h.y);
        if (d < bestD && d < part.r * 3) { best = p; bestD = d; }
      }
    }
    return best || humans[clamp(Math.floor((h.x / this.G.W) * humans.length), 0, humans.length - 1)];
  }

  handsOf(p) { return (this.G.hands || []).filter((h) => this.handOwner(h) === p); }

  addScore(p, n, x, y, color = '#ffe066') {
    if (!p) return;
    p.score = Math.max(0, p.score + n);
    if (x != null) this.G.fx.popup(x, y, (n > 0 ? '+' : '') + n, { color: this.multi && !this.team ? p.color : color, size: 38 });
  }

  loseLife(p) {
    if (!this.lives || !this.playing || !p || p.out) return;
    p.lives--;
    this.G.audio.hurt();
    this.G.fx.flash('#ff0033', 0.4);
    this.G.fx.shake(20);
    if (p.lives <= 0) {
      p.out = true;
      if (this.multi && !this.team) this.G.fx.popup(this.G.W / 2, this.G.H * 0.35, `${p.name} IS OUT!`, { size: 80, color: p.color, life: 1.5 });
    }
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
      if (!this.ready) this.phaseT = Math.min(this.phaseT, 2.4);
      this.idle(dt);
      if (this.phaseT >= 2.5) {
        const n = Math.ceil(5.5 - this.phaseT);
        if (n !== this.count && n > 0) { this.count = n; G.audio.beep(false); }
      }
      if (this.phaseT >= 5.5) {
        this.phase = 'play';
        this.phaseT = 0;
        this.assignPlayers();
        G.audio.beep(true);
        G.fx.popup(W / 2, H / 2, 'GO!', { size: 180, color: '#7CFC00', life: 0.9 });
        G.audio.startMusic(this.bpm);
        this.begin();
      }
    } else if (this.phase === 'play') {
      if (this.duration) this.timeLeft -= dt;
      this.step(dt);
      const sec = Math.ceil(this.timeLeft);
      if (this.duration && sec <= 5 && sec > 0 && sec !== this.lastSec) { this.lastSec = sec; G.audio.tick(); }
      if (this.lives && this.ps.every((p) => p.out)) this.finish('GAME OVER');
      else if (this.duration && this.timeLeft <= 0) { this.timeLeft = 0; this.finish('TIME UP!'); }
    } else if (this.phase === 'over') {
      this.idle(dt);
      if (this.phaseT > 2.6) {
        G.go('results', {
          game: this.id, label: this.scoreLabel, stats: this.stats(),
          scores: this.ps.map((p) => ({ name: p.name, score: Math.round(p.score), color: p.color, cpu: !!p.cpu })),
        });
      }
    }
  }

  drawPlayerPanel(ctx, p, i, big) {
    const pw = big * 6.4, ph = big * 1.6;
    const right = i % 2 === 1;
    const x = right ? this.quitBtn.x - pw - 16 : 20;
    const y = 20 + Math.floor(i / 2) * (ph + big * 1.2);
    panel(ctx, x, y, pw, ph, { r: 16, stroke: this.multi || p.cpu ? p.color : undefined });
    text(ctx, p.name, x + big * 0.4, y + big * 0.8, { size: big * 0.45, align: 'left', font: FONT_BODY, color: this.multi || p.cpu ? p.color : '#d0d0ee', lw: 3 });
    text(ctx, String(Math.round(p.score)), x + pw - big * 0.4, y + big * 0.82, { size: big, align: 'right', color: '#ffcc00', alpha: p.out ? 0.4 : 1 });
    if (this.lives) {
      ctx.font = `${big * 0.6}px sans-serif`;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      let s = '';
      for (let k = 0; k < this.lives; k++) s += k < p.lives ? '❤️' : '🖤';
      ctx.fillText(s, right ? x + pw : x, y + ph + big * 0.5);
    }
    if (p.out) text(ctx, 'OUT', x + pw / 2, y + ph / 2, { size: big * 0.8, color: '#ff4d4d', stroke: '#fff', lw: 3 });
  }

  draw(ctx) {
    const { G } = this;
    const { W, H, t } = G;
    this.render(ctx);
    const big = clamp(W * 0.03, 22, 60);

    this.ps.forEach((p, i) => this.drawPlayerPanel(ctx, p, i, big));
    if (this.duration) {
      const sec = Math.ceil(this.timeLeft);
      const urgent = this.playing && sec <= 5;
      text(ctx, `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, W / 2, 20 + big * 0.8,
        { size: big * (urgent ? 1.3 + Math.sin(t * 20) * 0.08 : 1.15), color: urgent ? '#ff4d4d' : '#fff' });
    }
    this.quitBtn.draw(ctx, t);

    if (this.phase === 'intro') {
      if (this.phaseT < 2.5) {
        const pw = Math.min(W * 0.7, 1000), ph = H * 0.4;
        const k = Math.min(1, this.phaseT * 4);
        ctx.save();
        ctx.translate(W / 2, H * 0.5);
        ctx.scale(k, k);
        panel(ctx, -pw / 2, -ph / 2, pw, ph, { r: 30, stroke: this.color });
        text(ctx, this.title, 0, -ph * 0.24, { size: pw * 0.09, color: this.color, stroke: '#fff', lw: 4, maxWidth: pw * 0.9 });
        text(ctx, this.how, 0, ph * 0.02, { size: pw * 0.036, font: FONT_BODY, maxWidth: pw * 0.92 });
        const n = Math.min(G.body.active.length, this.maxPlayers);
        const who = !this.ready ? '⏳ Loading hand tracking…'
          : n >= 2 ? `👥 ${n} PLAYERS: ${this.team ? 'TEAM UP!' : 'VERSUS!'}`
          : this.maxPlayers > 1 ? '👤 1 PLAYER · a friend can step in to join' : '👤 1 PLAYER';
        text(ctx, who, 0, ph * 0.3, { size: pw * 0.032, font: FONT_BODY, color: n >= 2 ? '#7CFC00' : '#d0d0ee', maxWidth: pw * 0.9 });
        ctx.restore();
      } else if (this.count > 0) {
        const f = (this.phaseT - 2.5) % 1;
        text(ctx, String(this.count), W / 2, H / 2, { size: H * (0.3 + f * 0.1), color: '#ffcc00', alpha: 1 - f * 0.5, lw: 14 });
      }
    } else if (this.phase === 'over') {
      const k = Math.min(1, this.phaseT * 3);
      text(ctx, this.overMsg, W / 2, H * 0.45, { size: H * 0.16 * (0.6 + 0.4 * k), color: '#ff3d7f', stroke: '#fff', lw: 8, maxWidth: W * 0.9 });
    }
  }
}
