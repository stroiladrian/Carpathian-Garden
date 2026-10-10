import type { Archetype } from '../game/characters';
import { MIN_BOOST_MASS } from '../game/config';
import type { Worm } from '../game/worm';
import { renderPortrait } from '../render/heads';
import { titleFor } from '../game/difficulty';
import { POWERS, PowerId } from '../game/powers';
import { $, el, formatLei, soundIcon } from './dom';

export class Hud {
  readonly root = $('hud');
  private score = $('h-score');
  private title = $('h-title');
  private heat = $('h-heat');
  private lei = $('h-lei');
  private rank = $('h-rank');
  private len = $('h-len');
  private kills = $('h-kills');
  private lb = $('lb') as HTMLOListElement;
  private soundBtn = $('btn-sound');
  readonly boostBtn = $('btn-boost');
  private boostMeter = $('boost-meter');
  readonly abilityBtn = $('btn-ability');
  private abilityCd = $('ability-cd');
  private abilityCdText = $('ability-cd-text');
  private abilityName = $('ability-name');
  private abilityIcon = $('ability-icon') as HTMLCanvasElement;
  private toasts = $('toasts');
  private lastLb = '';
  private lbBox = $('leaderboard');
  private joyEl = $('joystick');
  private joyKnob = this.joyEl.querySelector('.joy-knob') as HTMLElement;
  private joyShown = false;
  private powerBtns = new Map<PowerId, { btn: HTMLButtonElement; cd: HTMLElement; txt: HTMLElement }>();
  onPower: ((id: PowerId) => void) | null = null;

  buildPowers(): void {
    const wrap = $('powers');
    wrap.replaceChildren();
    this.powerBtns.clear();
    for (const p of POWERS) {
      const btn = el('button', 'power');
      btn.type = 'button';
      btn.hidden = true;
      btn.title = `${p.name} (${p.key}): ${p.desc}`;
      btn.setAttribute('aria-label', p.name);
      btn.style.setProperty('--pc', p.color);
      const ab = el('b', 'p-abbr', p.abbr);
      const key = el('small', 'p-key kbd-hint', p.key);
      const cd = el('div', 'cd');
      const txt = el('b');
      cd.append(txt);
      btn.append(ab, key, cd);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onPower?.(p.id);
      });
      wrap.append(btn);
      this.powerBtns.set(p.id, { btn, cd, txt });
    }
  }

  constructor() {
    if (document.documentElement.classList.contains('touch')) this.lbBox.classList.add('compact');
  }

  toggleLeaderboard(): void {
    this.lbBox.classList.toggle('compact');
  }

  /** Positions the floating thumb joystick (null hides it). */
  drawJoystick(j: { active: boolean; ox: number; oy: number; kx: number; ky: number } | null, radius: number, boosting: boolean): void {
    const show = !!j && j.active;
    if (show !== this.joyShown) {
      this.joyEl.classList.toggle('on', show);
      this.joyShown = show;
    }
    this.boostBtn.classList.toggle('touching', boosting);
    if (!show || !j) return;
    this.joyEl.style.transform = `translate(${j.ox - radius}px, ${j.oy - radius}px)`;
    this.joyKnob.style.transform = `translate(${j.kx - j.ox}px, ${j.ky - j.oy}px)`;
  }

  setArchetype(a: Archetype): void {
    this.abilityName.textContent = a.abilityName;
    renderPortrait(this.abilityIcon, a, 'power', 0);
  }

  setMuted(m: boolean): void {
    this.soundBtn.innerHTML = soundIcon(m);
  }

  show(): void {
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
  }

  update(p: Worm, rank: number, total: number, board: Worm[]): void {
    this.score.textContent = Math.floor(p.mass).toLocaleString('ro-RO');
    this.heat.style.width = `${Math.min(100, p.heat)}%`;
    this.heat.parentElement!.classList.toggle('hot', p.heat >= 70);
    this.heat.parentElement!.classList.toggle('warm', p.heat > 0);
    const t = titleFor(p.peakMass);
    if (this.title.textContent !== t) this.title.textContent = t;
    this.lei.textContent = formatLei(p.money);
    this.rank.textContent = `#${rank}/${total}`;
    this.len.textContent = `${p.segs.length}`;
    this.kills.textContent = `${p.kills}`;

    // office powers
    for (const pd of POWERS) {
      const ui = this.powerBtns.get(pd.id);
      if (!ui) continue;
      const unlocked = p.peakMass >= pd.unlockAt;
      if (ui.btn.hidden === unlocked) ui.btn.hidden = !unlocked;
      if (!unlocked) continue;
      const cd = p.powerCd[pd.id] ?? 0;
      const active = (pd.id === 'judge' && p.legalT > 0) || (pd.id === 'licit' && p.licitT > 0);
      ui.btn.classList.toggle('ready', cd <= 0);
      ui.btn.classList.toggle('active', active);
      ui.cd.style.setProperty('--p', cd > 0 ? String(cd / pd.cooldown) : '0');
      ui.txt.textContent = cd > 0 ? String(Math.ceil(cd)) : '';
    }

    // boost
    const canBoost = p.mass > MIN_BOOST_MASS;
    this.boostBtn.classList.toggle('on', p.boosting);
    this.boostBtn.classList.toggle('low', !canBoost);
    this.boostMeter.style.width = `${Math.min(100, ((p.mass - MIN_BOOST_MASS) / 120) * 100)}%`;

    // ability
    const a = p.arch;
    const active = p.abilityT > 0;
    const ready = p.abilityCd <= 0;
    this.abilityBtn.classList.toggle('ready', ready && !active);
    this.abilityBtn.classList.toggle('active', active);
    this.abilityCd.style.setProperty('--p', ready ? '0' : String(p.abilityCd / a.cooldown));
    this.abilityCdText.textContent = ready ? '' : String(Math.ceil(p.abilityCd));

    // leaderboard (only touch the DOM when it changes)
    const top = board.slice(0, 10);
    const meIdx = board.indexOf(p);
    const rows = top.map((w, i) => ({ n: i + 1, w }));
    const showMe = meIdx >= 10;
    const key = rows.map((r) => `${r.w.id}:${Math.floor(r.w.mass)}`).join('|') + (showMe ? `|me${meIdx}:${Math.floor(p.mass)}` : '');
    if (key === this.lastLb) return;
    this.lastLb = key;
    this.lb.replaceChildren();
    const add = (n: number, w: Worm) => {
      const li = el('li', w === p ? 'me' : undefined);
      const dot = el('span', 'dot');
      dot.style.background = w.colors.a;
      li.append(el('span', 'n', `${n}`), dot, el('span', 'nm', w.name), el('span', 'sc', Math.floor(w.mass).toLocaleString('ro-RO')));
      this.lb.append(li);
    };
    for (const r of rows) add(r.n, r.w);
    if (showMe) {
      this.lb.append(el('li', 'gap', '⋯'));
      add(meIdx + 1, p);
    }
  }

  toast(text: string, kind: 'good' | 'bad' | '' = ''): void {
    const t = el('div', `toast ${kind}`, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.remove(), 2900);
  }

  clearToasts(): void {
    this.toasts.replaceChildren();
    this.lastLb = '';
  }
}
