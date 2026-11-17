// Synthesized sound: no audio files, everything is WebAudio oscillators.
// All calls are safe before the first user gesture (context stays null).

export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    musicTimer: null,
    musicStep: 0,
  };
}

export function ensureAudio(A) {
  if (A.ctx) {
    if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.5;
    A.master.connect(A.ctx.destination);
    startMusic(A);
    return true;
  } catch (e) {
    return false;
  }
}

export function setMuted(A, m) {
  A.muted = m;
  if (A.master) A.master.gain.value = m ? 0 : 0.5;
}

function blip(A, freq, dur, type, vol, slideTo) {
  if (!A.ctx || A.ctx.state !== 'running' || A.muted) return;
  try {
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* audio is best-effort */ }
}

function noise(A, dur, vol, lowpass) {
  if (!A.ctx || A.ctx.state !== 'running' || A.muted) return;
  try {
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const g = A.ctx.createGain();
    g.gain.value = vol || 0.25;
    let node = src;
    if (lowpass) {
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(A.master);
    src.start(t);
  } catch (e) { /* best-effort */ }
}

export const sfx = {
  shoot(A) { noise(A, 0.09, 0.3, 3200); blip(A, 220, 0.08, 'square', 0.1, 60); },
  enemyShoot(A) { noise(A, 0.08, 0.18, 2400); },
  crash(A) { noise(A, 0.25, 0.35, 900); },
  pickup(A) { blip(A, 660, 0.09, 'sine', 0.2); blip(A, 990, 0.12, 'sine', 0.2); },
  missionDone(A) { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(A, f, 0.16, 'triangle', 0.2), i * 90)); },
  busted(A) { blip(A, 330, 0.4, 'sawtooth', 0.18, 110); },
  click(A) { blip(A, 880, 0.05, 'sine', 0.12); },
  horn(A) { blip(A, 370, 0.18, 'square', 0.12, 370); },
};

export function setEngine(A, speed01, inCar) {
  if (!A.ctx || A.muted) {
    if (A.engineGain) A.engineGain.gain.value = 0;
    return;
  }
  try {
    if (!A.engineOsc) {
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900;
      A.engineOsc.connect(f); f.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
    }
    const target = inCar ? 0.045 + speed01 * 0.06 : 0;
    A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.08);
    A.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, A.ctx.currentTime, 0.1);
  } catch (e) { /* best-effort */ }
}

export function setSiren(A, on) {
  if (!A.ctx) return;
  try {
    if (on && !A.sirenOsc) {
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'triangle';
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0.035;
      const lfo = A.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = A.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain); lfoGain.connect(A.sirenOsc.frequency);
      A.sirenOsc.frequency.value = 750;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
      A.sirenOsc.start(); lfo.start();
      A.sirenLfo = lfo;
    } else if (!on && A.sirenOsc) {
      const o = A.sirenOsc, l = A.sirenLfo;
      A.sirenOsc = null; A.sirenLfo = null;
      try { o.stop(); l.stop(); } catch (e) {}
    }
  } catch (e) { /* best-effort */ }
}

// A lazy two-bar bassline + hat loop, scheduled a bar ahead.
const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
function startMusic(A) {
  if (A.musicTimer) return;
  A.musicTimer = setInterval(() => {
    if (!A.ctx || A.muted) return;
    const step = A.musicStep % 16;
    const f = BASS[step];
    if (f) blip(A, f, 0.22, 'triangle', 0.1);
    if (step % 2 === 0) noise(A, 0.03, 0.04, 6000);
    A.musicStep++;
  }, 210);
}
