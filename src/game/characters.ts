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
    title: 'Tribunul',
    tagline: 'N-a întâlnit microfon în care să nu urle.',
    passiveName: 'Prezență Tunătoare',
    passiveDesc: '+15% agilitate la viraje',
    abilityName: 'Tirada Tunătoare',
    abilityDesc: 'Amețește rivalii din jur timp de 2s: încetinesc și pierd controlul.',
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
    title: 'Magnatul',
    tagline: 'Are un club de fotbal, trei palate și o părere despre orice.',
    passiveName: 'Etalonul Aur',
    passiveDesc: '+30% din monede, bancnote și aur',
    abilityName: 'Magnetul de Aur',
    abilityDesc: 'Timp de 4,5s, tot ce e prin jur îți zboară direct în buzunare.',
    cooldown: 15,
    duration: 4.5,
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
    title: 'Baronul',
    tagline: 'Are un văr în fiecare minister și un contract pentru fiecare văr.',
    passiveName: 'Relații Bune',
    passiveDesc: 'Contractele publice și servietele valorează +50%',
    abilityName: 'Procedură de Urgență',
    abilityDesc: 'Sari peste coadă: 4s de super-viteză, fără să pierzi putere.',
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
    title: 'Reformistul',
    tagline: 'A venit cu un tabel Excel la o bătaie cu cuțite.',
    passiveName: 'Guvernare Eficientă',
    passiveDesc: 'Turbo costă cu 40% mai puțin; promisiunile de reformă valorează ×3',
    abilityName: 'Scutul Transparenței',
    abilityDesc: 'Timp de 3,5s rivalii nu te pot elimina: treci prin ei.',
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
