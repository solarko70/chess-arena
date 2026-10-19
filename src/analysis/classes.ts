/**
 * Registry of chess move classes.
 * Single source of truth for move class metadata:
 * Russian names, CSS color variables, symbols, display order, NAGs, and summary inclusion.
 */
import type { MoveClass } from './classify';

export interface MoveClassMeta {
  readonly id: MoveClass;
  readonly nameRu: string;
  readonly shortRu: string;
  readonly cssVar: string;
  readonly color: string;
  readonly symbol: string;
  readonly order: number;
  readonly showInSummary: boolean;
  readonly nag: string;
}

export const MOVE_CLASS_REGISTRY: readonly MoveClassMeta[] = [
  {
    id: 'best',
    nameRu: 'Лучший',
    shortRu: 'Лучший',
    cssVar: '--class-best',
    color: '#22c55e',
    symbol: '★',
    order: 1,
    showInSummary: true,
    nag: '',
  },
  {
    id: 'excellent',
    nameRu: 'Отличный',
    shortRu: 'Отличный',
    cssVar: '--class-excellent',
    color: '#84cc16',
    symbol: '★',
    order: 2,
    showInSummary: true,
    nag: '',
  },
  {
    id: 'good',
    nameRu: 'Хороший',
    shortRu: 'Хороший',
    cssVar: '--class-good',
    color: '#06b6d4',
    symbol: '✓',
    order: 3,
    showInSummary: true,
    nag: '',
  },
  {
    id: 'inaccuracy',
    nameRu: 'Неточность',
    shortRu: 'Неточность',
    cssVar: '--class-inaccuracy',
    color: '#eab308',
    symbol: '?!',
    order: 4,
    showInSummary: true,
    nag: '?!',
  },
  {
    id: 'mistake',
    nameRu: 'Ошибка',
    shortRu: 'Ошибка',
    cssVar: '--class-mistake',
    color: '#f97316',
    symbol: '?',
    order: 5,
    showInSummary: true,
    nag: '?',
  },
  {
    id: 'blunder',
    nameRu: 'Зевок',
    shortRu: 'Зевок',
    cssVar: '--class-blunder',
    color: '#ef4444',
    symbol: '??',
    order: 6,
    showInSummary: true,
    nag: '??',
  },
] as const;

export const MOVE_CLASS_MAP: Record<MoveClass, MoveClassMeta> = Object.fromEntries(
  MOVE_CLASS_REGISTRY.map((meta) => [meta.id, meta]),
) as Record<MoveClass, MoveClassMeta>;

export function getMoveClassMeta(id: MoveClass): MoveClassMeta {
  return MOVE_CLASS_MAP[id] ?? MOVE_CLASS_REGISTRY[0];
}

/**
 * Format material points with correct Russian declension for the word "очко"
 * without a negative sign.
 * Examples: 1 очко, 2 очка, 5 очков, 11 очков, 21 очко, 22 очка, 25 очков.
 */
export function formatMaterialPoints(pts: number): string {
  const abs = Math.abs(pts);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${abs} очков`;
  }
  if (mod10 === 1) {
    return `${abs} очко`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${abs} очка`;
  }
  return `${abs} очков`;
}
