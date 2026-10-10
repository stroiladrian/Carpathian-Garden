import { ARCHETYPE_LIST, ArchetypeId } from '../game/characters';
import { renderPortrait } from '../render/heads';
import { $, el, soundIcon } from './dom';

export interface MenuHandlers {
  onPlay: () => void;
  onToggleSound: () => void;
  onSelect: (id: ArchetypeId) => void;
}

export class Menu {
  readonly root = $('menu');
  private nick = $('nick') as HTMLInputElement;
  private best = $('best');
  private soundBtn = $('menu-sound');
  private cards = new Map<ArchetypeId, HTMLButtonElement>();
  private portraits = new Map<ArchetypeId, HTMLCanvasElement>();
  selected: ArchetypeId;

  constructor(selected: ArchetypeId, nickname: string, h: MenuHandlers) {
    this.selected = selected;
    this.nick.value = nickname;
    const wrap = $('chars');
    for (const a of ARCHETYPE_LIST) {
      const card = el('button', 'char');
      card.type = 'button';
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-label', a.name);
      const cv = el('canvas');
      cv.width = 220;
      cv.height = 220;
      renderPortrait(cv, a, 'normal', 0);
      const stripe = el('div', 'stripe');
      stripe.style.background = `linear-gradient(90deg, ${a.colors.a} 50%, ${a.colors.b} 50%)`;
      const body = el('div', 'body');
      body.append(el('h3', undefined, a.name), el('p', 'tag', a.tagline));
      const p = el('div', 'perk p');
      p.append(el('b', undefined, `Pasiv · ${a.passiveName}`), document.createTextNode(a.passiveDesc));
      const ab = el('div', 'perk a');
      ab.append(el('b', undefined, `Abilitate · ${a.abilityName} (${a.cooldown}s)`), document.createTextNode(a.abilityDesc));
      body.append(p, ab);
      card.append(cv, stripe, body, el('span', 'check', '✓'));
      card.addEventListener('click', () => {
        this.select(a.id);
        h.onSelect(a.id);
      });
      card.addEventListener('dblclick', () => h.onPlay());
      wrap.append(card);
      this.cards.set(a.id, card);
      this.portraits.set(a.id, cv);
    }
    this.select(selected);
    $('play').addEventListener('click', () => h.onPlay());
    this.soundBtn.addEventListener('click', () => h.onToggleSound());
    this.nick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') h.onPlay();
    });
  }

  select(id: ArchetypeId): void {
    this.selected = id;
    for (const [k, c] of this.cards) {
      c.setAttribute('aria-checked', String(k === id));
      c.tabIndex = 0;
    }
    for (const a of ARCHETYPE_LIST) {
      if (a.id !== id) renderPortrait(this.portraits.get(a.id)!, a, 'normal', 0);
    }
  }

  get nickname(): string {
    return this.nick.value.trim().slice(0, 18);
  }

  setBest(n: number): void {
    this.best.textContent = Math.floor(n).toLocaleString('ro-RO');
  }

  setMuted(m: boolean): void {
    this.soundBtn.innerHTML = `${soundIcon(m)} <span>${m ? 'Sunet oprit' : 'Sunet pornit'}</span>`;
    this.soundBtn.style.display = 'inline-flex';
    this.soundBtn.style.alignItems = 'center';
    this.soundBtn.style.gap = '6px';
  }

  show(): void {
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
  }

  /** Animates the selected character's portrait. */
  animate(t: number): void {
    if (this.root.hidden) return;
    const a = ARCHETYPE_LIST.find((x) => x.id === this.selected)!;
    const cv = this.portraits.get(this.selected)!;
    const cycle = t % 6;
    renderPortrait(cv, a, cycle > 4.6 && cycle < 5.6 ? 'power' : 'normal', t);
  }
}
