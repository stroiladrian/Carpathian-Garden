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
import { DIFFICULTIES, DIFFICULTY_LIST, DifficultyId, titleFor } from './game/difficulty';
import { POWERS, POWER_BY_ID } from './game/powers';

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
  private readonly isTouch = document.documentElement.classList.contains('touch');
  private hintHideAt = 0;
  // adaptive quality
  private perfWindow = 0;
  private perfFrames = 0;
  private slowStreak = 0;
  private lastTitle = '';
  private reachedTop = false;
  private unlockedPowers = new Set<string>();

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
    this.input.touchSteer = this.save.touchSteer;
    this.input.onTouchSteer = () => {
      if (!$('touch-hint').hidden) this.hintHideAt = Math.min(this.hintHideAt, this.realTime + 1.2);
    };
    if (this.isTouch) {
      // phones: start a notch lower on resolution and particles
      this.renderer.maxDpr = 1.75;
      this.renderer.resize();
    }

    this.sfx.setMusicEnabled(this.save.music);
    this.sfx.setMenuMusic(true);
    this.bindUi();
    const onResize = () => this.renderer.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener('blur', () => this.pause());
    // first gesture anywhere unlocks audio
    // (iOS only treats touchend / click / keydown as gestures that may start audio)
    const unlock = () => this.sfx.unlock();
    for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.sfx.sleep() : this.sfx.wake()));
    window.addEventListener('pageshow', () => this.sfx.wake());

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
    $('leaderboard').addEventListener('click', () => this.hud.toggleLeaderboard());
    this.hud.buildPowers();
    const musicBtn = $('menu-music');
    const paintMusic = () => {
      musicBtn.innerHTML = `${musicIcon(this.save.music)} <span>${this.save.music ? 'Muzică pornită' : 'Muzică oprită'}</span>`;
    };
    paintMusic();
    musicBtn.addEventListener('click', () => {
      this.save.music = !this.save.music;
      writeSave({ music: this.save.music });
      this.sfx.unlock();
      this.sfx.setMusicEnabled(this.save.music);
      paintMusic();
    });
    this.hud.onPower = (id) => this.input.queuePower(id);
    $('play-sticky').addEventListener('click', () => this.startGame());

    // touch steering mode
    const setSteer = (m: 'joystick' | 'follow') => {
      this.input.touchSteer = m;
      this.save.touchSteer = m;
      writeSave({ touchSteer: m });
      $('steer-joystick').setAttribute('aria-checked', String(m === 'joystick'));
      $('steer-follow').setAttribute('aria-checked', String(m === 'follow'));
    };
    // difficulty
    const seg = $('diff-seg');
    const setDiff = (id: DifficultyId) => {
      this.save.difficulty = id;
      writeSave({ difficulty: id });
      for (const b of Array.from(seg.children)) b.setAttribute('aria-checked', String((b as HTMLElement).dataset.id === id));
      $('diff-blurb').textContent = DIFFICULTIES[id].blurb;
    };
    for (const d of DIFFICULTY_LIST) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.id = d.id;
      b.textContent = d.label;
      b.addEventListener('click', () => {
        this.sfx.unlock();
        this.sfx.click();
        setDiff(d.id);
      });
      seg.append(b);
    }
    setDiff(this.save.difficulty in DIFFICULTIES ? this.save.difficulty : 'normal');

    $('steer-joystick').addEventListener('click', () => setSteer('joystick'));
    $('steer-follow').addEventListener('click', () => setSteer('follow'));
    setSteer(this.save.touchSteer);

    // fullscreen (Android / desktop; iOS Safari only via Add to Home Screen)
    const fs = $('menu-fullscreen');
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (this.isTouch && (root.requestFullscreen || root.webkitRequestFullscreen) && !isStandalone()) {
      fs.hidden = false;
      fs.addEventListener('click', () => {
        const req = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.();
        void Promise.resolve(req)
          .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('any'))
          .catch(() => undefined);
      });
    }
    if (isStandalone()) $('pwa-tip').hidden = true;

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
    this.sfx.setMenuMusic(false);
    const arch = ARCHETYPES[this.menu.selected];
    const name = this.menu.nickname || 'Domnul Candidat';
    writeSave({ nickname: this.menu.nickname, character: arch.id });
    this.session = new Session({ aiCount: AI_COUNT, player: { name, arch }, difficulty: DIFFICULTIES[this.save.difficulty] ?? DIFFICULTIES.normal });
    this.lastTitle = titleFor(0);
    this.reachedTop = false;
    this.unlockedPowers.clear();
    if (this.isTouch) this.session.world.effectsScale = 0.75;
    const p = this.session.player!;
    this.cam = { x: p.head.x, y: p.head.y, zoom: this.renderer.zoomFor(p.radius) };
    this.renderer.terrain.warm(p.head.x, p.head.y, 1100);
    this.acc = 0;
    this.runTime = 0;
    this.bestRank = 99;
    this.input.reset();
    this.input.setHeading(p.angle);
    this.hud.setArchetype(arch);
    this.hud.clearToasts();
    this.menu.hide();
    $('pause').hidden = true;
    $('gameover').hidden = true;
    this.hud.show();
    this.state = 'playing';
    this.hud.toast(`${arch.abilityName} e gata: ${this.isTouch ? 'atinge portretul' : 'apasă E'}!`, 'good');
    if (this.isTouch && !this.save.touchHintSeen && this.input.touchSteer === 'joystick') {
      $('touch-hint').hidden = false;
      this.hintHideAt = this.realTime + 7;
      this.save.touchHintSeen = true;
      writeSave({ touchHintSeen: true });
    }
  }

  toMenu(): void {
    this.state = 'menu';
    this.sfx.setMenuMusic(true);
    this.session = new Session({ aiCount: 12, demo: true });
    this.demoFocus = null;
    $('pause').hidden = true;
    $('gameover').hidden = true;
    $('touch-hint').hidden = true;
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
    $('go-title').textContent = p.deathCause === 'border' ? 'Exilat din țară!' : 'Cariera ta politică s-a încheiat!';
    $('go-cause').textContent =
      p.deathCause === 'border'
        ? 'Ai trecut granița. Nu te mai așteaptă nimeni înapoi (până la următoarele alegeri).'
        : `Te-a încolțit ${p.killedBy ?? 'un rival'}. Scandalul a izbucnit la prima oră.`;
    $('go-score').textContent = Math.floor(p.mass).toLocaleString('ro-RO');
    $('go-peak').textContent = peak.toLocaleString('ro-RO');
    $('go-rank').textContent = this.bestRank < 99 ? `#${this.bestRank}` : '-';
    $('go-kills').textContent = String(p.kills);
    $('go-lei').textContent = formatLei(p.money);
    $('go-time').textContent = formatTime(this.runTime);
    $('go-office').textContent = `Cea mai înaltă funcție: ${titleFor(p.peakMass)}${this.reachedTop ? ' · ai ajuns pe locul 1' : ''}`;
    $('go-best').textContent = isBest ? '★ Record personal nou! ★' : `Recordul tău: ${this.save.best.toLocaleString('ro-RO')}`;
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
      this.adaptQuality(dt);
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
      if (s.player.alive && this.state === 'playing') this.checkMilestones(s.player, rank);
    }
    if (this.state === 'menu') this.menu.animate(this.realTime);
    if (!$('touch-hint').hidden && (this.realTime >= this.hintHideAt || this.state !== 'playing')) $('touch-hint').hidden = true;
    this.hud.drawJoystick(this.state === 'playing' ? this.input.joy : null, this.input.joystickRadius, this.input.boostingByTouch);
  }

  /** Promotions and reaching #1: the small moments that make a run feel like winning. */
  private checkMilestones(p: Worm, rank: number): void {
    const title = titleFor(p.peakMass);
    if (title !== this.lastTitle) {
      this.lastTitle = title;
      this.hud.toast(`Promovat: ${title}!`, 'good');
      this.sfx.pickup('briefcase');
      buzz(30);
    }
    for (const pd of POWERS) {
      if (p.peakMass >= pd.unlockAt && !this.unlockedPowers.has(pd.id)) {
        this.unlockedPowers.add(pd.id);
        this.hud.toast(`Putere nouă: ${pd.name} (${this.isTouch ? 'buton ' + pd.abbr : 'tasta ' + pd.key})`, 'good');
      }
    }
    if (rank === 1 && !this.reachedTop && this.runTime > 3) {
      this.reachedTop = true;
      this.hud.toast('Ești pe locul 1! Toată țara e a ta.', 'good');
      this.sfx.kill();
      buzz([40, 40, 80]);
      const h = p.head;
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 120 + Math.random() * 260;
        this.session.world.emit('confetti', h.x, h.y, Math.cos(a) * v, Math.sin(a) * v, 1.4, 9, ['#002b7f', '#fcd116', '#ce1126'][i % 3]);
      }
    }
  }

  /** Drops render resolution on devices that can't hold ~45 fps. */
  private adaptQuality(dt: number): void {
    if (this.state !== 'playing') return;
    this.perfWindow += dt;
    this.perfFrames++;
    if (this.perfWindow < 2) return;
    const fps = this.perfFrames / this.perfWindow;
    this.perfWindow = 0;
    this.perfFrames = 0;
    this.slowStreak = fps < 45 ? this.slowStreak + 1 : 0;
    if (this.slowStreak >= 2 && this.renderer.maxDpr > 1) {
      this.renderer.maxDpr = Math.max(1, this.renderer.maxDpr - 0.5);
      this.renderer.resize();
      this.slowStreak = 0;
    }
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
            buzz([90, 50, 140]);
          } else if (e.killer === p.id) {
            this.sfx.kill();
            buzz([25, 30, 25]);
            this.hud.toast(`Ai eliminat: ${e.victimName}!`, 'good');
          } else {
            const d = Math.hypot(e.x - p.head.x, e.y - p.head.y);
            if (d < 900) this.sfx.pop(1 - d / 900);
            if (e.mass > 250 && p.alive) this.hud.toast(`A căzut: ${e.victimName} (${Math.floor(e.mass)})`);
          }
          break;
        }
        case 'ability': {
          if (e.w === p.id) {
            this.sfx.ability(e.ab, 1);
            buzz(20);
          }
          else {
            const d = Math.hypot(e.x - p.head.x, e.y - p.head.y);
            if (d < 700) this.sfx.ability(e.ab, 0.5 * (1 - d / 700));
          }
          break;
        }
        case 'power':
          if (e.w === p.id) {
            const pd = POWER_BY_ID[e.id as keyof typeof POWER_BY_ID];
            if (pd?.id === 'judge') this.hud.toast('Dosar clasat! Ești de neatins 6 secunde.', 'good');
            else if (pd?.id === 'oug') this.hud.toast('OUG adoptată noaptea: contract și plicuri doar pentru tine!', 'good');
            else if (pd?.id === 'licit') this.hud.toast('Licitație cu dedicație: totul vine la tine!', 'good');
            else this.hud.toast('Asfalt proaspăt, bani proaspeți!', 'good');
            this.sfx.special();
            buzz([20, 20, 40]);
          }
          break;
        case 'special':
          this.hud.toast(`CONTRACT SPECIAL în ${e.place}: ${e.label} (+${e.value}), ${e.ttl}s!`, 'good');
          this.sfx.special();
          break;
        case 'specialTaken':
          if (e.w === p.id) {
            this.hud.toast(`Ai câștigat: ${e.label}!`, 'good');
            buzz([30, 30, 60]);
          } else this.hud.toast(`${e.name} a pus mâna pe: ${e.label}.`);
          break;
        case 'specialExpired':
          this.hud.toast(`Anulat: ${e.label}. N-a observat nimeni.`);
          break;
        case 'heatWarning':
          if (e.w === p.id) this.hud.toast('Direcția Anti-Șpagă e cu ochii pe tine…', 'bad');
          break;
        case 'busted':
          if (e.w === p.id) {
            this.hud.toast(`ANCHETĂ! Bunuri confiscate (−${Math.round(e.lost)})`, 'bad');
            this.sfx.siren();
            buzz([60, 60, 60, 60, 120]);
          } else if (e.lost > 60) {
            this.hud.toast(`${e.name} e sub anchetă!`);
            const d = Math.hypot(e.x - p.head.x, e.y - p.head.y);
            if (d < 900) this.sfx.siren();
          }
          break;
        case 'stunned':
          if (e.w === p.id) {
            this.sfx.stunned();
            buzz(70);
            this.hud.toast('Te-a luat pe sus cu gura! Ești amețit.', 'bad');
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

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS) */
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function musicIcon(on: boolean): string {
  return on
    ? '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 17V5l11-2v12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 17V5l11-2v12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" opacity="0.5"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" opacity="0.5"/><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor" opacity="0.5"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}
