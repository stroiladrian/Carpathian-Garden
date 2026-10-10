/**
 * Menu music in the style of "Ciocârlia" (the traditional Romanian showpiece,
 * as played by lăutari and quoted by Enescu): a free-time lark introduction for
 * violin over a ţambal drone — trills, glissandi and bird chirps — followed by a
 * fast sârbă in D "hijaz" (D Eb F# G A Bb C) that speeds up on every repeat.
 * Everything is synthesised live with WebAudio; no audio files.
 *
 * This is an arrangement in the style of the piece, not a note-for-note transcription.
 */

type Bar = number[]; // eight 16ths (MIDI), a trailing negative number = hold previous for |n| 16ths

const D = 62;
// fast section: perpetual 16ths, bariolage on the open strings, runs up the hijaz scale
const FAST: Bar[] = [
  [74, 69, 74, 69, 74, 69, 74, 69],
  [75, 69, 75, 69, 74, 69, 74, 69],
  [78, 79, 81, 79, 78, 75, 74, 75],
  [78, 79, 81, 82, 81, 79, 78, 75],
  [74, 69, 74, 69, 74, 69, 74, 69],
  [75, 69, 75, 69, 74, 69, 74, 69],
  [78, 75, 74, 72, 70, 69, 67, 66],
  [66, 67, 69, 66, 62, -3],
  [81, 82, 81, 79, 81, 82, 81, 79],
  [81, 84, 82, 81, 79, 78, 79, 81],
  [82, 81, 79, 78, 79, 78, 75, 74],
  [75, 74, 72, 70, 69, 70, 72, 74],
  [86, 84, 82, 81, 82, 81, 79, 78],
  [79, 78, 75, 74, 75, 74, 72, 70],
  [69, 70, 72, 74, 75, 78, 79, 81],
  [82, 81, 78, 75, 74, -3],
];
const DMAJ: [number, number[]] = [38, [62, 66, 69]];
const GM: [number, number[]] = [43, [55, 58, 62]];
const CM: [number, number[]] = [36, [60, 63, 67]];
const FAST_HARMONY = [DMAJ, DMAJ, DMAJ, DMAJ, DMAJ, DMAJ, GM, DMAJ, GM, GM, DMAJ, DMAJ, GM, CM, DMAJ, DMAJ];

const TEMPO_START = 138;
const TEMPO_MAX = 172;
const TEMPO_STEP = 8;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface LeadOpts {
  vol?: number;
  glideTo?: number;
  glideTime?: number;
  vibrato?: number;
  bright?: number;
}

export class MenuMusic {
  private ctx: AudioContext;
  private out: GainNode;
  private timer: number | null = null;
  private nextTime = 0;
  private bar = 0;
  private loop = 0;
  private bpm = TEMPO_START;
  private phase: 'intro' | 'fast' = 'intro';
  private noise: AudioBuffer;
  playing = false;

  constructor(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    this.out.connect(destination);
    this.out.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(destination);
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0.7, now + 0.8);
    this.nextTime = now + 0.08;
    this.phase = 'intro';
    this.bar = 0;
    this.loop = 0;
    this.bpm = TEMPO_START;
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  stop(fade = 0.8): void {
    if (!this.playing) return;
    this.playing = false;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    const t = this.timer;
    this.timer = null;
    window.setTimeout(() => {
      if (t !== null) window.clearInterval(t);
    }, fade * 1000 + 50);
  }

  private schedule(): void {
    if (!this.playing) return;
    while (this.nextTime < this.ctx.currentTime + 0.4) {
      if (this.phase === 'intro') {
        this.nextTime += this.playIntro(this.nextTime);
        this.phase = 'fast';
        this.bar = 0;
      } else {
        this.nextTime += this.playFastBar(this.bar, this.nextTime);
        this.bar++;
        if (this.bar >= FAST.length) {
          this.bar = 0;
          this.loop++;
          this.bpm = Math.min(TEMPO_MAX, this.bpm + TEMPO_STEP);
          // after the tune has raced to full speed, the lark sings again
          if (this.bpm >= TEMPO_MAX && this.loop % 4 === 0) {
            this.phase = 'intro';
            this.bpm = TEMPO_START;
          }
        }
      }
    }
  }

  /** Free-time lark introduction. Returns its length in seconds. */
  private playIntro(t0: number): number {
    let t = t0;
    const lead = (m: number, d: number, o: LeadOpts = {}) => {
      this.lead(m, t, d, o);
      t += d;
    };
    const trill = (a: number, b: number, d: number, rate = 0.045) => {
      for (let k = 0; t < t0 + 99 && k * rate < d; k++) this.lead(k % 2 ? b : a, t + k * rate, rate * 0.95, { vol: 0.8, vibrato: 0 });
      t += d;
    };
    const chirp = (m: number) => {
      this.lead(m, t, 0.05, { vol: 0.55, glideTo: m + 5, glideTime: 0.04, vibrato: 0, bright: 1.6 });
      t += 0.09;
    };

    // ţambal tremolo drone under the whole introduction
    const introLen = 9.2;
    for (let x = 0; x < introLen; x += 0.09) this.tambal([D - 12, D - 5], t0 + x, 0.35, 0.35);
    this.bass(38, t0, 2.5);
    this.bass(38, t0 + 4.6, 2.5);

    t += 0.15;
    lead(81, 0.9, { vibrato: 14 });
    trill(81, 82, 1.1);
    lead(81, 0.35, { glideTo: 86, glideTime: 0.3, vibrato: 10 });
    lead(86, 0.5, { vibrato: 16 });
    t += 0.12;
    chirp(93);
    chirp(95);
    t += 0.1;
    chirp(91);
    chirp(93);
    chirp(96);
    t += 0.2;
    for (const m of [86, 84, 82, 81, 79, 78, 75, 74]) lead(m, 0.065, { vibrato: 0, vol: 0.9 });
    for (const m of [72, 70]) lead(m, 0.09, { vibrato: 0 });
    lead(69, 0.7, { vibrato: 14 });
    trill(69, 70, 0.6);
    lead(66, 0.12, { vibrato: 0 });
    lead(67, 0.12, { vibrato: 0 });
    lead(74, 1.0, { vibrato: 16, glideTo: 74 });
    return Math.max(introLen, t - t0) + 0.15;
  }

  /** One bar of the fast sârbă. Returns its length in seconds. */
  private playFastBar(i: number, t0: number): number {
    const six = 60 / this.bpm / 4;
    const [root, chord] = FAST_HARMONY[i];
    // oom-pah: cobză bass on the beats, ţambal stabs on the off-beats
    this.bass(root, t0, six * 1.8);
    this.bass(root + 7, t0 + six * 4, six * 1.8);
    this.tambal(chord, t0 + six * 2, 0.22, 1);
    this.tambal(chord, t0 + six * 6, 0.22, 1);
    this.drum(t0, 1);
    this.drum(t0 + six * 4, 0.75);
    this.tick(t0 + six * 2);
    this.tick(t0 + six * 6);

    // lead: perpetual 16ths, slightly detached like fast bowing
    const notes = FAST[i];
    let t = t0;
    for (let k = 0; k < notes.length; k++) {
      const m = notes[k];
      let len = 1;
      if (k + 1 < notes.length && notes[k + 1] < 0) len += -notes[k + 1];
      if (m < 0) continue;
      const d = six * len;
      this.lead(m, t, len > 1 ? d : d * 0.85, { vol: k % 2 ? 0.8 : 1, vibrato: len > 1 ? 12 : 0 });
      t += d;
    }
    return six * 8;
  }

  // ───────────── voices ─────────────

  private lead(m: number, t: number, dur: number, o: LeadOpts = {}): void {
    const ctx = this.ctx;
    const vol = o.vol ?? 1;
    const f = hz(m);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200 * (o.bright ?? 1);
    lp.Q.value = 0.9;
    const body = ctx.createBiquadFilter(); // violin body resonance
    body.type = 'peaking';
    body.frequency.value = 2400;
    body.gain.value = 5;
    body.Q.value = 1.2;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.detune.value = 7;
    for (const osc of [o1, o2]) {
      osc.frequency.setValueAtTime(f, t);
      if (o.glideTo !== undefined && o.glideTo !== m) {
        osc.frequency.exponentialRampToValueAtTime(hz(o.glideTo), t + (o.glideTime ?? dur * 0.6));
      }
    }
    const vib = o.vibrato ?? 8;
    let lfo: OscillatorNode | null = null;
    if (vib > 0) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 6.2;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(vib, t + Math.min(dur, 0.25));
      lfo.connect(lg);
      lg.connect(o1.detune);
      lg.connect(o2.detune);
    }
    const peak = 0.085 * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.3));
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.02, dur - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.035);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(body).connect(g).connect(this.out);
    // bow noise
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * 3);
    bp.Q.value = 4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.012 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.06, dur));
    n.connect(bp).connect(ng).connect(this.out);
    const end = t + dur + 0.06;
    o1.start(t);
    o2.start(t);
    o1.stop(end);
    o2.stop(end);
    if (lfo) {
      lfo.start(t);
      lfo.stop(end);
    }
    n.start(t);
    n.stop(t + 0.08);
  }

  private bass(m: number, t: number, dur: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + Math.min(dur, 0.6));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur);
  }

  private tambal(notes: number[], t: number, decay: number, vol: number): void {
    const ctx = this.ctx;
    notes.forEach((m, k) => {
      const tt = t + k * 0.007;
      for (const [mult, v] of [
        [1, 0.045],
        [2.01, 0.018],
        [3.98, 0.007],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz(m + 12) * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(v * vol, tt + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + decay);
        o.connect(g).connect(this.out);
        o.start(tt);
        o.stop(tt + decay + 0.02);
      }
    });
  }

  private drum(t: number, vol: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.22);
  }

  private tick(t: number, vol = 1): void {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(hp).connect(g).connect(this.out);
    n.start(t);
    n.stop(t + 0.06);
  }
}
