// Sound for Solmar Bay, synthesized live with WebAudio — no audio
// files, no network, nothing to download. The engine hum, the police
// siren, gunshots and the mission chime are all oscillators and noise
// shaped in code. Audio starts on the first user gesture, as browsers
// require.
export function createAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    master: null,
    muted: false,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') void audio.ctx.resume();
      return audio.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);
    // Engine: a low sawtooth whose pitch follows the car's speed.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: a sine that wails between two notes while wanted.
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return ctx;
  }

  // A short burst of filtered noise: a gunshot, a punch thud, a crash.
  function noiseBurst(duration, frequency, volume) {
    const ctx = ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  }

  function tone(frequency, duration, type, volume, when = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + when);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.05);
  }

  return {
    unlock() { ensure(); },
    setDriving(speedKmh, wanted) {
      if (!audio.ctx) return;
      const t = audio.ctx.currentTime;
      audio.engineGain.gain.setTargetAtTime(speedKmh > 1 ? 0.06 : 0, t, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(55 + speedKmh * 2.2, t, 0.1);
      audio.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.035 : 0, t, 0.2);
      if (wanted > 0) {
        const phase = (performance.now() / 450) % 2;
        audio.sirenOsc.frequency.setTargetAtTime(phase < 1 ? 720 : 960, t, 0.05);
      }
    },
    shot() { noiseBurst(0.14, 1800, 0.5); },
    emptyClick() { tone(1200, 0.05, 'square', 0.12); },
    punch() { noiseBurst(0.08, 500, 0.35); },
    chime() { tone(660, 0.18, 'sine', 0.25); tone(880, 0.3, 'sine', 0.25, 0.14); },
    crash() { noiseBurst(0.3, 300, 0.5); },
    pickup() { tone(520, 0.12, 'triangle', 0.3); tone(780, 0.2, 'triangle', 0.3, 0.1); },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },
  };
}
