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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5h6a4 4 0 0 1 4 3.5v11.5a3 3 0 0 0-3-2.5H2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4.5h-6a4 4 0 0 0-4 3.5v11.5a3 3 0 0 1 3-2.5h7z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M12 2L13.2 8.4L15.6 7L15.1 9.8L21.5 8.9L15.8 12L17.9 13.9L15.1 14.2L17.9 20.1L13.2 15.6L12 18.2L10.8 15.6L6.1 20.1L8.9 14.2L6.1 13.9L8.2 12L2.5 8.9L8.9 9.8L8.4 7L10.8 8.4Z" fill="white"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11l7-6 7 6" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18l7-6 7 6" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13c1.5 1.5 3.5 3.8 5.5 5.5C13 14 17 8 20 5" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="5" r="1.5" fill="white"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M5.5 7.5c0-2.2 1.8-3.8 4-3.8s4 1.5 4 3.5c0 1.6-1.1 2.6-2.3 3.4-.8.6-1.2 1.1-1.2 2.2h-2c0-1.7.8-2.6 2-3.4.9-.6 1.5-1.2 1.5-2.2 0-1-.8-1.7-2-1.7s-2 .8-2 2h-2z" fill="white"/><path d="M8.5 15.5l1-1.8 1 1.8-1 1.8z" fill="white"/><path d="M14.5 4h2l-.5 9h-1z" fill="white"/><path d="M15.5 15.5l1-1.8 1 1.8-1 1.8z" fill="white"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M7 8c0-3 2.2-5 5-5s5 2 5 4.8c0 2.2-1.4 3.5-2.8 4.6-1.1.9-1.7 1.6-1.7 3.1h-2.5c0-2.3 1.1-3.6 2.6-4.7 1.2-.9 2-1.7 2-3 0-1.4-1.1-2.4-2.6-2.4s-2.6 1-2.6 2.6H7z" fill="white"/><path d="M10.2 17.5L12 15L13.8 17.5L12 20Z" fill="white"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M4.2 7c0-2 1.4-3.5 3.3-3.5 1.8 0 3.3 1.4 3.3 3.3 0 1.5-.9 2.4-1.9 3.2-.7.6-1.2 1.1-1.2 2.2H5.9c0-1.6.8-2.5 1.8-3.3.8-.6 1.4-1.2 1.4-2.1 0-1-.7-1.7-1.6-1.7s-1.6.7-1.6 1.9H4.2z" fill="white"/><circle cx="7.5" cy="16.5" r="1.3" fill="white"/><path d="M13.2 7c0-2 1.4-3.5 3.3-3.5 1.8 0 3.3 1.4 3.3 3.3 0 1.5-.9 2.4-1.9 3.2-.7.6-1.2 1.1-1.2 2.2h-1.8c0-1.6.8-2.5 1.8-3.3.8-.6 1.4-1.2 1.4-2.1 0-1-.7-1.7-1.6-1.7s-1.6.7-1.6 1.9h-1.7z" fill="white"/><circle cx="16.5" cy="16.5" r="1.3" fill="white"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/><path d="M8 8l8 8m0-8l-8 8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
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
