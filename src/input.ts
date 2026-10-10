import type { ControlInput } from './game/worm';

export type TouchSteer = 'joystick' | 'follow';

/** Visual state of the floating joystick, read by the HUD each frame. */
export interface JoystickView {
  active: boolean;
  ox: number;
  oy: number;
  kx: number;
  ky: number;
}

const JOY_RADIUS = 62;

/**
 * Collects mouse, keyboard and touch state and turns it into a ControlInput.
 *
 * Desktop: the head steers toward the mouse; WASD/arrows steer in 8 directions.
 * Touch (joystick mode): the first finger on the left ~60% of the screen spawns a
 *   floating joystick wherever it lands; any other finger held on the arena boosts.
 * Touch (follow mode): the first finger steers toward where it touches.
 */
export class Input {
  private mx = 0;
  private my = 0;
  private pointerKnown = false;
  private mouseDown = false;
  private keys = new Set<string>();
  private usingKeys = false;
  private abilityQueued = false;

  touchSteer: TouchSteer = 'joystick';
  private steerId: number | null = null;
  private boostIds = new Set<number>();
  private joyAngle: number | null = null;
  readonly joy: JoystickView = { active: false, ox: 0, oy: 0, kx: 0, ky: 0 };
  /** Last control came from touch (used to adapt hints). */
  touchActive = false;
  /** Fires on the first touch steer of a run (dismisses the tutorial hint). */
  onTouchSteer: (() => void) | null = null;

  /** Set by on-screen buttons. */
  boostButton = false;
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (Math.abs(e.clientX - this.mx) + Math.abs(e.clientY - this.my) > 3) this.usingKeys = false;
        this.mx = e.clientX;
        this.my = e.clientY;
        this.pointerKnown = true;
        this.touchActive = false;
      } else {
        this.touchMove(e);
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouseDown = true;
        if (e.button === 2) this.abilityQueued = true;
        return;
      }
      e.preventDefault();
      this.touchDown(e);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouseDown = false;
        return;
      }
      this.touchUp(e);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // stop iOS from scrolling/zooming the page under the game
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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

  // ───────────── touch ─────────────

  private touchDown(e: PointerEvent): void {
    this.touchActive = true;
    this.usingKeys = false;
    const leftZone = e.clientX < window.innerWidth * 0.6;
    if (this.steerId === null && (this.touchSteer === 'follow' || leftZone || this.boostIds.size > 0)) {
      this.steerId = e.pointerId;
      if (this.touchSteer === 'joystick') {
        this.joy.active = true;
        this.joy.ox = this.joy.kx = e.clientX;
        this.joy.oy = this.joy.ky = e.clientY;
      } else {
        this.mx = e.clientX;
        this.my = e.clientY;
        this.pointerKnown = true;
      }
      this.onTouchSteer?.();
    } else {
      this.boostIds.add(e.pointerId);
    }
  }

  private touchMove(e: PointerEvent): void {
    if (e.pointerId !== this.steerId) return;
    if (this.touchSteer === 'follow') {
      this.mx = e.clientX;
      this.my = e.clientY;
      return;
    }
    const j = this.joy;
    let dx = e.clientX - j.ox;
    let dy = e.clientY - j.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_RADIUS) {
      // drag the base along so reversing direction is instant
      j.ox += (dx / d) * (d - JOY_RADIUS);
      j.oy += (dy / d) * (d - JOY_RADIUS);
      dx = e.clientX - j.ox;
      dy = e.clientY - j.oy;
    }
    j.kx = e.clientX;
    j.ky = e.clientY;
    if (Math.hypot(dx, dy) > 7) this.joyAngle = Math.atan2(dy, dx);
  }

  private touchUp(e: PointerEvent): void {
    if (e.pointerId === this.steerId) {
      this.steerId = null;
      this.joy.active = false;
      if (this.touchSteer === 'follow') this.pointerKnown = false;
    }
    this.boostIds.delete(e.pointerId);
  }

  get boostingByTouch(): boolean {
    return this.boostIds.size > 0;
  }

  get joystickRadius(): number {
    return JOY_RADIUS;
  }

  // ───────────── shared ─────────────

  reset(): void {
    this.keys.clear();
    this.mouseDown = false;
    this.boostButton = false;
    this.abilityQueued = false;
    this.boostIds.clear();
    this.steerId = null;
    this.joy.active = false;
    this.joyAngle = null;
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
    } else if (this.touchActive && this.touchSteer === 'joystick') {
      angle = this.joyAngle; // keeps the last heading after the thumb lifts
    } else if (this.pointerKnown) {
      const dx = this.mx - headX;
      const dy = this.my - headY;
      if (dx * dx + dy * dy > 16) angle = Math.atan2(dy, dx);
    }
    const boost =
      this.mouseDown || this.boostButton || this.boostIds.size > 0 || k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight');
    const ability = this.abilityQueued;
    this.abilityQueued = false;
    return { angle, boost, ability };
  }

  /** Seeds the joystick heading so the worm doesn't snap when a run starts. */
  setHeading(angle: number): void {
    this.joyAngle = angle;
  }
}

const DIR_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
