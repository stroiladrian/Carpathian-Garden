/**
 * Original hora-style menu tune, synthesised live with WebAudio (no audio files).
 * Mode: D "Romanian minor" (D E F G# A B C) — the raised 4th gives the folk colour.
 * Voices: a breathy nai/violin lead with vibrato, cobză-like bass, ţambal chord stabs
 * on the off-beats and a soft tobă. 2/4 at 124 bpm, 16 bars, loops seamlessly.
 */

type Note = [number | null, number]; // [midi or rest, length in 16ths]

const A_PART: Note[][] = [
  [[69, 2], [68, 1], [69, 1], [71, 2], [69, 2]],
  [[68, 1], [65, 1], [64, 2], [62, 4]],
  [[62, 1], [64, 1], [65, 1], [68, 1], [69, 2], [69, 2]],
  [[71, 1], [72, 1], [71, 1], [69, 1], [68, 2], [69, 2]],
  [[74, 2], [72, 1], [71, 1], [69, 2], [68, 2]],
  [[69, 1], [71, 1], [69, 1], [68, 1], [65, 2], [64, 2]],
  [[65, 1], [68, 1], [69, 1], [71, 1], [72, 1], [71, 1], [69, 1], [68, 1]],
  [[69, 2], [64, 2], [62, 4]],
];
const B_PART: Note[][] = [
  [[74, 1], [76, 1], [77, 1], [76, 1], [74, 2], [72, 2]],
  [[71, 1], [72, 1], [74, 1], [72, 1], [71, 2], [69, 2]],
  [[68, 1], [69, 1], [71, 1], [69, 1], [68, 1], [65, 1], [64, 2]],
  [[65, 1], [68, 1], [69, 2], [69, 4]],
  [[74, 1], [76, 1], [77, 1], [76, 1], [74, 2], [72, 2]],
  [[71, 1], [72, 1], [74, 1], [72, 1], [71, 2], [69, 2]],
  [[71, 1], [69, 1], [68, 1], [65, 1], [64, 1], [65, 1], [68, 1], [71, 1]],
  [[69, 2], [68, 1], [64, 1], [62, 4]],
];
const MELODY = [...A_PART, ...B_PART];

// chord per bar: [bass root, fifth, chord tones]
const Dm: [number, number, number[]] = [38, 45, [50, 53, 57]];
const A7: [number, number, number[]] = [45, 40, [49, 52, 55]];
const C: [number, number, number[]] = [36, 43, [48, 52, 55]];
const HARMONY = [Dm, A7, Dm, A7, Dm, A7, Dm, Dm, Dm, C, A7, Dm, Dm, C, A7, Dm];

const BPM = 124;
const SIXTEENTH = 60 / BPM / 4;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class MenuMusic {
  private ctx: AudioContext;
  private out: GainNode;
  private timer: number | null = null;
  private nextTime = 0;
  private bar = 0;
  private noise: AudioBuffer;
  playing = false;

  constructor(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // gentle room: a short feedback echo
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = SIXTEENTH * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.18;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
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
    this.out.gain.linearRampToValueAtTime(0.5, now + 1.2);
    this.nextTime = now + 0.08;
    this.bar = 0;
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

  /** Look-ahead scheduler: queue whole bars slightly ahead of the audio clock. */
  private schedule(): void {
    if (!this.playing) return;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      this.playBar(this.bar, this.nextTime);
      this.nextTime += SIXTEENTH * 8;
      this.bar = (this.bar + 1) % MELODY.length;
    }
  }

  private playBar(i: number, t0: number): void {
    const [root, fifth, chord] = HARMONY[i];
    // bass ("oom") on the beats, ţambal stabs ("pah") on the off-beats
    this.bass(root, t0, SIXTEENTH * 2);
    this.bass(fifth, t0 + SIXTEENTH * 4, SIXTEENTH * 2);
    for (const off of [2, 6]) this.tambal(chord, t0 + SIXTEENTH * off);
    this.drum(t0, 1);
    this.drum(t0 + SIXTEENTH * 4, 0.7);
    this.tick(t0 + SIXTEENTH * 2);
    this.tick(t0 + SIXTEENTH * 6);
    if (i % 8 === 7) this.tick(t0 + SIXTEENTH * 7, 0.5);

    // lead
    let t = t0;
    for (const [m, len] of MELODY[i]) {
      const dur = len * SIXTEENTH;
      if (m !== null) {
        // folk ornament: a quick upper grace note before longer notes
        if (len >= 2 && (i + len) % 3 === 0) {
          this.lead(m + 1, t, SIXTEENTH * 0.35, 0.6);
          this.lead(m, t + SIXTEENTH * 0.35, dur - SIXTEENTH * 0.35);
        } else {
          this.lead(m, t, dur);
        }
      }
      t += dur;
    }
  }

  private lead(m: number, t: number, dur: number, vol = 1): void {
    const ctx = this.ctx;
    const f = hz(m + 12);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.8;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f;
    o2.detune.value = 6;
    // vibrato that blooms on held notes
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(dur > 0.25 ? 9 : 3, t + Math.min(dur, 0.3));
    lfo.connect(lfoGain);
    lfoGain.connect(o1.detune);
    lfoGain.connect(o2.detune);
    const peak = 0.11 * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.09);
    g.gain.setValueAtTime(peak * 0.7, t + Math.max(0.1, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(this.out);
    // breath (nai)
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.025 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.12, dur));
    n.connect(bp).connect(ng).connect(this.out);
    for (const o of [o1, o2, lfo]) {
      o.start(t);
      o.stop(t + dur + 0.08);
    }
    n.start(t);
    n.stop(t + 0.15);
  }

  private bass(m: number, t: number, dur: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur);
  }

  private tambal(notes: number[], t: number): void {
    const ctx = this.ctx;
    notes.forEach((m, k) => {
      const tt = t + k * 0.008; // tiny strum
      for (const [mult, vol] of [
        [1, 0.05],
        [2.01, 0.02],
        [3.98, 0.008],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz(m + 12) * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(vol, tt + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.28);
        o.connect(g).connect(this.out);
        o.start(tt);
        o.stop(tt + 0.3);
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
    g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.005);
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
    g.gain.setValueAtTime(0.035 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(hp).connect(g).connect(this.out);
    n.start(t);
    n.stop(t + 0.06);
  }
}
