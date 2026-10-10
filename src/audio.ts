import type { ArchetypeId } from './game/characters';
import type { FoodKind } from './game/food';

/** Tiny WebAudio synth — every sound is generated, no audio files needed. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastCoin = 0;
  private coinStep = 0;
  muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  private ready(): AudioContext | null {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, delay = 0, sweepTo?: number): void {
    const ctx = this.ready();
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  pickup(kind: FoodKind): void {
    const ctx = this.ready();
    if (!ctx) return;
    if (kind === 'coin' || kind === 'spill' || kind === 'note') {
      const now = ctx.currentTime;
      if (now - this.lastCoin < 0.05) return;
      this.coinStep = now - this.lastCoin < 0.4 ? Math.min(this.coinStep + 1, 12) : 0;
      this.lastCoin = now;
      const f = 700 * Math.pow(2, this.coinStep / 24);
      this.tone(f, 0.08, 'triangle', 0.07);
      return;
    }
    if (kind === 'envelope') {
      this.bribe();
      return;
    }
    if (kind === 'tender') {
      this.special();
      return;
    }
    if (kind === 'gold') {
      this.tone(1320, 0.1, 'square', 0.05);
      this.tone(1760, 0.18, 'triangle', 0.08, undefined, 0.06);
    } else if (kind === 'pledge') {
      this.tone(660, 0.12, 'sine', 0.1);
      this.tone(990, 0.2, 'sine', 0.1, undefined, 0.08);
    } else {
      // contract / briefcase: cash-register flourish
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.1, undefined, i * 0.05));
      this.noise(0.12, 0.15, 3000, 3, 0.2);
    }
  }

  bribe(): void {
    this.noise(0.12, 0.12, 2500, 2);
    this.tone(1200, 0.1, 'triangle', 0.08, 900, 0.05);
  }

  special(): void {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.06, undefined, i * 0.08));
  }

  siren(): void {
    for (let i = 0; i < 4; i++) this.tone(i % 2 ? 660 : 880, 0.22, 'sawtooth', 0.07, undefined, i * 0.22);
  }

  boost(): void {
    this.noise(0.35, 0.12, 400, 0.8, 0, 1600);
  }

  ability(id: ArchetypeId, near = 1): void {
    const v = 0.14 * near;
    switch (id) {
      case 'firebrand':
        this.tone(140, 0.5, 'sawtooth', v, 70);
        this.noise(0.5, v, 600, 0.6);
        break;
      case 'tycoon':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.25, 'triangle', v * 0.8, undefined, i * 0.06));
        break;
      case 'baron':
        this.tone(300, 0.4, 'square', v * 0.6, 900);
        this.noise(0.4, v, 1200, 1, 0, 3000);
        break;
      case 'reformer':
        this.tone(523, 0.5, 'sine', v, 1046);
        this.tone(784, 0.5, 'sine', v * 0.7, 1568, 0.05);
        break;
    }
  }

  stunned(): void {
    this.tone(500, 0.6, 'sine', 0.12, 150);
  }

  kill(): void {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'square', 0.07, undefined, i * 0.07));
    this.noise(0.4, 0.12, 2500, 1.5, 0.05);
  }

  pop(near: number): void {
    this.noise(0.2, 0.15 * near, 800, 1);
  }

  death(): void {
    this.tone(330, 0.9, 'sawtooth', 0.12, 55);
    this.noise(0.6, 0.2, 300, 0.7);
  }

  click(): void {
    this.tone(900, 0.05, 'triangle', 0.08);
  }
}
