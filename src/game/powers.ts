/**
 * Office powers ("puteri de funcție"): unlocked by the player's peak power as they
 * climb the titles, each on its own long cooldown. Player-only, as a reward.
 */
export type PowerId = 'asfalt' | 'judge' | 'oug' | 'licit';

export interface PowerDef {
  id: PowerId;
  /** Short label on the HUD button. */
  abbr: string;
  name: string;
  desc: string;
  /** Peak power needed (matches the title thresholds in difficulty.ts). */
  unlockAt: number;
  unlockTitle: string;
  cooldown: number;
  /** Keyboard key shown in the UI. */
  key: string;
  color: string;
}

export const POWERS: PowerDef[] = [
  {
    id: 'asfalt',
    abbr: 'ASF',
    name: 'Asfaltare electorală',
    desc: 'Apar bani și contracte în jurul tău, fix înainte de alegeri.',
    unlockAt: 80,
    unlockTitle: 'Primar',
    cooldown: 30,
    key: '1',
    color: '#8d8f96',
  },
  {
    id: 'judge',
    abbr: 'TEL',
    name: 'Un telefon la judecătoare',
    desc: 'Dosarul se clasează: radarul anti-șpagă scade la zero și ești de neatins 6 secunde.',
    unlockAt: 200,
    unlockTitle: 'Baron de județ',
    cooldown: 60,
    key: '2',
    color: '#8e44ad',
  },
  {
    id: 'oug',
    abbr: 'OUG',
    name: 'Ordonanță de urgență',
    desc: 'Un contract special doar pentru tine, plus plicuri care nu apar pe radar.',
    unlockAt: 400,
    unlockTitle: 'Senator',
    cooldown: 70,
    key: '3',
    color: '#d4a017',
  },
  {
    id: 'licit',
    abbr: 'LIC',
    name: 'Licitație cu dedicație',
    desc: 'Timp de 4 secunde, toate contractele, servietele și plicurile din zonă vin direct la tine.',
    unlockAt: 700,
    unlockTitle: 'Ministru',
    cooldown: 55,
    key: '4',
    color: '#ce1126',
  },
];

export const POWER_BY_ID: Record<PowerId, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;
