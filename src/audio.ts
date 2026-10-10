import type { ArchetypeId } from './game/characters';
import type { FoodKind } from './game/food';
import { MenuMusic } from './music';

const MASTER = 0.85;

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

  private music: MenuMusic | null = null;
  private wantMusic = false;
  musicEnabled = true;
  private silentEl: HTMLAudioElement | null = null;
  private unlocked = false;

  /**
   * Must be called from a user gesture (browser autoplay rules).
   * iOS only counts touchend / click / keydown as gestures, mutes Web Audio when the
   * ring/silent switch is on, and can leave the context "interrupted" after a call or
   * app switch, so this handles all three.
   */
  unlock(): void {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    const isTouch = document.documentElement.classList.contains('touch');
    // iPhone/iPad: play through the ring/silent switch like a game/video would (Safari 17+).
    // Isolated so a browser that exposes but rejects this (e.g. desktop Safari) can't block audio.
    if (isTouch && nav.audioSession) {
      try {
        if (nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
      } catch {
        /* not supported here */
      }
    }
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER;
        // gentle limiter so everything can be louder without clipping on laptop/phone speakers
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 10;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const ctx = this.ctx;
      if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);

      if (!this.unlocked) {
        // iOS: a sound must actually start inside the gesture to unlock output
        const b = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.connect(ctx.destination);
        src.start(0);
        // older iOS without audioSession: a looping silent <audio> switches the
        // page to "media playback", so the ring/silent switch no longer mutes it
        if (isTouch && !nav.audioSession) {
          if (!this.silentEl) {
            this.silentEl = new Audio(silentWavUrl());
            this.silentEl.loop = true;
            this.silentEl.setAttribute('playsinline', '');
            this.silentEl.volume = 0.01;
          }
          void this.silentEl.play().catch(() => undefined);
        }
        this.unlocked = true;
      }
      this.syncMusic();
    } catch {
      /* audio unavailable — game continues silently */
    }
  }

  /** Call when the page becomes visible again (iOS suspends audio in the background). */
  /** Menu tune: wanted on the candidate screen, off during play. */
  setMenuMusic(want: boolean): void {
    this.wantMusic = want;
    this.syncMusic();
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    this.syncMusic();
  }

  private syncMusic(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const on = this.wantMusic && this.musicEnabled && !this.muted && !document.hidden;
    if (on) {
      if (!this.music) this.music = new MenuMusic(this.ctx, this.master, this.noiseBuf);
      this.music.start();
    } else this.music?.stop();
  }

  wake(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
    this.syncMusic();
    if (this.silentEl && this.silentEl.paused && this.unlocked) void this.silentEl.play().catch(() => undefined);
  }

  /** Pause background audio work while hidden. */
  sleep(): void {
    this.silentEl?.pause();
    this.music?.stop(0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.syncMusic();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.02);
  }

  private ready(): AudioContext | null {
    if (this.muted || !this.ctx || !this.master) return null;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined); // e.g. 'interrupted' after a phone call
      return null;
    }
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

let silentUrl: string | null = null;
/** 0.25 s of silent 8 kHz mono PCM as a blob URL (no audio files shipped). */
function silentWavUrl(): string {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const n = rate / 4;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}
