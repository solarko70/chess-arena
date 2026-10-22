import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChessStore } from '@/state/store'
import { ChessBoardUI } from '@/ui/board'
import { ReviewPanelUI } from '@/ui/reviewpanel'
import { HistoryUI } from '@/ui/history'
import { generateLegal } from '@/core'
import type { AnalysisEngineResult, GameReviewResult, MoveClass } from '@/analysis'

describe('Variation badges and stellar cleanup', () => {
  let store: ChessStore
  let board: HTMLElement
  let nav: HTMLElement
  let history: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    store = new ChessStore()
    board = document.createElement('div')
    nav = document.createElement('div')
    history = document.createElement('div')
    const panel = document.createElement('div')
    document.body.append(board, nav, history, panel)
    new ChessBoardUI(board, store)
    new ReviewPanelUI(panel, store, { navContainer: nav })
    new HistoryUI(history, store)
    store.makeMove(52, 36)
    store.makeMove(12, 28)
    const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
    const review: GameReviewResult = {
      engineName: 'MockEngine', reanalyzed: 0, accuracy: { white: 100, black: 100 },
      counts: { white: { ...counts, stellar: 1 }, black: { ...counts, best: 1 } },
      keyMoments: [], evalHistory: [],
      moves: store.getLiveState().history.map((move, index) => ({
        move, ply: index + 1, san: index === 0 ? 'e4' : 'e5',
        color: index === 0 ? 'white' : 'black',
        evalBefore: { type: 'cp', value: 0 }, evalAfter: { type: 'cp', value: 0 },
        bestMove: move, bestSan: index === 0 ? 'e4' : 'e5',
        winBefore: 50, winAfter: 50, loss: 0, accuracy: 100,
        class: index === 0 ? 'stellar' : 'best', onlyMove: false,
      })),
    }
    store.setReviewResult(review)
    store.setReviewMode(true)
    store.setViewIndex(0)
  })

  afterEach(() => {
    store.setReviewMode(false)
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('updates a pending variation badge to blunder after asynchronous analysis', async () => {
    let complete!: (result: AnalysisEngineResult) => void
    const analyze = vi.fn(() => new Promise<AnalysisEngineResult>((resolve) => { complete = resolve }))
    vi.spyOn(store, 'getOrCreateReviewEngine').mockReturnValue({ name: 'MockEngine', analyze, dispose() {} })
    expect(store.makeMove(10, 26)).toBe(true)
    const node = store.getActiveVariationNode()!
    expect(node.class).toBeUndefined()
    expect(board.querySelector('.badge-best')).toBeNull()
    expect(board.querySelector('.badge-pending')).not.toBeNull()
    complete({
      engineName: 'MockEngine', bestMove: generateLegal(node.state).find((move) => move.from === 62 && move.to === 45)!,
      score: { type: 'cp', value: 2000 }, pv: [], depth: 14, nodes: 1, lines: [], timeMs: 1,
    })
    await Promise.resolve()
    expect(node.class).toBe('blunder')
    const badge = board.querySelector<HTMLElement>('.board-move-badge')!
    expect(badge.dataset.class).toBe(node.class)
    expect(badge.dataset.square).toBe('26')
    expect(badge.classList.contains('badge-blunder')).toBe(true)
    expect(history.querySelector('.variation-move .badge-blunder')).not.toBeNull()
    expect(board.querySelector('.badge-best, .stellar-crown, .stellar-wings')).toBeNull()
  })

  it.each<MoveClass>(['blunder', 'mistake', 'inaccuracy', 'best', 'stellar', 'superb'])(
    'uses the current variation classification: %s', (classification) => {
      vi.spyOn(store, 'analyzeVariationNode').mockResolvedValue(undefined)
      store.makeMove(10, 26)
      const node = store.getActiveVariationNode()!
      node.class = classification
      store.selectSquare(null)
      expect(board.querySelector<HTMLElement>('.board-move-badge')?.dataset.class).toBe(classification)
      expect(board.querySelector('.stellar-crown') !== null).toBe(classification === 'stellar')
    },
  )

  it('removes main-line stellar decorations on the next half-move and start position', () => {
    expect(board.querySelector('.stellar-wings')).not.toBeNull()
    expect(board.querySelector('.stellar-crown')).not.toBeNull()
    nav.querySelector<HTMLButtonElement>('#review-nav-next')!.click()
    expect(board.querySelector('.stellar-wings, .stellar-crown, .stellar-aura')).toBeNull()
    nav.querySelector<HTMLButtonElement>('#review-nav-prev')!.click()
    expect(board.querySelector('.stellar-crown')).not.toBeNull()
    nav.querySelector<HTMLButtonElement>('#review-nav-prev')!.click()
    expect(board.querySelector('.stellar-wings, .stellar-crown')).toBeNull()
  })

  it('cleans stellar effects on forward, backward and sideways variation navigation', () => {
    vi.spyOn(store, 'analyzeVariationNode').mockResolvedValue(undefined)
    store.makeMove(10, 26)
    const parent = store.getActiveVariationNode()!
    parent.class = 'stellar'
    store.selectSquare(null)
    expect(board.querySelector('[data-square="26"] .stellar-crown')).not.toBeNull()
    store.makeMove(62, 45)
    const child = store.getActiveVariationNode()!
    expect(board.querySelector('.stellar-wings, .stellar-crown')).toBeNull()
    nav.querySelector<HTMLButtonElement>('#review-nav-prev')!.click()
    expect(board.querySelector('.stellar-crown')).not.toBeNull()
    nav.querySelector<HTMLButtonElement>('#review-nav-next')!.click()
    expect(store.getActiveVariationNode()?.id).toBe(child.id)
    expect(board.querySelector('.stellar-wings, .stellar-crown')).toBeNull()
    store.setActiveVariationNode(parent.id)
    store.makeMove(51, 35)
    expect(board.querySelector('.stellar-wings, .stellar-crown')).toBeNull()
    store.setActiveVariationNode(parent.id)
    nav.querySelector<HTMLButtonElement>('#review-nav-prev')!.click()
    expect(store.getActiveVariationNode()).toBeNull()
    store.setViewIndex(1)
    expect(board.querySelector('.stellar-wings, .stellar-crown, .is-stellar, .has-wings')).toBeNull()
  })
})
