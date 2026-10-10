import type { ArchetypeId } from './game/characters';

export interface SaveData {
  nickname: string;
  character: ArchetypeId;
  muted: boolean;
  best: number;
  touchSteer: 'joystick' | 'follow';
  touchHintSeen: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  music: boolean;
}

const KEY = 'carpathian-garden:v1';
const DEFAULTS: SaveData = {
  nickname: '',
  character: 'firebrand',
  muted: false,
  best: 0,
  touchSteer: 'joystick',
  touchHintSeen: false,
  difficulty: 'normal',
  music: true,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSave(data: Partial<SaveData>): void {
  try {
    const cur = loadSave();
    localStorage.setItem(KEY, JSON.stringify({ ...cur, ...data }));
  } catch {
    /* storage unavailable (private mode) — game still works */
  }
}
