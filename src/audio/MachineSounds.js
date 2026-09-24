// Procedural machine sounds (Web Audio, no sample files): motor hum that follows the spindle RPM,
// a cutting sound while material is actually removed, and handwheel clicks while an axis moves.
// Sound only reads session state; it never feeds back into machining.

// Cutting character per machine: band-passed noise, amplitude-modulated at the cutter's tooth-pass rate.
const CUT = {
  lathe: { freq: 3600, q: 1.4, teeth: 0, level: .22 },   // continuous "sss" hiss of a single-point tool
  milling: { freq: 2200, q: 1.1, teeth: 4, level: .3 },  // chattering insert hits
  drill: { freq: 1300, q: 1.6, teeth: 2, level: .26 },   // lower grinding of two lips
};
const MAX_RPM = { lathe: 2000, milling: 2000, drill: 3000 };
const CLICK_MM = .25, CLICK_GAP = .035, SLOW_CLICK = .12; // a click per 0.25 mm of travel, ~28/s at most

export class MachineSounds {
  constructor() { this.ctx = null; this.muted = false; this.last = null; this.kind = 'lathe'; this.travel = 0; this.lastClick = 0; }
  /** Browsers only allow audio after a user gesture; call this from a pointer/keyboard handler. */
  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.#build(new Context());
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  #build(ctx) {
    this.ctx = ctx;
    const master = this.master = ctx.createGain(); master.gain.value = this.muted ? 0 : .8; master.connect(ctx.destination);
    // Motor: mains hum plus a whine that rises with RPM, softened by a low-pass.
    const motorGain = this.motorGain = ctx.createGain(); motorGain.gain.value = 0;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 900; tone.connect(motorGain); motorGain.connect(master);
    this.hum = ctx.createOscillator(); this.hum.type = 'sawtooth'; this.hum.frequency.value = 100;
    this.whine = ctx.createOscillator(); this.whine.type = 'triangle'; this.whine.frequency.value = 180;
    const humLevel = ctx.createGain(); humLevel.gain.value = .35; this.hum.connect(humLevel).connect(tone);
    const whineLevel = ctx.createGain(); whineLevel.gain.value = .5; this.whine.connect(whineLevel).connect(tone);
    // Shared looping white noise for cutting and clicks.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    this.cutFilter = ctx.createBiquadFilter(); this.cutFilter.type = 'bandpass';
    // Tooth-pass modulation: a DC offset plus an LFO drive the modulation gain around 1.
    this.teethGain = ctx.createGain(); this.teethGain.gain.value = 1;
    this.lfo = ctx.createOscillator(); this.lfo.type = 'square'; this.lfo.frequency.value = 30;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0; this.lfo.connect(this.lfoDepth).connect(this.teethGain.gain);
    this.cutGain = ctx.createGain(); this.cutGain.gain.value = 0;
    noise.connect(this.cutFilter).connect(this.teethGain).connect(this.cutGain).connect(master);
    for (const node of [this.hum, this.whine, noise, this.lfo]) node.start();
    this.#applyKind();
  }
  #applyKind() {
    if (!this.ctx) return;
    const c = CUT[this.kind] || CUT.lathe;
    this.cutFilter.frequency.value = c.freq; this.cutFilter.Q.value = c.q;
    this.lfoDepth.gain.value = c.teeth ? .7 : 0;
  }
  setMachine(kind) { this.kind = kind in CUT ? kind : 'lathe'; this.last = null; this.travel = 0; this.#applyKind(); }
  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : .8, this.ctx.currentTime, .05);
  }
  /** Feed one session state snapshot (called on every command and every frame). */
  update(state) {
    if (!state || state.disposed) return;
    const previous = this.last;
    this.last = { rpm: state.rpm || 0, cutCount: state.cutCount || 0, axes: { ...(state.machineAxesMm || {}) } };
    if (!this.ctx || this.ctx.state !== 'running' || !previous) return;
    const now = this.ctx.currentTime, rpm = this.last.rpm, share = Math.min(1, rpm / (MAX_RPM[this.kind] || 2000));
    // Motor follows the spindle, including its spin-up and run-down.
    this.motorGain.gain.setTargetAtTime(rpm > 0 ? .05 + .1 * share : 0, now, .08);
    this.whine.frequency.setTargetAtTime(160 + 520 * share, now, .08);
    const c = CUT[this.kind] || CUT.lathe;
    if (c.teeth) this.lfo.frequency.setTargetAtTime(Math.max(4, rpm / 60 * c.teeth), now, .05);
    // Cutting: swell while material comes off, fade out shortly after the last removal.
    if (this.last.cutCount > previous.cutCount && rpm > 0) {
      const g = this.cutGain.gain;
      g.cancelScheduledValues(now); g.setTargetAtTime(c.level * (.6 + .4 * share), now, .02); g.setTargetAtTime(0, now + .15, .08);
      this.cutFilter.frequency.setTargetAtTime(c.freq * (.85 + Math.random() * .3), now, .03);
    }
    // Handwheel: count real axis travel (click-jogs, held wheels, the drill lever alike). Each move clicks at
    // least every SLOW_CLICK seconds, so a tiny 0.01 mm jog still gets one detent click.
    let moved = 0;
    for (const [id, value] of Object.entries(this.last.axes)) {
      const before = previous.axes[id];
      if (Number.isFinite(before) && Number.isFinite(value)) moved += Math.abs(value - before);
    }
    if (moved > 1e-6) {
      this.travel += moved;
      const gap = now - this.lastClick;
      if (gap >= CLICK_GAP && (this.travel >= CLICK_MM || gap >= SLOW_CLICK)) { this.#click(now); this.lastClick = now; this.travel = 0; }
    }
  }
  #click(now) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = this.kind === 'drill' ? 1800 : 2600; filter.Q.value = 6;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(.35, now); gain.gain.exponentialRampToValueAtTime(.001, now + .03);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now, Math.random() * 1.5, .04);
  }
  dispose() { this.ctx?.close(); this.ctx = null; }
}
