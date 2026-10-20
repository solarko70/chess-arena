/**
 * Registry of chess move classes.
 * Single source of truth for move class metadata:
 * Russian names, CSS color variables, symbols, display order, NAGs, and summary inclusion.
 */
import type { MoveClass } from './classify'

export interface MoveClassMeta {
  readonly id: MoveClass
  readonly nameRu: string
  readonly shortRu: string
  readonly cssVar: string
  readonly color: string
  readonly symbol: string
  readonly order: number
  readonly showInSummary: boolean
  readonly nag: string
  readonly svg: string
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19 C7 17.5 10 17.5 12 19 C14 17.5 17 17.5 20 19 L20 6 C17 4.5 14 4.5 12 6 C10 4.5 7 4.5 4 6 Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="6" x2="12" y2="19" stroke="white" stroke-width="2"/></svg>',
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
    color: '#f59e0b',
    symbol: '★',
    order: 3,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="white"/></svg>',
  },
  {
    id: 'excellent',
    nameRu: 'Отличный',
    shortRu: 'Отличный',
    cssVar: '--class-excellent',
    color: '#06b6d4',
    symbol: '★',
    order: 4,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 11 L12 5 L18 11" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 18 L12 12 L18 18" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'good',
    nameRu: 'Хороший',
    shortRu: 'Хороший',
    cssVar: '--class-good',
    color: '#10b981',
    symbol: '✓',
    order: 5,
    showInSummary: true,
    nag: '',
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">?!</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">?</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">??</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><text x="12" y="16" text-anchor="middle" font-size="11.5" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">✖!</text></svg>',
  },
]

export const MOVE_CLASS_MAP: Record<MoveClass, MoveClassMeta> = Object.fromEntries(
  MOVE_CLASS_REGISTRY.map((meta) => [meta.id, meta])
) as Record<MoveClass, MoveClassMeta>

export function getMoveClassSvg(id: MoveClass): string {
  return getMoveClassMeta(id).svg
}

export function getMoveClassMeta(id: MoveClass): MoveClassMeta {
  return MOVE_CLASS_MAP[id] ?? MOVE_CLASS_REGISTRY[0]
}

/**
 * Format material points with correct Russian declension for the word "очко"
 * without a negative sign.
 * Examples: 1 очко, 2 очка, 5 очков, 11 очков, 21 очко, 22 очка, 25 очков.
 */
export function formatMaterialPoints(pts: number): string {
  const abs = Math.abs(pts)
  const mod100 = abs % 100
  const mod10 = abs % 10
  if (mod100 >= 11 && mod100 <= 19) {
    return `${abs} очков`
  }
  if (mod10 === 1) {
    return `${abs} очко`
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${abs} очка`
  }
  return `${abs} очков`
}
