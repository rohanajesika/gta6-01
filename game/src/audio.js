// Synthesised sound: every effect is generated with WebAudio, no audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.sirenOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _noiseBuffer(seconds = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  click() { this._blip(660, 0.07, 'square', 0.12); }
  pickup() { this._blip(520, 0.09, 'sine', 0.2, 880); setTimeout(() => this._blip(880, 0.12, 'sine', 0.2, 1320), 80); }
  punch() { this._noise(0.12, 0.5, 300); }
  shot() { this._noise(0.18, 0.7, 1800, 'highpass'); this._blip(160, 0.1, 'square', 0.25, 60); }
  crash() { this._noise(0.35, 0.6, 500); this._blip(90, 0.25, 'sawtooth', 0.3, 40); }
  honk() { this._blip(370, 0.18, 'square', 0.15); this._blip(466, 0.18, 'square', 0.12); }
  busted() { this._blip(220, 0.4, 'sawtooth', 0.25, 110); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'triangle', 0.22), i * 110));
  }

  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55;
    o2.type = 'square'; o2.frequency.value = 28;
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.value = 0.0;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
    o.start(); o2.start();
    this.engineOsc = o; this.engineOsc2 = o2; this.engineGain = g; this.engineFilter = f;
  }

  engineSet(speedNorm, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = on ? 0.05 + speedNorm * 0.09 : 0.0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 130, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(25 + speedNorm * 65, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speedNorm * 900, t, 0.1);
  }

  engineStop() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); this.engineOsc2.stop(); } catch { /* already stopped */ }
    this.engineOsc = null; this.engineOsc2 = null; this.engineGain = null;
  }

  sirenSet(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 750;
      lfo.type = 'square'; lfo.frequency.value = 0.9;
      lg.gain.value = 180;
      lfo.connect(lg).connect(o.frequency);
      g.gain.value = 0.05;
      o.connect(g).connect(this.master);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenGain = g; this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* stopped */ }
      this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
    }
  }
}
