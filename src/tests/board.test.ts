import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
