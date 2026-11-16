// audio.js — procedural WebAudio: no audio files. All sounds are synthesised
// (noise bursts, filtered clicks, low thumps). Silent no-op when no AudioContext.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      }
    } catch { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _noise(dur, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  _tone(freq, dur, gain, type = 'sine', slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  shot() { this._noise(0.09, 1800, 0.5); this._tone(160, 0.08, 0.4, 'sine', 60); }
  dryFire() { this._tone(1400, 0.03, 0.15, 'square'); }
  hit() { this._tone(2200, 0.05, 0.2, 'sine'); }
  reload() { this._tone(900, 0.04, 0.15, 'square'); setTimeout(() => this._tone(700, 0.04, 0.15, 'square'), 180); }
  step(surface = 'concrete') {
    this._noise(0.05, surface === 'gravel' ? 900 : 500, 0.12);
  }
  roundStart() { this._tone(220, 0.5, 0.25, 'sawtooth', 440); }
  buy() { this._tone(880, 0.07, 0.2, 'sine'); }
  plant() { this._tone(440, 0.12, 0.2, 'sine'); setTimeout(() => this._tone(440, 0.12, 0.2, 'sine'), 200); }
}
