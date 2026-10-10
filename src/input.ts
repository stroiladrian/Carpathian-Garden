import type { ControlInput } from './game/worm';

/**
 * Collects mouse, keyboard and touch state and turns it into a ControlInput.
 * Mouse/touch steer toward the pointer; WASD/arrows steer in 8 directions.
 */
export class Input {
  private mx = 0;
  private my = 0;
  private pointerKnown = false;
  private mouseDown = false;
  private keys = new Set<string>();
  private usingKeys = false;
  private abilityQueued = false;
  /** Set by on-screen buttons (mobile). */
  boostButton = false;
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (Math.abs(e.clientX - this.mx) + Math.abs(e.clientY - this.my) > 3) this.usingKeys = false;
        this.mx = e.clientX;
        this.my = e.clientY;
        this.pointerKnown = true;
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouseDown = true;
        if (e.button === 2) this.abilityQueued = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      this.mx = t.clientX;
      this.my = t.clientY;
      this.pointerKnown = true;
      this.usingKeys = false;
    };
    canvas.addEventListener('touchstart', touch, { passive: false });
    canvas.addEventListener('touchmove', touch, { passive: false });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT') return;
      if (DIR_KEYS.has(e.code)) {
        this.usingKeys = true;
        e.preventDefault();
      }
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyQ')) this.abilityQueued = true;
      this.keys.add(e.code);
      this.onKey?.(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
  }

  reset(): void {
    this.keys.clear();
    this.mouseDown = false;
    this.boostButton = false;
    this.abilityQueued = false;
  }

  queueAbility(): void {
    this.abilityQueued = true;
  }

  getControl(headX: number, headY: number): ControlInput {
    let angle: number | null = null;
    const k = this.keys;
    if (this.usingKeys) {
      const dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (dx !== 0 || dy !== 0) angle = Math.atan2(dy, dx);
    } else if (this.pointerKnown) {
      const dx = this.mx - headX;
      const dy = this.my - headY;
      if (dx * dx + dy * dy > 16) angle = Math.atan2(dy, dx);
    }
    const boost = this.mouseDown || this.boostButton || k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight');
    const ability = this.abilityQueued;
    this.abilityQueued = false;
    return { angle, boost, ability };
  }
}

const DIR_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
