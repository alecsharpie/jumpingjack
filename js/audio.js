// All sound is synthesised with WebAudio, so there are no sound files to load.
export class Sfx {
  constructor() {
    this.ac = null;
    this.muted = false;
    this.musicOn = false;
  }

  init() {
    if (this.ac) { this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ac.destination);
    this.sfxBus = this.ac.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ac.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    const len = this.ac.sampleRate;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  get now() { return this.ac ? this.ac.currentTime : 0; }

  tone(freq, dur, { type = 'sine', vol = 0.25, slide = null, at, delay = 0, bus } = {}) {
    if (!this.ac) return;
    const t0 = (at ?? this.ac.currentTime) + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1000, q = 1, type = 'lowpass', slide = null, at, delay = 0, bus } = {}) {
    if (!this.ac) return;
    const t0 = (at ?? this.ac.currentTime) + delay;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    f.Q.value = q;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // --- sound effects ---
  tick() { this.tone(1200, 0.05, { type: 'square', vol: 0.06 }); }
  select() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.09, delay: i * 0.06 })); }
  beep(high) { this.tone(high ? 1320 : 660, high ? 0.45 : 0.2, { type: 'square', vol: 0.12 }); }
  hit() {
    this.noise(0.14, { vol: 0.5, freq: 2500, slide: 300 });
    this.tone(160, 0.18, { type: 'sine', vol: 0.5, slide: 45 });
  }
  hurt() {
    this.tone(320, 0.45, { type: 'sawtooth', vol: 0.18, slide: 70 });
    this.noise(0.3, { vol: 0.2, freq: 600 });
  }
  pop(pitch = 1) {
    this.tone(500 * pitch, 0.09, { type: 'sine', vol: 0.35, slide: 1100 * pitch });
    this.noise(0.04, { vol: 0.15, freq: 4000, type: 'highpass' });
  }
  bomb() {
    this.noise(0.6, { vol: 0.6, freq: 1200, slide: 60 });
    this.tone(90, 0.5, { type: 'sine', vol: 0.5, slide: 30 });
  }
  bounce(pitch = 1) {
    this.tone(260 * pitch, 0.14, { type: 'triangle', vol: 0.4, slide: 140 * pitch });
    this.noise(0.05, { vol: 0.25, freq: 900 });
  }
  squeak() { this.tone(1700 + Math.random() * 600, 0.07, { type: 'triangle', vol: 0.05, slide: 2600 }); }
  whoosh() { this.noise(0.35, { vol: 0.18, freq: 400, slide: 3000, type: 'bandpass', q: 3 }); }
  whistle() {
    this.tone(2100, 0.25, { type: 'sine', vol: 0.18 });
    this.tone(2100, 0.5, { type: 'sine', vol: 0.18, delay: 0.3, slide: 1900 });
  }
  cheer() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.08 }));
    this.noise(1.2, { vol: 0.12, freq: 2500, type: 'bandpass', q: 0.5, delay: 0.1 });
  }
  rep(n) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const f = 440 * Math.pow(2, scale[n % scale.length] / 12);
    this.tone(f, 0.22, { type: 'square', vol: 0.1 });
    this.tone(f * 2, 0.22, { type: 'sine', vol: 0.12, delay: 0.05 });
  }

  // --- background music: a little four-on-the-floor loop ---
  startMusic(bpm = 120) {
    if (!this.ac || this.musicOn) return;
    this.musicOn = true;
    this.bpm = bpm;
    this.step = 0;
    this.nextT = this.ac.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this.timer);
  }

  schedule() {
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextT < this.ac.currentTime + 0.12) {
      this.playStep(this.step, this.nextT);
      this.nextT += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(s, at) {
    const bus = this.musicBus;
    const b = s % 16;
    const bar = Math.floor(s / 16);
    // A minor, F, C, G
    const roots = [110, 87.31, 130.81, 98];
    const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
    const root = roots[bar];
    if (b % 4 === 0) {
      this.tone(150, 0.16, { type: 'sine', vol: 0.9, slide: 40, at, bus });
    }
    if (b === 4 || b === 12) this.noise(0.13, { vol: 0.45, freq: 1800, type: 'bandpass', q: 0.8, at, bus });
    if (b % 4 === 2) this.noise(0.04, { vol: 0.25, freq: 7000, type: 'highpass', at, bus });
    if ([0, 3, 6, 8, 11, 14].includes(b)) {
      const f = b === 6 || b === 14 ? root * 2 : root;
      this.tone(f, 0.16, { type: 'sawtooth', vol: 0.22, at, bus });
    }
    if (b === 2 || b === 10 || b === 7) {
      for (const semi of chords[bar]) {
        this.tone(root * 4 * Math.pow(2, semi / 12), 0.12, { type: 'square', vol: 0.045, at, bus });
      }
    }
  }
}
