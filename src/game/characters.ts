/**
 * Playable archetypes. These are invented satirical political archetypes,
 * not depictions of any real person.
 */
export type ArchetypeId = 'firebrand' | 'tycoon' | 'baron' | 'reformer';

export interface BodyColors {
  a: string; // main stripe
  b: string; // second stripe
  glow: string;
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  title: string;
  tagline: string;
  passiveName: string;
  passiveDesc: string;
  abilityName: string;
  abilityDesc: string;
  cooldown: number;
  duration: number;
  colors: BodyColors;
  jacket: string;
  shirt: string;
  tie: string;
  hair: string;
  skin: string;
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  firebrand: {
    id: 'firebrand',
    name: 'Tribunul Tunător',
    title: 'The Firebrand',
    tagline: 'Never met a microphone he couldn’t shout into.',
    passiveName: 'Loud Presence',
    passiveDesc: '+15% turning agility',
    abilityName: 'Thunderous Tirade',
    abilityDesc: 'Stuns rivals within range for 2s — they slow down and lose steering.',
    cooldown: 14,
    duration: 0.7,
    colors: { a: '#cf2433', b: '#1c1c24', glow: '#ff5a4f' },
    jacket: '#1d1d26',
    shirt: '#f4f1ea',
    tie: '#d0202e',
    hair: '#141418',
    skin: '#f0c39a',
  },
  tycoon: {
    id: 'tycoon',
    name: 'Magnatul de Aur',
    title: 'The Golden Tycoon',
    tagline: 'Owns a football club, three palaces and opinions on everything.',
    passiveName: 'Gold Standard',
    passiveDesc: '+30% value from coins, banknotes and gold',
    abilityName: 'Golden Magnet',
    abilityDesc: 'For 5s every collectible in a huge radius flies into your pockets.',
    cooldown: 15,
    duration: 5,
    colors: { a: '#f2bf26', b: '#fff5d6', glow: '#ffd84d' },
    jacket: '#f6efdc',
    shirt: '#1b1b1b',
    tie: '#d4a017',
    hair: '#1a1410',
    skin: '#e8b289',
  },
  baron: {
    id: 'baron',
    name: 'Baronul de Partid',
    title: 'The Party Baron',
    tagline: 'Has a cousin in every ministry and a contract for every cousin.',
    passiveName: 'Well Connected',
    passiveDesc: 'Public Contracts & briefcases worth +50%',
    abilityName: 'Fast-Track Procedure',
    abilityDesc: 'Skip the queue: 4s of free super-speed that costs no mass.',
    cooldown: 14,
    duration: 4,
    colors: { a: '#d3313b', b: '#1f2f5c', glow: '#ff6b6b' },
    jacket: '#1f2f5c',
    shirt: '#eef1f7',
    tie: '#d3313b',
    hair: '#cfcfd6',
    skin: '#e8ad8c',
  },
  reformer: {
    id: 'reformer',
    name: 'Reformistul',
    title: 'The Earnest Reformer',
    tagline: 'Brought a spreadsheet to a knife fight.',
    passiveName: 'Efficient Governance',
    passiveDesc: 'Boost costs 40% less; Reform Pledges worth ×3',
    abilityName: 'Transparency Shield',
    abilityDesc: 'For 3.5s rival bodies can’t eliminate you — you pass right through.',
    cooldown: 18,
    duration: 3.5,
    colors: { a: '#2a6fdb', b: '#a9d0ff', glow: '#5aa9ff' },
    jacket: '#24508f',
    shirt: '#dceaff',
    tie: '#173a6b',
    hair: '#5a4030',
    skin: '#f2c9a4',
  },
};

export const ARCHETYPE_LIST: Archetype[] = [
  ARCHETYPES.firebrand,
  ARCHETYPES.tycoon,
  ARCHETYPES.baron,
  ARCHETYPES.reformer,
];

/** Alternate "party" colour schemes so AI rivals are easy to tell apart. */
export const PARTY_COLORS: BodyColors[] = [
  { a: '#ff8c1a', b: '#3b2a1a', glow: '#ffb05a' },
  { a: '#8e44ad', b: '#ecdcf6', glow: '#c08bff' },
  { a: '#27ae60', b: '#f2f1e4', glow: '#6fe39b' },
  { a: '#14a3a3', b: '#0d3a48', glow: '#4fe0e0' },
  { a: '#e84393', b: '#2d1b2e', glow: '#ff86c2' },
  { a: '#9aa52b', b: '#f3e9b8', glow: '#d3df5a' },
  { a: '#f5f0e1', b: '#c0392b', glow: '#ffffff' },
];

export const AI_NAMES = [
  'Senatorul Șpagă',
  'Primarul Asfalt',
  'Ministrul Pensiilor',
  'Consilier Sinecură',
  'Deputatul Dosar',
  'Prefectul Plic',
  'Doamna Licitație',
  'Domnul Tender',
  'Șeful de Cabinet',
  'Vărul Ministrului',
  'Nepotul Directorului',
  'Cumătrul Local',
  'Baronul de Județ',
  'Secretarul de Stat',
  'Purtătorul de Cuvânt',
  'Consultantul Extern',
  'Lobby-istul Zâmbăreț',
  'Președintele CA',
  'Trezorierul Partidului',
  'Expertul în Fonduri',
  'Doamna Ordonanță',
  'Domnul Amendament',
];
