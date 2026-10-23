import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChessStore } from '@/state/store'
import { ChessBoardUI } from '@/ui/board'
import { generateLegal } from '@/core'

describe('Right-click board planning', () => {
  let store: ChessStore
  let container: HTMLElement

  const square = (sq: number) => container.querySelector(`.chess-square[data-square="${sq}"]`)!
  const pointer = (target: EventTarget, type: string, button: number) =>
    target.dispatchEvent(new MouseEvent(type, { button, bubbles: true, cancelable: true }))
  const plan = (from: number, to: number) => {
    pointer(square(from), 'pointerdown', 2)
    pointer(square(to), 'pointerup', 2)
  }
  const lines = () => container.querySelectorAll('.board-planning-overlay line')
  const highlights = () => container.querySelectorAll('.square-planning-highlight')

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    store = new ChessStore()
    new ChessBoardUI(container, store)
    store.selectSquare(null)
  })

  afterEach(() => {
    container.remove()
  })

  it('draws a right-drag arrow between square centers without selecting or moving a piece', () => {
    const state = store.getState()
    plan(52, 36)
    expect(lines()).toHaveLength(1)
    const line = lines()[0]
    expect(['x1', 'y1', 'x2', 'y2'].map((attr) => line.getAttribute(attr)))
      .toEqual(['450', '650', '450', '450'])
    const marker = container.querySelector('.board-planning-overlay marker')!
    expect(line.getAttribute('marker-end')).toBe(`url(#${marker.id})`)
    expect(container.querySelector('.board-planning-overlay')?.getAttribute('aria-hidden')).toBe('true')
    expect(store.getSelectedSquare()).toBeNull()
    expect(store.getState()).toBe(state)
    expect(document.querySelector('.floating-drag-piece')).toBeNull()
  })

  it('toggles arrows and square highlights independently on repeated right gestures', () => {
    plan(52, 36)
    plan(62, 45)
    plan(36, 36)
    expect(lines()).toHaveLength(2)
    expect(highlights()).toHaveLength(1)
    plan(52, 36)
    expect(lines()).toHaveLength(1)
    expect(highlights()).toHaveLength(1)
    plan(36, 36)
    expect(highlights()).toHaveLength(0)
  })

  it('clears all planning on left pointerdown and still selects the piece', () => {
    plan(52, 36)
    plan(62, 45)
    plan(36, 36)
    pointer(square(52), 'pointerdown', 0)
    expect(lines()).toHaveLength(0)
    expect(highlights()).toHaveLength(0)
    expect(store.getSelectedSquare()).toBe(52)
    pointer(square(52), 'pointerup', 0)
  })

  it('clears planning on a left click, a real move and history navigation', () => {
    plan(52, 36)
    plan(36, 36)
    square(40).dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }))
    expect(lines()).toHaveLength(0)
    expect(highlights()).toHaveLength(0)
    plan(52, 36)
    plan(36, 36)
    store.makeMove(52, 36)
    expect(lines()).toHaveLength(0)
    expect(highlights()).toHaveLength(0)
    plan(12, 28)
    store.setViewIndex(-1)
    expect(lines()).toHaveLength(0)
  })

  it('preserves planning during selection updates and redraws it when flipped', () => {
    plan(52, 36)
    store.selectSquare(62)
    expect(lines()).toHaveLength(1)
    store.toggleFlip()
    expect(['x1', 'y1', 'x2', 'y2'].map((attr) => lines()[0].getAttribute(attr)))
      .toEqual(['350', '150', '350', '350'])
  })

  it('suppresses the context menu and ignores outside release or cancelled gestures', () => {
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    square(52).dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    pointer(square(52), 'pointerdown', 2)
    pointer(window, 'pointerup', 2)
    pointer(square(36), 'pointerup', 2)
    expect(lines()).toHaveLength(0)
    pointer(square(52), 'pointerdown', 2)
    window.dispatchEvent(new Event('pointercancel'))
    pointer(square(36), 'pointerup', 2)
    expect(lines()).toHaveLength(0)
  })

  it('uses separate markers for multiple boards and preserves the engine arrow', () => {
    const second = document.createElement('div')
    document.body.appendChild(second)
    const otherStore = new ChessStore()
    const otherBoard = new ChessBoardUI(second, otherStore)
    otherStore.selectSquare(null)
    otherBoard.setExternalArrow(generateLegal(otherStore.getState()).find((move) => move.from === 52 && move.to === 36)!)
    plan(52, 36)
    expect(container.querySelector('marker')?.id)
      .not.toBe(second.querySelector('.board-planning-overlay marker')?.id)
    expect(second.querySelector('.best-move-arrow-line')).not.toBeNull()
    second.remove()
  })
})

describe('Solar board juice', () => {
  let store: ChessStore
  let container: HTMLElement
  let board: ChessBoardUI
  const square = (sq: number) => container.querySelector<HTMLElement>(`.chess-square[data-square="${sq}"]`)!
  const enableLifecycle = () => vi.spyOn(
    board as unknown as { animationsEnabled(): boolean }, 'animationsEnabled',
  ).mockReturnValue(true)
  const capturePosition = () => store.loadFEN('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1')

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    store = new ChessStore()
    store.setGameMode('pvp', false)
    board = new ChessBoardUI(container, store)
    store.selectSquare(null)
  })

  afterEach(() => {
    store.selectSquare(null)
    container.remove()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('adds landing squash and an inaccessible ripple after a player move', () => {
    enableLifecycle()
    store.makeMove(52, 36)
    expect(square(36).classList.contains('solar-piece-land')).toBe(true)
    const ripple = square(36).querySelector('.solar-landing-ripple')!
    expect(ripple.getAttribute('aria-hidden')).toBe('true')
    square(36).querySelector('.piece-wrapper')!.dispatchEvent(new Event('animationend'))
    expect(square(36).classList.contains('solar-piece-land')).toBe(false)
    vi.advanceTimersByTime(210)
    expect(ripple.isConnected).toBe(false)
  })

  it('leaves a warp trail for the opponent and lands after its slide', () => {
    enableLifecycle()
    vi.spyOn(container.querySelector('.chess-board')!, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 640, 640))
    store.makeMove(52, 36)
    store.makeMove(12, 28)
    const trail = container.querySelector<HTMLElement>('.solar-warp-trail')!
    expect(trail.style.width).toBe('160px')
    expect(trail.style.transform).toContain(`rotate(${Math.PI / 2}rad)`)
    expect(square(28).querySelector('.piece-sliding')).not.toBeNull()
    expect(square(28).classList.contains('solar-piece-land')).toBe(false)
    vi.advanceTimersByTime(200)
    expect(square(28).classList.contains('solar-piece-land')).toBe(true)
    vi.advanceTimersByTime(70)
    expect(container.querySelector('.solar-warp-trail')).toBeNull()
  })

  it('moves the captured DOM node to the overlay and removes it after dematerialization', () => {
    enableLifecycle()
    capturePosition()
    const captured = square(27).querySelector('.piece-wrapper')!
    store.makeMove(36, 27)
    const ghost = container.querySelector('.captured-piece-ghost')!
    expect(ghost).not.toBe(captured)
    expect(ghost.innerHTML).toBe(captured.innerHTML)
    expect(ghost.closest('.board-effects-layer')?.getAttribute('aria-hidden')).toBe('true')
    expect(square(27).querySelectorAll('.piece-wrapper')).toHaveLength(1)
    ghost.dispatchEvent(new Event('animationend'))
    expect(ghost.isConnected).toBe(false)
    expect(container.querySelector('.solar-capture-slot')).toBeNull()
  })

  it('cleans captured pieces with a timeout when animationend is missing', () => {
    enableLifecycle()
    capturePosition()
    store.makeMove(36, 27)
    vi.advanceTimersByTime(270)
    expect(container.querySelector('.piece-dematerialize')).toBeNull()
  })

  it('dematerializes the en passant pawn from its actual square', () => {
    enableLifecycle()
    store.loadFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2')
    const captured = square(27).querySelector('.piece-wrapper')!
    store.makeMove(28, 19)
    const ghost = container.querySelector('.captured-piece-ghost')!
    expect(ghost.innerHTML).toBe(captured.innerHTML)
    expect(square(27).querySelector('.piece-wrapper')).toBeNull()
    vi.advanceTimersByTime(270)
    expect(ghost.isConnected).toBe(false)
  })

  it('shocks the checked king and clears both classes and the halo', () => {
    enableLifecycle()
    store.loadFEN('4k3/8/8/8/8/8/R7/6K1 w - - 0 1')
    store.makeMove(48, 52)
    expect(square(4).classList.contains('solar-king-shock')).toBe(false)
    expect(square(4).classList.contains('solar-king-tremor')).toBe(false)
    expect(square(4).querySelector('.piece[data-piece="k"].solar-king-tremor')).not.toBeNull()
    expect(square(4).querySelector('.solar-check-halo')?.getAttribute('aria-hidden')).toBe('true')
    vi.advanceTimersByTime(380)
    expect(container.querySelector('.solar-king-shock')).toBeNull()
    expect(container.querySelector('.solar-king-halo')).toBeNull()
  })

  it('cancels effects on navigation without animating historical captures', () => {
    enableLifecycle()
    capturePosition()
    store.makeMove(36, 27)
    store.setViewIndex(-1)
    expect(container.querySelector('.board-effects-layer')?.childElementCount).toBe(0)
    expect(container.querySelector('.solar-piece-land')).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(container.querySelector('.solar-landing-ripple')).toBeNull()
  })

  it('disables all new effects immediately in the test environment', () => {
    capturePosition()
    store.makeMove(36, 27)
    expect(container.querySelector('.piece-dematerialize, .solar-piece-land, .solar-warp-trail')).toBeNull()
    expect(container.querySelector('.board-container')?.getAttribute('data-instant-motion')).toBe('true')
  })

  it('skips effects when reduced motion is requested in a browser', () => {
    Object.defineProperty(board, 'instantMotion', { value: false })
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      capturePosition()
      store.makeMove(36, 27)
      expect(container.querySelector('.piece-dematerialize, .solar-piece-land, .solar-landing-ripple')).toBeNull()
      store.loadFEN('4k3/8/8/8/8/8/R7/6K1 w - - 0 1')
      store.makeMove(48, 52)
      expect(container.querySelector('.solar-king-shock, .solar-king-halo')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })

  it('emits six launch and six friction sparks and removes them after the animation', () => {
    enableLifecycle()
    store.makeMove(52, 36)
    const overlay = container.querySelector('#board-fx-overlay')!
    const launch = overlay.querySelector('.solar-spark-launch')!
    const impact = overlay.querySelector('.solar-spark-impact')!
    expect(launch.querySelectorAll('.solar-spark-particle')).toHaveLength(6)
    expect(impact.querySelectorAll('.solar-spark-particle')).toHaveLength(6)
    launch.querySelectorAll<HTMLElement>('.solar-spark-particle').forEach((particle) => {
      expect(particle.getAttribute('aria-hidden')).toBe('true')
      expect(particle.style.getPropertyValue('--ty')).toMatch(/^-\d+px$/)
    })
    impact.lastElementChild!.dispatchEvent(new Event('animationend'))
    expect(impact.isConnected).toBe(false)
    vi.advanceTimersByTime(230)
    expect(overlay.querySelector('.solar-spark-particle')).toBeNull()
  })

  it('positions the capture ghost using the captured piece bounds before rerender', () => {
    enableLifecycle()
    capturePosition()
    const piece = square(27).querySelector('.piece-wrapper')!
    vi.spyOn(piece, 'getBoundingClientRect').mockReturnValue(new DOMRect(245, 205, 72, 72))
    vi.spyOn(container.querySelector('.board-effects-layer')!, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(10, 20, 640, 640))
    store.makeMove(36, 27)
    const ghost = container.querySelector<HTMLElement>('.captured-piece-ghost')!
    const slot = ghost.parentElement!
    expect([slot.style.left, slot.style.top, slot.style.width, slot.style.height])
      .toEqual(['235px', '185px', '72px', '72px'])
    expect(ghost.style.width).toBe('100%')
  })

  it('keeps a capture ghost alive through a rapid subsequent move', () => {
    enableLifecycle()
    capturePosition()
    store.makeMove(36, 27)
    const ghost = container.querySelector('.captured-piece-ghost')!
    vi.advanceTimersByTime(100)
    store.makeMove(4, 5)
    expect(ghost.isConnected).toBe(true)
    vi.advanceTimersByTime(170)
    expect(ghost.isConnected).toBe(false)
  })

  it('does not create particles or capture ghosts when motion is disabled', () => {
    capturePosition()
    store.makeMove(36, 27)
    expect(container.querySelector('.solar-spark-particle, .captured-piece-ghost')).toBeNull()
  })
})
