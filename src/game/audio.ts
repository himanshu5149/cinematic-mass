export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  muted = false;
  started = false;
  intensity = 0;
  bpm = 92;
  nextBeat = 0;
  beat = 0;
  combat = false;
  elevate = false;
  whistleGain: GainNode | null = null;
  drone: OscillatorNode | null = null;
  droneGain: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;

  unlock() {
    if (this.started && this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.7;
    this.music.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.started = true;
    this.startDrone();
    this.nextBeat = this.ctx.currentTime + 0.05;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  setCombat(on: boolean) {
    this.combat = on;
    this.bpm = on ? 108 : 72;
  }

  setElevate(on: boolean) {
    this.elevate = on;
    this.bpm = on ? 148 : this.combat ? 118 : 72;
    if (on) {
      this.silence(0.18);
      this.whistle(0.22);
      window.setTimeout(() => this.boom(), 200);
    }
  }

  tick() {
    if (!this.ctx || !this.started || this.muted) return;
    const t = this.ctx.currentTime;
    const spb = 60 / this.bpm;
    while (this.nextBeat < t + 0.12) {
      this.scheduleBeat(this.nextBeat, this.beat);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private scheduleBeat(time: number, beat: number) {
    if (!this.combat && !this.elevate) {
      if (beat % 4 === 0) this.thump(time, 0.22);
      return;
    }
    const step = beat % 8;
    const hot = this.elevate || this.intensity > 0.45;
    if (step === 0 || step === 4) this.kuthu(time, 1);
    else if (step === 2 || step === 6) this.kuthu(time, 0.55);
    else if (hot && (step === 3 || step === 7)) this.kuthu(time, 0.32);
    if (step === 0 && (this.elevate || this.intensity > 0.7)) this.clap(time);
    if (this.elevate && step === 0 && beat % 16 === 0) this.whistleAt(time);
  }

  slash() {
    this.noiseSweep(420, 80, 0.07, 0.18);
    this.tone(180, 90, 0.04, "triangle", 0.08);
  }

  heavy() {
    this.boom();
    this.noiseSweep(200, 40, 0.12, 0.28);
  }

  hit() {
    this.tone(140, 50, 0.12, "sawtooth", 0.07);
    this.noiseSweep(900, 200, 0.05, 0.14);
  }

  crit() {
    this.tone(520, 180, 0.1, "square", 0.06);
    this.boom();
  }

  parry() {
    this.bell();
    this.tone(980, 620, 0.08, "sine", 0.09);
  }

  dash() {
    this.noiseSweep(700, 160, 0.08, 0.16);
  }

  chakra() {
    this.tone(640, 1480, 0.16, "sine", 0.1);
    this.tone(960, 1880, 0.16, "triangle", 0.05);
  }

  chakraHit() {
    this.tone(880, 220, 0.07, "square", 0.05);
  }

  hurt() {
    this.tone(220, 70, 0.12, "sawtooth", 0.12);
    this.noiseSweep(300, 60, 0.1, 0.2);
  }

  death() {
    this.silence(0.25);
    this.tone(180, 40, 0.5, "sine", 0.4);
    this.boom();
  }

  pickup() {
    this.tone(520, 980, 0.1, "sine", 0.08);
  }

  wave() {
    this.silence(0.28);
    window.setTimeout(() => {
      this.whistle(0);
      this.boom();
    }, 300);
  }

  boss() {
    this.silence(0.4);
    window.setTimeout(() => {
      this.whistle(0);
      this.kuthu(this.now() + 0.05, 1.2);
      this.boom();
    }, 420);
  }

  choir() {
    if (!this.ctx || !this.sfx) return;
    const t = this.now();
    for (const [f, d] of [
      [392, 0],
      [493.88, 0.08],
      [587.33, 0.16],
      [784, 0.24],
    ] as const) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.09, t + d + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 1.4);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t + d);
      o.stop(t + d + 1.45);
    }
  }

  chant() {
    if (!this.ctx || !this.music) return;
    const t = this.now();
    for (let i = 0; i < 4; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(96, t + i * 0.19);
      o.frequency.exponentialRampToValueAtTime(62, t + i * 0.19 + 0.12);
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240;
      g.gain.setValueAtTime(0.16, t + i * 0.19);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.19 + 0.14);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.music);
      o.start(t + i * 0.19);
      o.stop(t + i * 0.19 + 0.16);
    }
  }

  ui() {
    this.tone(660, 880, 0.05, "sine", 0.05);
  }

  whistle(delay = 0) {
    this.whistleAt(this.now() + delay);
  }

  private whistleAt(time: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1760, time);
    o.frequency.linearRampToValueAtTime(1980, time + 0.35);
    o.frequency.linearRampToValueAtTime(1680, time + 0.85);
    lfo.frequency.value = 6.5;
    lg.gain.value = 18;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.16, time + 0.05);
    g.gain.linearRampToValueAtTime(0.12, time + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, time + 1.1);
    o.connect(g);
    g.connect(this.music);
    o.start(time);
    lfo.start(time);
    o.stop(time + 1.15);
    lfo.stop(time + 1.15);
  }

  boom() {
    if (!this.ctx || !this.sfx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.32);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.36);
  }

  private silence(sec: number) {
    if (!this.music || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(0.02, t + 0.05);
    this.music.gain.setValueAtTime(0.02, t + sec);
    this.music.gain.linearRampToValueAtTime(0.7, t + sec + 0.08);
  }

  private kuthu(time: number, amp: number) {
    if (!this.ctx || !this.music || !this.noiseBuf) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(92, time);
    o.frequency.exponentialRampToValueAtTime(46, time + 0.12);
    g.gain.setValueAtTime(0.28 * amp, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    o.connect(g);
    g.connect(this.music);
    o.start(time);
    o.stop(time + 0.18);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 380;
    bp.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.22 * amp, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.music);
    src.start(time);
    src.stop(time + 0.1);
  }

  private thump(time: number, amp: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(58, time);
    o.frequency.exponentialRampToValueAtTime(36, time + 0.2);
    g.gain.setValueAtTime(0.16 * amp, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    o.connect(g);
    g.connect(this.music);
    o.start(time);
    o.stop(time + 0.24);
  }

  private clap(time: number) {
    if (!this.ctx || !this.music || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.music);
    src.start(time);
    src.stop(time + 0.08);
  }

  private bell() {
    if (!this.ctx || !this.sfx) return;
    const t = this.now();
    for (const f of [880, 1320, 1760]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.38);
    }
  }

  private tone(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    amp: number,
  ) {
    if (!this.ctx || !this.sfx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseSweep(from: number, to: number, dur: number, amp: number) {
    if (!this.ctx || !this.sfx || !this.noiseBuf) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private startDrone() {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 55;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(this.music);
    o.start();
    this.drone = o;
    this.droneGain = g;
  }

  private makeNoise() {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
