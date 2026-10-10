import type { ArchetypeId } from './characters';
import type { FoodKind } from './food';

export type ParticleKind = 'spark' | 'ring' | 'confetti' | 'note' | 'paper' | 'case' | 'coin' | 'star';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export type GameEvent =
  | { t: 'eat'; w: number; kind: FoodKind; value: number }
  | { t: 'death'; victim: number; victimName: string; killer: number | null; killerName: string | null; cause: 'body' | 'border'; x: number; y: number; mass: number }
  | { t: 'ability'; w: number; ab: ArchetypeId; x: number; y: number }
  | { t: 'stunned'; w: number; by: number }
  | { t: 'special'; label: string; place: string; value: number; x: number; y: number; ttl: number }
  | { t: 'specialTaken'; w: number; name: string; label: string }
  | { t: 'specialExpired'; label: string }
  | { t: 'busted'; w: number; name: string; lost: number; x: number; y: number }
  | { t: 'heatWarning'; w: number }
  | { t: 'power'; w: number; id: string; x: number; y: number };
