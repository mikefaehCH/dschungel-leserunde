// Sounds for the campfire cinema, generated in the browser. No audio files, no foreign voices.
const kinoSfx = (() => {
  let ctx = null,
    bus = null,
    ambient = null,
    noiseBuffer = null,
    enabled = true;
  const level = 0.32,
    ducked = 0.1;

  function unlock() {
    // Must run inside a tap so iOS allows sound.
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) {
      ctx = new Ctx();
      bus = ctx.createGain();
      bus.gain.value = level;
      bus.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  const ready = () => enabled && ctx && ctx.state === "running";

  function envelope(peak, attack, decay, at) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    gain.connect(bus);
    return gain;
  }
  function tone(type, from, to, peak, length, delay = 0) {
    const at = ctx.currentTime + delay,
      osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    osc.connect(envelope(peak, 0.01, length, at));
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
  function noise(filter, from, to, peak, length, attack = 0.01, delay = 0) {
    const at = ctx.currentTime + delay,
      src = ctx.createBufferSource(),
      band = ctx.createBiquadFilter();
    src.buffer = noiseBuffer;
    band.type = filter;
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + length);
    src.connect(band);
    band.connect(envelope(peak, attack, length, at));
    src.start(at);
    src.stop(at + attack + length + 0.05);
  }

  const sounds = {
    flap: () => noise("bandpass", 1100, 700, 0.35, 0.08),
    swoosh: (d = 1.2) => noise("bandpass", 350, 1700, 0.3, d, d * 0.45),
    plop: () => tone("sine", 620, 170, 0.5, 0.13),
    boing: () => {
      const f = 220 + Math.random() * 60;
      tone("sine", f, f * 2.8, 0.38, 0.2);
    },
    tap: () => noise("lowpass", 420, 220, 0.3, 0.06),
    sparkle: () =>
      [1046, 1318, 1568].forEach((f, i) =>
        tone("triangle", f, f * 1.01, 0.22, 0.45, i * 0.07),
      ),
    arc: (d = 0.9) => tone("sine", 523, 784, 0.18, d),
    fanfare: () => {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone("triangle", f, f, 0.26, i === 3 ? 0.6 : 0.16, i * 0.15),
      );
      noise("highpass", 3000, 5000, 0.08, 0.9, 0.05, 0.5);
    },
    purr: () => {
      for (let i = 0; i < 10; i++) noise("lowpass", 160, 120, 0.25, 0.07, 0.02, i * 0.11);
    },
    rustle: () => noise("highpass", 2500, 4200, 0.12, 0.6, 0.1),
  };
  function play(name, arg) {
    if (!ready() || !sounds[name]) return;
    try {
      sounds[name](arg);
    } catch {}
  }
  function chirp() {
    if (!ready()) return;
    const f = 2400 + Math.random() * 1200;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++)
      tone("sine", f, f * 1.25, 0.04, 0.07, i * 0.12);
  }
  function setAmbient(on) {
    clearInterval(ambient);
    ambient = on ? setInterval(() => Math.random() < 0.45 && chirp(), 900) : null;
  }
  function duck(on) {
    if (!ctx) return;
    bus.gain.setTargetAtTime(on ? ducked : level, ctx.currentTime, 0.08);
  }
  function setEnabled(on) {
    enabled = on;
    if (!on) setAmbient(false);
  }
  return {
    unlock,
    play,
    setAmbient,
    duck,
    setEnabled,
    isEnabled: () => enabled,
    sounds: Object.keys(sounds),
  };
})();
