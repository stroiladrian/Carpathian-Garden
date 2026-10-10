import { Sfx } from './audio';
import { ARCHETYPES, ArchetypeId } from './game/characters';
import { AI_COUNT, TICK } from './game/config';
import type { GameEvent } from './game/effects';
import { clamp } from './game/math';
import { Session } from './game/session';
import type { Worm } from './game/worm';
import { Input } from './input';
import { renderPortrait } from './render/heads';
import { Camera, Minimap, Renderer } from './render/renderer';
import { loadSave, writeSave } from './storage';
import { $, formatLei, formatTime } from './ui/dom';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';

type State = 'menu' | 'playing' | 'paused' | 'gameover';

const MAX_STEPS_PER_FRAME = 8;

export class App {
  private renderer: Renderer;
  private minimap: Minimap;
  private input: Input;
  private sfx: Sfx;
  private menu: Menu;
  private hud = new Hud();
  private session: Session;
  private state: State = 'menu';
  private cam: Camera = { x: 0, y: 0, zoom: 0.7 };
  private acc = 0;
  private last = 0;
  private hudTimer = 0;
  private save = loadSave();
  private runTime = 0;
  private bestRank = 99;
  private demoFocus: Worm | null = null;
  private demoSwitchAt = 0;
  private gameoverShowAt = 0;
  private deathSpot = { x: 0, y: 0 };
  private wasBoosting = false;
  private realTime = 0;

  constructor() {
    const canvas = $('game') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas);
    this.minimap = new Minimap($('minimap') as HTMLCanvasElement, this.renderer.terrain);
    this.input = new Input(canvas);
    this.sfx = new Sfx(this.save.muted);
    this.session = new Session({ aiCount: 12, demo: true });

    this.menu = new Menu(this.save.character, this.save.nickname, {
      onPlay: () => this.startGame(),
      onToggleSound: () => this.toggleMute(),
      onSelect: (id: ArchetypeId) => {
        this.sfx.unlock();
        this.sfx.click();
        writeSave({ character: id });
      },
    });
    this.menu.setBest(this.save.best);
    this.menu.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);

    this.bindUi();
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener('blur', () => this.pause());
    // first gesture anywhere unlocks audio
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { once: false });
    window.addEventListener('keydown', () => this.sfx.unlock(), { once: false });

    this.renderer.terrain.warm(0, 0, 1200);
    requestAnimationFrame((t) => {
      this.last = t;
      requestAnimationFrame(this.frame);
    });
  }

  private bindUi(): void {
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-sound').addEventListener('click', () => this.toggleMute());
    $('p-resume').addEventListener('click', () => this.resume());
    $('p-restart').addEventListener('click', () => this.startGame());
    $('p-menu').addEventListener('click', () => this.toMenu());
    $('go-retry').addEventListener('click', () => this.startGame());
    $('go-menu').addEventListener('click', () => this.toMenu());

    const boost = this.hud.boostBtn;
    const on = (e: Event) => {
      e.preventDefault();
      this.input.boostButton = true;
    };
    const off = () => (this.input.boostButton = false);
    boost.addEventListener('pointerdown', on);
    boost.addEventListener('pointerup', off);
    boost.addEventListener('pointerleave', off);
    boost.addEventListener('pointercancel', off);
    this.hud.abilityBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueAbility();
    });

    this.input.onKey = (code) => {
      if (code === 'KeyM') this.toggleMute();
      else if (code === 'Escape' || code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      } else if (code === 'Enter') {
        if (this.state === 'menu') this.startGame();
        else if (this.state === 'gameover' && !$('gameover').hidden) this.startGame();
      } else if (code === 'KeyR' && this.state === 'paused') this.startGame();
    };
  }

  // ───────────────────────────── state transitions ─────────────────────────────

  startGame(): void {
    this.sfx.unlock();
    const arch = ARCHETYPES[this.menu.selected];
    const name = this.menu.nickname || 'Domnul Candidat';
    writeSave({ nickname: this.menu.nickname, character: arch.id });
    this.session = new Session({ aiCount: AI_COUNT, player: { name, arch } });
    const p = this.session.player!;
    this.cam = { x: p.head.x, y: p.head.y, zoom: this.renderer.zoomFor(p.radius) };
    this.renderer.terrain.warm(p.head.x, p.head.y, 1100);
    this.acc = 0;
    this.runTime = 0;
    this.bestRank = 99;
    this.input.reset();
    this.hud.setArchetype(arch);
    this.hud.clearToasts();
    this.menu.hide();
    $('pause').hidden = true;
    $('gameover').hidden = true;
    this.hud.show();
    this.state = 'playing';
    const touch = window.matchMedia('(pointer: coarse)').matches;
    this.hud.toast(`${arch.abilityName} is ready — ${touch ? 'tap the portrait button' : 'press E'}!`, 'good');
  }

  toMenu(): void {
    this.state = 'menu';
    this.session = new Session({ aiCount: 12, demo: true });
    this.demoFocus = null;
    $('pause').hidden = true;
    $('gameover').hidden = true;
    this.hud.hide();
    this.menu.setBest(this.save.best);
    this.menu.show();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.reset();
    $('pause').hidden = false;
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.acc = 0;
    $('pause').hidden = true;
  }

  private toggleMute(): void {
    this.sfx.unlock();
    this.save.muted = !this.save.muted;
    this.sfx.setMuted(this.save.muted);
    writeSave({ muted: this.save.muted });
    this.menu.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);
  }

  private gameOver(p: Worm): void {
    this.state = 'gameover';
    this.deathSpot = { x: p.head.x, y: p.head.y };
    this.gameoverShowAt = this.realTime + 1.3;
    const peak = Math.floor(p.peakMass);
    const isBest = peak > this.save.best;
    if (isBest) {
      this.save.best = peak;
      writeSave({ best: peak });
    }
    $('go-title').textContent = p.deathCause === 'border' ? 'Exiled from the country!' : 'Your campaign is over!';
    $('go-cause').textContent =
      p.deathCause === 'border'
        ? 'You wandered past the border. Nobody expects to see you again (until the next election).'
        : `Out-manoeuvred by ${p.killedBy ?? 'a rival'}. The scandal broke at dawn.`;
    $('go-score').textContent = Math.floor(p.mass).toLocaleString('en-US');
    $('go-peak').textContent = peak.toLocaleString('en-US');
    $('go-rank').textContent = this.bestRank < 99 ? `#${this.bestRank}` : '-';
    $('go-kills').textContent = String(p.kills);
    $('go-lei').textContent = formatLei(p.money);
    $('go-time').textContent = formatTime(this.runTime);
    $('go-best').textContent = isBest ? '★ New personal best! ★' : `Best score: ${this.save.best.toLocaleString('en-US')}`;
    renderPortrait($('go-portrait') as HTMLCanvasElement, p.arch, 'dead', 0);
  }

  // ───────────────────────────── main loop ─────────────────────────────

  private frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.realTime += dt;
    try {
      this.update(dt);
      this.draw();
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const s = this.session;
    const simulate = this.state !== 'paused';
    if (simulate) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK && steps < MAX_STEPS_PER_FRAME) {
        let control = null;
        if (this.state === 'playing' && s.player?.alive) {
          const h = s.player.head;
          const sc = this.renderer.worldToScreen(this.cam, h.x, h.y);
          control = this.input.getControl(sc.x, sc.y);
        }
        s.tick(control);
        this.acc -= TICK;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
      if (this.state === 'playing') this.runTime += dt;
    }

    this.handleEvents(s.drainEvents());

    if (this.state === 'playing' && s.player && !s.player.alive) this.gameOver(s.player);
    if (this.state === 'gameover' && $('gameover').hidden && this.realTime >= this.gameoverShowAt) {
      $('gameover').hidden = false;
    }

    this.updateCamera(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && (this.state === 'playing' || this.state === 'paused') && s.player) {
      this.hudTimer = 0.1;
      const rank = s.rankOf(s.player);
      if (s.player.alive) this.bestRank = Math.min(this.bestRank, rank);
      this.hud.update(s.player, rank, s.world.worms.length, s.world.leaderboard());
    }
    if (this.state === 'menu') this.menu.animate(this.realTime);
  }

  private handleEvents(events: GameEvent[]): void {
    const p = this.session.player;
    if (!p || this.state === 'menu') return;
    for (const e of events) {
      switch (e.t) {
        case 'eat':
          if (e.w === p.id) this.sfx.pickup(e.kind);
          break;
        case 'death': {
          if (e.victim === p.id) {
            this.sfx.death();
          } else if (e.killer === p.id) {
            this.sfx.kill();
            this.hud.toast(`You eliminated ${e.victimName}!`, 'good');
          } else {
            const d = Math.hypot(e.x - p.head.x, e.y - p.head.y);
            if (d < 900) this.sfx.pop(1 - d / 900);
            if (e.mass > 250 && p.alive) this.hud.toast(`${e.victimName} has fallen (${Math.floor(e.mass)})`);
          }
          break;
        }
        case 'ability': {
          if (e.w === p.id) this.sfx.ability(e.ab, 1);
          else {
            const d = Math.hypot(e.x - p.head.x, e.y - p.head.y);
            if (d < 700) this.sfx.ability(e.ab, 0.5 * (1 - d / 700));
          }
          break;
        }
        case 'stunned':
          if (e.w === p.id) {
            this.sfx.stunned();
            this.hud.toast('Out-shouted! You are stunned.', 'bad');
          }
          break;
      }
    }
    if (p.alive && p.boosting && !this.wasBoosting && p.arch.id !== 'baron') this.sfx.boost();
    this.wasBoosting = p.alive && p.boosting;
  }

  private updateCamera(dt: number): void {
    const s = this.session;
    const k = 1 - Math.exp(-dt * 9);
    const alpha = clamp(this.acc / TICK, 0, 1);
    let tx = this.cam.x;
    let ty = this.cam.y;
    let tz = this.cam.zoom;
    if (this.state === 'menu') {
      const w = s.world;
      if (!this.demoFocus || !this.demoFocus.alive || this.realTime > this.demoSwitchAt) {
        const pool = w.worms.filter((x) => x.mass > 60);
        this.demoFocus = pool[Math.floor(Math.random() * pool.length)] ?? w.worms[0] ?? null;
        this.demoSwitchAt = this.realTime + 14;
      }
      if (this.demoFocus) {
        tx = this.demoFocus.head.x;
        ty = this.demoFocus.head.y;
      }
      tz = this.renderer.zoomFor(26) * 1.05;
      const kk = 1 - Math.exp(-dt * 1.5);
      this.cam.x += (tx - this.cam.x) * kk;
      this.cam.y += (ty - this.cam.y) * kk;
      this.cam.zoom += (tz - this.cam.zoom) * kk;
      return;
    }
    const p = s.player;
    if (p && p.alive) {
      const h = p.head;
      tx = h.px + (h.x - h.px) * alpha;
      ty = h.py + (h.y - h.py) * alpha;
      tz = this.renderer.zoomFor(p.radius);
      // keep the head locked (no lag) so steering by mouse feels precise
      this.cam.x = tx;
      this.cam.y = ty;
    } else {
      tx = this.deathSpot.x;
      ty = this.deathSpot.y;
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    this.cam.zoom += (tz - this.cam.zoom) * (1 - Math.exp(-dt * 2));
  }

  private draw(): void {
    const s = this.session;
    const alpha = this.state === 'paused' ? 1 : clamp(this.acc / TICK, 0, 1);
    const focus = this.state === 'menu' ? null : s.player;
    this.renderer.render(s.world, this.cam, alpha, focus && focus.alive ? focus : null);
    if (this.state !== 'menu') this.minimap.draw(s.world, focus, this.realTime);
  }

  /** Debug/test hook. */
  get debug() {
    return { state: this.state, session: this.session, cam: this.cam };
  }
}
