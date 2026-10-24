import { GameBase } from './base.js';
import { drawHand } from '../gestures.js';
import { pick, clamp, text, FONT_BODY } from '../fx.js';

const THROWS = { Closed_Fist: 'rock', Open_Palm: 'paper', Victory: 'scissors' };
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const WORDS = ['ROCK…', 'PAPER…', 'SCISSORS…', 'SHOOT!'];
const BEAT = 0.55;     // seconds per chant word
const WINDOW = 0.5;    // how long after "SHOOT!" we read your hand
const REVEAL = 2.2;
const WIN = 3;

// Rock paper scissors against the computer, or against a friend standing next to you.
export class RockPaperScissors extends GameBase {
  constructor(G) {
    super(G, { id: 'rps', title: 'ROCK PAPER SCISSORS', duration: 0, maxPlayers: 2, usesHands: true, color: '#f15bb5', bpm: 100,
      scoreLabel: 'WINS', camDim: 0.1,
      how: `Throw ✊ ✋ or ✌️ on "SHOOT!". First to ${WIN} wins. Two players? Face off!` });
  }

  get humans() { return this.ps.filter((p) => !p.cpu); }

  begin() {
    this.vsCpu = this.ps.length === 1;
    if (this.vsCpu) {
      this.ps[0].name = 'YOU';
      this.ps.push({ idx: 1, name: 'CPU', color: '#c0c0d0', score: 0, lives: 0, out: false, cpu: true, body: null });
    }
    this.draws = 0;
    this.newRound();
  }

  stats() {
    return [`Rounds drawn: ${this.draws}`];
  }

  newRound() {
    this.r = { t: 0, said: -1, counts: this.humans.map(() => ({})), picks: null, result: '', winner: -1 };
  }

  // Screen x for each side's big reveal emoji.
  sideX(i) {
    const { W } = this.G;
    if (this.vsCpu) return i === 0 ? W * 0.22 : W * 0.78;
    const p = this.ps[i];
    const head = p.body?.parts.head;
    return head?.visible ? head.x : i === 0 ? W * 0.25 : W * 0.75;
  }

  step(dt) {
    const { G } = this;
    const { audio } = G;
    const r = this.r;
    r.t += dt;
    const k = Math.floor(r.t / BEAT);
    if (k < 4 && k !== r.said) { r.said = k; audio.beep(k === 3); }
    const shoot = BEAT * 3;
    if (r.t >= shoot && r.t < shoot + WINDOW) {
      this.humans.forEach((p, i) => {
        for (const h of this.handsOf(p)) {
          const th = THROWS[h.gesture];
          if (th) r.counts[i][th] = (r.counts[i][th] || 0) + 1;
        }
      });
    }
    if (!r.picks && r.t >= shoot + WINDOW) this.resolve();
    if (r.picks && r.t >= shoot + WINDOW + REVEAL) {
      const champ = this.ps.find((p) => p.score >= WIN);
      if (champ) this.finish(this.vsCpu ? (champ.cpu ? 'CPU WINS!' : 'YOU WIN! 🏆') : `${champ.name} WINS! 🏆`);
      else this.newRound();
    }
  }

  resolve() {
    const { G } = this;
    const { fx, audio, H } = G;
    const r = this.r;
    // Each player's throw is whatever we saw most during the window.
    r.picks = r.counts.map((c) => Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null);
    if (this.vsCpu) r.picks.push(pick(['rock', 'paper', 'scissors']));
    if (r.picks.some((x) => !x)) {
      r.result = "DIDN'T SEE A THROW. AGAIN!";
      audio.tone(220, 0.25, { type: 'sawtooth', vol: 0.1, slide: 140 });
      return;
    }
    const [a, b] = r.picks;
    if (a === b) {
      r.result = 'DRAW!';
      this.draws++;
      audio.tone(440, 0.3, { type: 'triangle', vol: 0.15 });
      return;
    }
    r.winner = BEATS[a] === b ? 0 : 1;
    const w = this.ps[r.winner];
    w.score++;
    r.result = this.vsCpu ? (w.cpu ? 'CPU WINS THE ROUND' : 'YOU WIN THE ROUND!') : `${w.name} WINS THE ROUND!`;
    fx.burst(this.sideX(r.winner), H * 0.45, { n: 40, shape: 'star', size: 14, colors: [w.color, '#fff', '#ffcc00'] });
    if (w.cpu) audio.hurt(); else audio.cheer();
  }

  render(ctx) {
    const { G } = this;
    const { W, H, t } = G;
    for (const h of G.hands) {
      const owner = this.ps.length ? this.handOwner(h) : null;
      drawHand(ctx, h, owner && this.multi ? owner.color : '#ffcc00');
    }
    if (!this.playing || !this.r) return;
    const r = this.r;
    const big = clamp(H * 0.2, 90, 260);

    if (!r.picks) {
      const k = Math.min(3, Math.floor(r.t / BEAT));
      const f = (r.t % BEAT) / BEAT;
      text(ctx, WORDS[k], W / 2, H * 0.3, { size: H * (k === 3 ? 0.15 : 0.11) * (1.15 - f * 0.15), color: k === 3 ? '#ff3d7f' : '#fff', lw: 10 });
      if (this.vsCpu) {
        // The CPU pumps its fist in time with the chant.
        const bob = Math.abs(Math.sin((r.t / BEAT) * Math.PI)) * H * 0.06;
        ctx.font = `${big}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✊', this.sideX(1), H * 0.5 - bob);
        text(ctx, 'CPU', this.sideX(1), H * 0.5 + big * 0.7, { size: big * 0.22, color: '#c0c0d0' });
      }
    } else {
      r.picks.forEach((pk, i) => {
        if (!pk) return;
        const x = this.sideX(i);
        const win = r.winner === i;
        const s = win ? 1 + Math.sin(t * 10) * 0.05 : 1;
        ctx.save();
        ctx.globalAlpha = r.winner >= 0 && !win ? 0.5 : 1;
        ctx.font = `${big * s}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(EMOJI[pk], x, H * 0.5);
        ctx.restore();
        text(ctx, this.ps[i].name, x, H * 0.5 + big * 0.7, { size: big * 0.22, color: this.ps[i].color });
      });
      text(ctx, r.result, W / 2, H * 0.22, { size: clamp(W * 0.04, 28, 80), color: '#ffcc00', maxWidth: W * 0.9 });
    }
    text(ctx, '✊ rock   ✋ paper   ✌️ scissors', W / 2, H * 0.92, { size: clamp(W * 0.018, 16, 34), font: FONT_BODY, color: '#d0d0ee', lw: 4 });
  }
}
