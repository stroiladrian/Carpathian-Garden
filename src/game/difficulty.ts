/**
 * Difficulty presets. These are the knobs that decide how fast AI rivals
 * grow and how dangerous they are. The player's own growth is never changed.
 */
export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  blurb: string;
  /** Multiplier on everything AI rivals eat (1 = same rate as the player). */
  aiGrowth: number;
  /** AI growth fades out as they approach this mass ("campaign costs"). */
  aiSoftCap: number;
  /** Mass AI lose per second above the soft cap (fraction of the excess). */
  aiCapDrain: number;
  /** Extra growth penalty for AI that are already much bigger than you. */
  rubberBand: boolean;
  /** Scales the starting masses of the opening field. */
  aiStartScale: number;
  /** Scales how often AI try to cut you off. */
  aggression: number;
  /** AI re-plan interval in seconds (higher = slower reactions). */
  thinkMin: number;
  thinkMax: number;
  /** How often AI pick the player as a hunting target vs other AI (lower = leaves you alone). */
  targetPlayerBias: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    label: 'Intern',
    blurb: 'Relaxed rivals. You’ll top the leaderboard.',
    aiGrowth: 0.4,
    aiSoftCap: 450,
    aiCapDrain: 0.04,
    rubberBand: true,
    aiStartScale: 0.3,
    aggression: 0.35,
    thinkMin: 0.17,
    thinkMax: 0.26,
    targetPlayerBias: 1.6,
  },
  normal: {
    id: 'normal',
    label: 'Candidate',
    blurb: 'A fair fight. Reaching #1 takes a few minutes.',
    aiGrowth: 0.55,
    aiSoftCap: 850,
    aiCapDrain: 0.025,
    rubberBand: true,
    aiStartScale: 0.55,
    aggression: 0.7,
    thinkMin: 0.11,
    thinkMax: 0.18,
    targetPlayerBias: 1.1,
  },
  hard: {
    id: 'hard',
    label: 'Party Baron',
    blurb: 'Hungry, aggressive rivals that snowball.',
    aiGrowth: 1,
    aiSoftCap: 6000,
    aiCapDrain: 0,
    rubberBand: false,
    aiStartScale: 1,
    aggression: 1,
    thinkMin: 0.08,
    thinkMax: 0.14,
    targetPlayerBias: 0.8,
  },
};

export const DIFFICULTY_LIST = [DIFFICULTIES.easy, DIFFICULTIES.normal, DIFFICULTIES.hard];

/** Growth multiplier for one AI worm right now. */
export function aiGrowthFactor(d: Difficulty, aiMass: number, playerMass: number | null): number {
  let g = d.aiGrowth;
  // soft cap: growth fades to 10% as they approach the cap
  g *= Math.max(0.1, 1 - aiMass / d.aiSoftCap);
  // rubber band: rivals far ahead of you grow slower, rivals behind you a bit faster
  if (d.rubberBand && playerMass !== null) {
    const ratio = aiMass / Math.max(30, playerMass);
    if (ratio > 1.5) g *= 0.55;
    else if (ratio < 0.5) g *= 1.25;
  }
  return g;
}

/** Player titles by power — small milestones that make progress feel like winning. */
export const RANKS: { at: number; title: string }[] = [
  { at: 0, title: 'Local Councillor' },
  { at: 80, title: 'Mayor' },
  { at: 200, title: 'County Baron' },
  { at: 400, title: 'Senator' },
  { at: 700, title: 'Minister' },
  { at: 1100, title: 'Prime Minister' },
  { at: 1700, title: 'President' },
  { at: 2600, title: 'Eternal Leader' },
];

export function titleFor(mass: number): string {
  let t = RANKS[0].title;
  for (const r of RANKS) if (mass >= r.at) t = r.title;
  return t;
}
