// WebAudio sound, all synthesized — no audio files, no network. Engine hum,
// sirens, gunshots, pickups, mission jingles and a laid-back bass loop.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
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

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() {
    this.noise(0.14, 0.5, 900);
    this.tone(160, 0.08, 'square', 0.12, 60);
  }

  hit() {
    this.tone(220, 0.08, 'square', 0.15, 110);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.tone(990, 0.12, 'sine', 0.2), 70);
  }

  cash() {
    this.tone(880, 0.08, 'triangle', 0.22);
    setTimeout(() => this.tone(1174, 0.1, 'triangle', 0.22), 80);
    setTimeout(() => this.tone(1568, 0.16, 'triangle', 0.2), 160);
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.22), i * 110));
  }

  missionDone() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 100));
  }

  fail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.12), i * 140));
  }

  crash() {
    this.noise(0.25, 0.4, 500);
  }

  busted() {
    [440, 415, 440, 415].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'square', 0.12), i * 160));
  }

  engineStart(speed01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = this.muted ? 0 : 0.03 + speed01 * 0.05;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, this.ctx.currentTime, 0.08);
  }

  engineStop() {
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = this.muted ? 0 : 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenOsc.frequency.setValueAtTime(700, this.ctx.currentTime);
    }
    if (on && this.sirenOsc) {
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      this.sirenOsc.frequency.setValueAtTime(700, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.45);
      this.sirenOsc.frequency.linearRampToValueAtTime(700, t + 0.9);
    }
    if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
      } catch (e) {}
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // A lazy two-bar bass + hat loop, scheduled ahead in small slices.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this.musicStep % 16;
      const f = bass[step];
      if (f) this.tone(f, 0.22, 'triangle', 0.16);
      if (step % 2 === 0) this.noise(0.03, 0.05, 6000);
      if (step === 0 || step === 8) this.tone(220, 0.3, 'sine', 0.05, 110);
      this.musicStep++;
    }, 190);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
