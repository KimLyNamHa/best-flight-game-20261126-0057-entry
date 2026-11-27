// audio.js — procedural WebAudio: an engine hum pitched with the throttle,
// wind that rises with speed, and one-shot chimes, thuds and crashes.
// No audio files at all. Everything is guarded: if the browser has no audio
// (or the page never gets a gesture), the game plays silently.
export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null;
  let windGain = null, windFilter = null;
  let muted = false;
  let started = false;

  function noiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned saws through a low-pass, gain follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.5;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass, gain follows speed.
      const wind = ctx.createBufferSource();
      wind.buffer = noiseBuffer();
      wind.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      wind.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + when;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* silent */ }
  }

  return {
    // Call on any user gesture; also called every frame (cheap no-op after start).
    ensure,
    setEngine(throttle, speed, flying) {
      if (!ensure() || !ctx) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        const target = muted ? 0 : flying ? 0.03 + throttle * 0.075 : 0.012 + throttle * 0.03;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        const f = 52 + throttle * 78 + speed * 0.16;
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
        engineOsc2.frequency.setTargetAtTime(f * 1.5, ctx.currentTime, 0.1);
        windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.14, speed / 250 * 0.14), ctx.currentTime, 0.15);
        windFilter.frequency.setTargetAtTime(380 + speed * 3.2, ctx.currentTime, 0.15);
      } catch { /* silent */ }
    },
    chime() {
      if (!ensure()) return;
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.5, 'sine', 0.12, 0.09);
    },
    fanfare() {
      if (!ensure()) return;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, i * 0.11));
    },
    thud() {
      if (!ensure()) return;
      tone(72, 0.3, 'sine', 0.3);
    },
    crash() {
      if (!ensure() || !ctx) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
        src.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        src.start();
        src.stop(ctx.currentTime + 1);
        tone(48, 0.9, 'sine', 0.35);
      } catch { /* silent */ }
    },
    click() {
      if (!ensure()) return;
      tone(660, 0.08, 'square', 0.06);
    },
    setMuted(m) {
      muted = m;
    },
    isMuted() {
      return muted;
    },
  };
}
