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
  readonly svg: string;
}

export const MOVE_CLASS_REGISTRY: readonly MoveClassMeta[] = [
  {
    id: 'opening',
    nameRu: 'Дебют',
    shortRu: 'Дебют',
    cssVar: '--class-opening',
    color: '#94723c',
    symbol: 'D',
    order: 0,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'stellar',
    nameRu: 'Звёздный',
    shortRu: 'Звёздный',
    cssVar: '--class-stellar',
    color: '#c026d3',
    symbol: '!!',
    order: 1,
    showInSummary: true,
    nag: '!!',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M12 2.5L13.6 8.1L18.2 5.8L15.9 10.4L21.5 12L15.9 13.6L18.2 18.2L13.6 15.9L12 21.5L10.4 15.9L5.8 18.2L8.1 13.6L2.5 12L8.1 10.4L5.8 5.8L10.4 8.1Z" fill="white"/></svg>',
  },
  {
    id: 'superb',
    nameRu: 'Превосходный',
    shortRu: 'Превосходный',
    cssVar: '--class-superb',
    color: '#ec4899',
    symbol: '!',
    order: 2,
    showInSummary: true,
    nag: '!',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M4 4Q12 10.5 20 4Q13.5 12 20 20Q12 13.5 4 20Q10.5 12 4 4Z" fill="white"/></svg>',
  },
  {
    id: 'best',
    nameRu: 'Лучший',
    shortRu: 'Лучший',
    cssVar: '--class-best',
    color: '#22c55e',
    symbol: '★',
    order: 3,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M12 2l2.9 6.2 6.8.8-5 4.7 1.4 6.8L12 17.2l-6.1 3.3 1.4-6.8-5-4.7 6.8-.8z" fill="white"/></svg>',
  },
  {
    id: 'excellent',
    nameRu: 'Отличный',
    shortRu: 'Отличный',
    cssVar: '--class-excellent',
    color: '#84cc16',
    symbol: '★',
    order: 4,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 14L7 16L14 7" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14L12 16L19 7" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'good',
    nameRu: 'Хороший',
    shortRu: 'Хороший',
    cssVar: '--class-good',
    color: '#06b6d4',
    symbol: '✓',
    order: 5,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 11.5L9.5 16.5L19.5 6.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'inaccuracy',
    nameRu: 'Неточность',
    shortRu: 'Неточность',
    cssVar: '--class-inaccuracy',
    color: '#eab308',
    symbol: '?!',
    order: 6,
    showInSummary: true,
    nag: '?!',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="19" text-anchor="middle" font-size="17" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white"><tspan x="8.2" text-anchor="middle">?</tspan><tspan x="15.8" text-anchor="middle">!</tspan></text></svg>',
  },
  {
    id: 'mistake',
    nameRu: 'Ошибка',
    shortRu: 'Ошибка',
    cssVar: '--class-mistake',
    color: '#f97316',
    symbol: '?',
    order: 7,
    showInSummary: true,
    nag: '?',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="19.5" text-anchor="middle" font-size="20" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">?</text></svg>',
  },
  {
    id: 'blunder',
    nameRu: 'Зевок',
    shortRu: 'Зевок',
    cssVar: '--class-blunder',
    color: '#ef4444',
    symbol: '??',
    order: 8,
    showInSummary: true,
    nag: '??',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="19" text-anchor="middle" font-size="17" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white"><tspan x="7" text-anchor="middle">?</tspan><tspan x="17" text-anchor="middle">?</tspan></text></svg>',
  },
  {
    id: 'missed',
    nameRu: 'Упущенный шанс',
    shortRu: 'Упущенный',
    cssVar: '--class-missed',
    color: '#e11d48',
    symbol: '✖!',
    order: 9,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/><path d="M8 8l8 8m0-8l-8 8" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>',
  },
];

export const MOVE_CLASS_MAP: Record<MoveClass, MoveClassMeta> = Object.fromEntries(
  MOVE_CLASS_REGISTRY.map((meta) => [meta.id, meta]),
) as Record<MoveClass, MoveClassMeta>;

export function getMoveClassSvg(id: MoveClass): string {
  return getMoveClassMeta(id).svg;
}

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
