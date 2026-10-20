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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linejoin="round" aria-hidden="true"><path d="M4 19 C7 17.5 10 17.5 12 19 C14 17.5 17 17.5 20 19 L20 6 C17 4.5 14 4.5 12 6 C10 4.5 7 4.5 4 6 Z" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="6" x2="12" y2="19" stroke="white" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.5" transform="rotate(-20 12 12)" fill="none" stroke="white" stroke-width="1.2" opacity="0.85"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="white"/><path d="M12,0 L12.8,3 M21,5 L18.5,7 M24,14 L20.5,13.5 M19,22 L16.5,19 M12,24 L12,20.5 M5,22 L7.5,19 M0,14 L3.5,13.5 M3,5 L5.5,7" stroke="white" stroke-width="1.3" stroke-linecap="round"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10.5 L12 4.5 L19 10.5" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17.5 L12 11.5 L19 17.5" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 12.5 L10.8 15.8 L17.5 8.5" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="12" cy="12.5" rx="9" ry="3.8" transform="rotate(-28 12 12.5)" fill="none" stroke="white" stroke-width="1.8" stroke-dasharray="26 6 12 4"/></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><circle cx="12" cy="12" r="7.8" fill="none" stroke="white" stroke-width="1.4" stroke-dasharray="3 2"/><text x="12" y="15.8" text-anchor="middle" font-size="11" font-weight="900" font-family="system-ui, sans-serif" fill="white">?!</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M12 1.5 L13 4 M20 5 L17.5 6.5 M22.5 12 L19.5 12 M20 19 L17.5 17.5 M12 22.5 L12 19.5 M4 19 L6.5 17.5 M1.5 12 L4.5 12 M4 5 L6.5 6.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui, sans-serif" fill="white">?</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="white" aria-hidden="true"><path d="M12 2.5 C17 2.5 21 6.5 21 11.5 C21 16.5 16.5 20.5 12 20.5 C7.5 20.5 3.5 17 3.5 12.5 C3.5 8.5 6.8 5.5 10.5 5.5" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="900" font-family="system-ui, sans-serif" fill="white">??</text></svg>',
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
    svg: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="white" stroke-width="1.6"/><path d="M7.5 8.5 L11.5 12.5 M11.5 8.5 L7.5 12.5" stroke="white" stroke-width="2.2" stroke-linecap="round"/><path d="M15 7.5 L15 12.5 M15 15 L15 16.5" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>',
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
