import { ChessStore, type Premove } from '../state/store'
import { getPieceSvg } from './pieces'
import { getMoveClassMeta, winChance } from '@/analysis'
import { solarAudio } from '@/audio/solar-audio'
import { generatePseudoLegal, serializeFEN, type Move, type Piece, type PieceType, type Square } from '@/core'
import type { Score } from '@/ai'

export interface ChessBoardUIOptions {
  hideBadges?: boolean
}

export function isGeometricallyValidPremove(
  fromSq: Square,
  toSq: Square,
  piece: Piece,
  boardWidth = 8,
  boardHeight = 8,
): boolean {
  if (fromSq === toSq) return false
  if (fromSq < 0 || fromSq >= boardWidth * boardHeight) return false
  if (toSq < 0 || toSq >= boardWidth * boardHeight) return false

  const fromX = fromSq % boardWidth
  const fromY = Math.floor(fromSq / boardWidth)
  const toX = toSq % boardWidth
  const toY = Math.floor(toSq / boardWidth)

  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)

  switch (piece.type) {
    case 'pawn': {
      const forwardY = piece.color === 'white' ? fromY - toY : toY - fromY
      if (forwardY <= 0 || forwardY > 2) return false

      if (dx === 0) {
        if (forwardY === 1) return true
        if (forwardY === 2) {
          const startRank = piece.color === 'white' ? boardHeight - 2 : 1
          return fromY === startRank
        }
        return false
      }

      if (dx === 1 && forwardY === 1) {
        return true
      }

      return false
    }

    case 'knight': {
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1)
    }

    case 'bishop': {
      return dx === dy && dx > 0
    }

    case 'rook': {
      return (dx === 0 && dy > 0) || (dx > 0 && dy === 0)
    }

    case 'queen': {
      return (dx === dy && dx > 0) || (dx === 0 && dy > 0) || (dx > 0 && dy === 0)
    }

    case 'king': {
      if (dx <= 1 && dy <= 1) return true
      if (dy === 0 && dx === 2) {
        const homeRank = piece.color === 'white' ? boardHeight - 1 : 0
        return fromY === homeRank
      }
      return false
    }

    default:
      return false
  }
}

export class ChessBoardUI {
  private container: HTMLElement
  private store: ChessStore
  private boardEl: HTMLElement
  private promoOverlayEl: HTMLElement
  private evalBarWrapperEl: HTMLElement
  private evalBarFillEl: HTMLElement
  private evalBarTextEl: HTMLElement
  private arrowLayerEl: SVGElement
  private badgeLayerEl: HTMLElement
  private planningLayerEl: SVGElement
  private effectsLayerEl: HTMLElement
  private effectCleanups = new Set<() => void>()
  private clearingEffects = false
  private readonly instantMotion = typeof process !== 'undefined' && process.env?.VITEST === 'true' ||
    /jsdom/i.test(window.navigator.userAgent)
  private planningFromSquare: Square | null = null
  private planningArrows = new Map<string, { from: Square; to: Square }>()
  private planningHighlights = new Set<Square>()
  private static planningMarkerId = 0
  private planningMarkerId = `planning-arrowhead-${++ChessBoardUI.planningMarkerId}`
  private lastHistoryLength = 0
  private lastVariationId: string | null = null
  private hideBadges = false

  // Review move sliding and wings
  private lastAnimatedViewIndex: number | null = null
  private lastAnimatedVariationId: string | null = null
  private lastSlideTime = 0
  private isReviewModeWasActive = false
  private currentWingsMountEl: HTMLElement | null = null
  private wingsTimer: ReturnType<typeof setTimeout> | null = null

  // Drag state
  private isDragging = false
  private dragFromSquare: Square | null = null
  private floatingPieceEl: HTMLElement | null = null
  private isTouching = false
  private lastTouchEndTime = 0
  private isPremoveDrag = false
  private premoveSelectedSq: Square | null = null

  // Live Analysis external engine data (Stage 6b)
  private externalArrow: Move | null = null
  private externalScore: Score | null = null

  // Selective rendering cache to eliminate layout shifts on square selection (Stage 6b-5)
  private lastRenderedFen: string | null = null
  private lastRenderedFlipped: boolean | null = null
  private lastRenderedSelectedSq: Square | null = null
  private lastRenderedHistoryLen = -1
  private lastRenderedViewIndex: number | null = null
  private lastRenderedVariationId: string | null = null
  private lastRenderedPendingPromo = false
  private lastRenderedPremovesLen = 0
  private lastRenderedAnalysisKey = ''
  private lastRenderedReview: ReturnType<ChessStore['getReviewResult']> = null

  constructor(container: HTMLElement, store: ChessStore, options: ChessBoardUIOptions = {}) {
    this.container = container
    this.store = store
    this.hideBadges = options.hideBadges ?? false
    this.lastHistoryLength = this.store.getLiveState().history.length

    this.container.innerHTML = `
      <div class="board-area">
        <div class="eval-bar-wrapper" id="eval-bar-wrapper" style="display: none;">
          <div class="eval-bar-track">
            <div class="eval-bar-fill" id="eval-bar-fill">
              <div class="eval-bar-marker" aria-hidden="true"></div>
            </div>
            <span class="eval-bar-text" id="eval-bar-text">50%</span>
          </div>
        </div>
        <div class="board-container">
          <div class="chess-board"></div>
          <div class="board-effects-layer" aria-hidden="true"></div>
          <div class="board-badge-layer" aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; z-index: 5;"></div>
          <svg class="board-arrow-layer" viewBox="0 0 800 800" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: block; z-index: 4;"></svg>
          <svg class="board-planning-overlay" viewBox="0 0 800 800" aria-hidden="true"></svg>
          <div class="promo-overlay" style="display: none;"></div>
        </div>
      </div>
    `

    this.boardEl = this.container.querySelector('.chess-board') as HTMLElement
    this.effectsLayerEl = this.container.querySelector('.board-effects-layer') as HTMLElement
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    this.container.querySelector('.board-container')?.setAttribute('data-instant-motion', String(this.instantMotion))
    motionQuery?.addEventListener('change', () => {
      if (motionQuery.matches) this.clearBoardEffects()
    })
    this.promoOverlayEl = this.container.querySelector('.promo-overlay') as HTMLElement
    this.evalBarWrapperEl = this.container.querySelector('#eval-bar-wrapper') as HTMLElement
    this.evalBarFillEl = this.container.querySelector('#eval-bar-fill') as HTMLElement
    this.evalBarTextEl = this.container.querySelector('#eval-bar-text') as HTMLElement
    this.arrowLayerEl = this.container.querySelector('.board-arrow-layer') as SVGElement
    this.badgeLayerEl = this.container.querySelector('.board-badge-layer') as HTMLElement
    this.planningLayerEl = this.container.querySelector('.board-planning-overlay') as SVGElement

    this.initEvents()
    this.store.subscribe(() => this.handleStoreNotification())
  }

  private initEvents(): void {
    let pointerDownOnBoard = false

    // Pointer down on board
    this.boardEl.addEventListener('pointerdown', (e) => {
      pointerDownOnBoard = true
      this.handlePointerDown(e)
    })
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e))
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e))
    window.addEventListener('pointercancel', () => { this.planningFromSquare = null })
    window.addEventListener('blur', () => { this.planningFromSquare = null })
    this.boardEl.addEventListener('click', (e) => {
      if (e.button === 0) this.clearPlanning()
    })

    // Global pointer down cancels premove queue when clicking outside the board
    window.addEventListener('pointerdown', (e) => {
      if (pointerDownOnBoard) {
        pointerDownOnBoard = false
        return
      }
      const target = e.target
      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      if (path.includes(this.boardEl)) {
        return
      }
      if (target instanceof Node && !this.boardEl.contains(target)) {
        if (this.store.getPremoves().length > 0 || this.premoveSelectedSq !== null) {
          this.clearPremoves()
        }
      }
    })

    // Right-click (contextmenu) cancels any active premove queue
    this.boardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.clearPremoves()
    })

    // Touch events for mobile touch devices
    this.boardEl.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false })
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false })
    window.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false })
    window.addEventListener('touchcancel', () => this.handleTouchCancel())
  }

  public getPremove(): Premove | null {
    return this.store.getPremove()
  }

  public getPremoves(): Premove[] {
    return this.store.getPremoves()
  }

  public getSpeculativePieces(): (Piece | null)[] {
    const state = this.store.getState()
    const pieces = [...state.board.pieces]
    const premoves = this.store.getPremoves()
    for (const pm of premoves) {
      const pieceToMove = pieces[pm.from]
      if (pieceToMove) {
        pieces[pm.to] = pm.promotion ? { ...pieceToMove, type: pm.promotion } : pieceToMove
        pieces[pm.from] = null
      }
    }
    return pieces
  }

  public setPremove(premove: Premove | null): void {
    if (premove) {
      const state = this.store.getState()
      const specPieces = this.getSpeculativePieces()
      const piece = specPieces[premove.from] ?? state.board.pieces[premove.from]
      if (piece && !isGeometricallyValidPremove(premove.from, premove.to, piece, state.board.width, state.board.height)) {
        return
      }
      this.store.setPremove(premove)
      solarAudio.playPremove()
    } else {
      this.clearPremoves()
    }
    this.render()
  }

  public addPremove(premove: Premove): void {
    const state = this.store.getState()
    const specPieces = this.getSpeculativePieces()
    const piece = specPieces[premove.from] ?? state.board.pieces[premove.from]
    if (piece && !isGeometricallyValidPremove(premove.from, premove.to, piece, state.board.width, state.board.height)) {
      return
    }
    this.store.addPremove(premove)
    solarAudio.playPremove()
    this.render()
  }

  public clearPremoves(): void {
    // Empty planning gestures must preserve the mounted pieces and badge animation.
    if (this.premoveSelectedSq === null && this.store.getPremoves().length === 0) return
    this.premoveSelectedSq = null
    this.clearPremoveHintDots()
    this.store.clearPremoves()
    this.render()
  }

  public clearPremove(): void {
    this.clearPremoves()
  }

  public setExternalArrow(move: Move | null): void {
    this.externalArrow = move
    this.renderBestMoveArrow(this.store.isFlipped())
  }

  public setExternalScore(score: Score | null): void {
    this.externalScore = score
    this.renderEvalBar(this.store.isFlipped())
  }

  public clearExternalAnalysis(): void {
    this.externalArrow = null
    this.externalScore = null
    if (this.arrowLayerEl) {
      this.arrowLayerEl.innerHTML = ''
    }
    if (!this.store.isReviewMode()) {
      this.evalBarWrapperEl.style.display = 'none'
    }
  }

  private renderPremoveHintDots(fromSq: Square): void {
    this.clearPremoveHintDots()
    const state = this.store.getState()
    const { width, height } = state.board
    const specPieces = this.getSpeculativePieces()
    const piece = specPieces[fromSq] ?? state.board.pieces[fromSq]
    if (!piece) return

    const tempState = {
      ...state,
      turn: piece.color,
      board: {
        ...state.board,
        pieces: specPieces,
      },
    }

    try {
      const pseudoMoves = generatePseudoLegal(tempState).filter((m) => m.from === fromSq)
      let destSquares = Array.from(new Set(pseudoMoves.map((m) => m.to)))

      if (destSquares.length === 0) {
        const total = width * height
        for (let toSq = 0; toSq < total; toSq++) {
          if (toSq !== fromSq && isGeometricallyValidPremove(fromSq, toSq, piece, width, height)) {
            destSquares.push(toSq)
          }
        }
      }

      for (const destSq of destSquares) {
        const targetSqEl = this.boardEl.querySelector(`[data-square="${destSq}"]`)
        if (targetSqEl && !targetSqEl.querySelector('.dest-hint, .dest-capture-ring, .move-hint-dot')) {
          const targetPiece = specPieces[destSq]
          const hint = document.createElement('div')
          hint.className = targetPiece
            ? 'dest-capture-ring square-hint premove-hint'
            : 'dest-hint move-hint-dot square-hint premove-hint'
          targetSqEl.appendChild(hint)
        }
      }
    } catch {
      for (let toSq = 0; toSq < width * height; toSq++) {
        if (toSq !== fromSq && isGeometricallyValidPremove(fromSq, toSq, piece, width, height)) {
          const targetSqEl = this.boardEl.querySelector(`[data-square="${toSq}"]`)
          if (targetSqEl && !targetSqEl.querySelector('.dest-hint, .dest-capture-ring, .move-hint-dot')) {
            const hint = document.createElement('div')
            hint.className = 'dest-hint move-hint-dot square-hint premove-hint'
            targetSqEl.appendChild(hint)
          }
        }
      }
    }
  }

  private clearPremoveHintDots(): void {
    const hints = this.boardEl.querySelectorAll('.premove-hint')
    hints.forEach((el) => el.remove())
  }

  public updatePremoveClasses(): void {
    this.render()
  }

  private getAnalysisRenderKey(): string {
    const node = this.store.getActiveVariationNode()
    const review = this.store.getReviewResult()
    const index = this.store.getViewIndex() ?? (review?.moves.length ?? 0) - 1
    return JSON.stringify([
      this.store.isReviewMode(), this.store.isReviewInProgress(),
      node?.class, node?.score, node?.bestMove, review?.moves[index],
    ])
  }

  private clearPlanning(): void {
    this.planningFromSquare = null
    this.planningArrows.clear()
    this.planningHighlights.clear()
    this.renderPlanning()
  }

  private renderPlanning(): void {
    const { width, height } = this.store.getState().board
    const flipped = this.store.isFlipped()
    const sqW = 800 / width
    const sqH = 800 / height
    const center = (sq: Square) => {
      const x = sq % width
      const y = Math.floor(sq / width)
      return [(flipped ? width - 1 - x : x) * sqW + sqW / 2,
        (flipped ? height - 1 - y : y) * sqH + sqH / 2]
    }
    this.planningLayerEl.innerHTML = `
      <defs>
        <marker id="${this.planningMarkerId}" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="var(--solar-planning-arrow)" />
        </marker>
      </defs>
      ${[...this.planningHighlights].map((sq) => {
        const [x, y] = center(sq)
        return `<rect class="square-planning-highlight" x="${x - sqW / 2}" y="${y - sqH / 2}" width="${sqW}" height="${sqH}" />`
      }).join('')}
      ${[...this.planningArrows.values()].map(({ from, to }) => {
        const [x1, y1] = center(from)
        const [x2, y2] = center(to)
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--solar-planning-arrow)" stroke-width="8" stroke-linecap="round" marker-end="url(#${this.planningMarkerId})" />`
      }).join('')}
    `
  }

  private getPlanningSquare(target: EventTarget | null): Square | null {
    if (!(target instanceof Element)) return null
    const square = target.closest<HTMLElement>('.chess-square')
    return square && this.boardEl.contains(square) ? Number(square.dataset.square) : null
  }

  private handleStoreNotification(): void {
    const state = this.store.getState()
    const liveState = this.store.getLiveState()
    const currentFen = serializeFEN(state)
    const currentFlipped = this.store.isFlipped()
    const currentSelectedSq = this.store.getSelectedSquare()
    const currentHistoryLen = liveState.history.length
    const currentViewIndex = this.store.getViewIndex()
    const currentVariationId = this.store.getActiveVariationNode()?.id ?? null
    const currentHasPromo = this.store.getPendingPromotion() !== null
    const currentPremovesLen = this.store.getPremoves().length

    // If board DOM has not been initialized yet, do full render
    if (this.boardEl.children.length === 0 || this.lastRenderedFen === null) {
      this.render()
      return
    }

    // Check if ONLY selectedSquare changed (same FEN, flipped, history, viewIndex, variations, promo, premoves)
    const isOnlySelectionChange =
      this.lastRenderedFen === currentFen &&
      this.lastRenderedFlipped === currentFlipped &&
      this.lastRenderedHistoryLen === currentHistoryLen &&
      this.lastRenderedViewIndex === currentViewIndex &&
      this.lastRenderedVariationId === currentVariationId &&
      this.lastRenderedPendingPromo === currentHasPromo &&
      this.lastRenderedPremovesLen === currentPremovesLen &&
      this.lastRenderedReview === this.store.getReviewResult() &&
      this.lastRenderedAnalysisKey === this.getAnalysisRenderKey()

    if (isOnlySelectionChange) {
      if (this.lastRenderedSelectedSq === currentSelectedSq) return
      this.updateSelectionHighlights(currentSelectedSq)
      return
    }

    this.render()
  }

  private updateSelectionHighlights(selectedSq: Square | null): void {
    const prevSelected = this.boardEl.querySelectorAll(
      '.chess-square.selected, .chess-square.selected-square, .chess-square.square-selected'
    )
    prevSelected.forEach((el) => {
      el.classList.remove('selected', 'selected-square', 'square-selected')
    })

    const oldHints = this.boardEl.querySelectorAll(
      '.dest-hint:not(.premove-hint), .dest-capture-ring:not(.premove-hint)'
    )
    oldHints.forEach((el) => el.remove())

    this.lastRenderedSelectedSq = selectedSq

    if (selectedSq === null) return

    const sqEl = this.boardEl.querySelector(`[data-square="${selectedSq}"]`) as HTMLElement | null
    if (sqEl) {
      sqEl.classList.add('selected', 'selected-square', 'square-selected')
    }

    const validDests = this.store.getValidDestinationsFor(selectedSq)
    const state = this.store.getState()
    const pieces = state.board.pieces

    for (const destSq of validDests) {
      const targetSqEl = this.boardEl.querySelector(`[data-square="${destSq}"]`) as HTMLElement | null
      if (targetSqEl && !targetSqEl.querySelector('.dest-hint, .dest-capture-ring')) {
        const hasPiece = !!pieces[destSq]
        const hint = document.createElement('div')
        hint.className = hasPiece ? 'dest-capture-ring' : 'dest-hint move-hint-dot'
        targetSqEl.appendChild(hint)
      }
    }
  }

  private render(): void {
    const liveState = this.store.getLiveState()
    const historyLen = liveState.history.length
    const isReview = this.store.isReviewMode()
    const isViewingHistory = this.store.isViewingHistory()

    if (historyLen !== this.lastHistoryLength) {
      this.externalArrow = null
    }

    if (!isReview && !isViewingHistory) {
      if (historyLen === this.lastHistoryLength + 1 && historyLen > 0) {
        const lastMv = liveState.history[historyLen - 1]
        const gameResult = this.store.getLiveGameResult()
        const check = this.store.isInCheck()

        if (gameResult.type === 'checkmate') {
          solarAudio.playCheckmate()
        } else if (check) {
          solarAudio.playCheck()
        } else if (lastMv?.captured) {
          solarAudio.playCapture()
        } else {
          solarAudio.playMove()
        }
      }
    } else if (isReview) {
      const activeVar = this.store.getActiveVariationNode()
      if (activeVar && activeVar.id !== this.lastVariationId) {
        this.lastVariationId = activeVar.id
        if (activeVar.class === 'stellar') {
          solarAudio.playStellar()
        } else if (activeVar.san.includes('#')) {
          solarAudio.playCheckmate()
        } else if (activeVar.san.includes('+')) {
          solarAudio.playCheck()
        } else if (activeVar.san.includes('x') || activeVar.move.captured) {
          solarAudio.playCapture()
        } else {
          solarAudio.playMove()
        }
      } else if (!activeVar) {
        this.lastVariationId = null
      }
    }
    this.lastHistoryLength = historyLen

    // Check and execute pending premove when its turn arrives
    const nextPm = this.store.getPremove()
    if (nextPm && !isReview && !isViewingHistory && !this.store.isGameOver()) {
      const pmPiece = liveState.board.pieces[nextPm.from]
      const isMyTurn = pmPiece && pmPiece.color === liveState.turn
      const isAiBlocked =
        this.store.getGameMode() === 'ai' &&
        (this.store.isAIThinking() || liveState.turn !== this.store.getPlayerColor())

      if (isMyTurn && !isAiBlocked) {
        const executed = this.store.executeNextPremove()
        if (executed) return
      }
    }

    this.clearStellarDecorations()

    const state = this.store.getState()
    const { width, height } = state.board
    const pieces = [...state.board.pieces]
    const flipped = this.store.isFlipped()
    const selectedSq = this.store.getSelectedSquare()
    const pendingPromo = this.store.getPendingPromotion()
    const validDests = selectedSq !== null ? this.store.getValidDestinationsFor(selectedSq) : []
    const lastMove = this.store.getLastMove()
    const inCheck = this.store.isInCheck()
    const kingSq = inCheck ? this.store.getKingSquare() : null
    const premoves = this.store.getPremoves()
    const newLiveMove = !isReview && !isViewingHistory && this.lastRenderedHistoryLen >= 0 &&
      historyLen > this.lastRenderedHistoryLen && this.lastRenderedViewIndex === null &&
      this.lastRenderedFlipped === flipped ? lastMove : null
    const shock = kingSq !== null && this.lastRenderedFen !== serializeFEN(state)
    this.clearBoardEffects()
    if (newLiveMove?.captured) this.dematerializeCapturedPiece(newLiveMove, flipped, width, height)

    if (this.lastRenderedFen !== serializeFEN(state) ||
      this.lastRenderedHistoryLen !== historyLen ||
      this.lastRenderedViewIndex !== this.store.getViewIndex() ||
      this.lastRenderedVariationId !== (this.store.getActiveVariationNode()?.id ?? null)) {
      this.clearPlanning()
    }

    // Visually relocate pieces to destination squares for active premoves (chess.com physics)
    for (const pm of premoves) {
      const pieceToMove = pieces[pm.from]
      if (pieceToMove) {
        pieces[pm.to] = pm.promotion ? { ...pieceToMove, type: pm.promotion } : pieceToMove
        pieces[pm.from] = null
      }
    }

    // Set board CSS grid variable
    this.boardEl.style.setProperty('--board-width', width.toString())
    this.boardEl.style.setProperty('--board-height', height.toString())

    this.boardEl.innerHTML = ''

    // Render squares in display order
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const x = flipped ? width - 1 - c : c
        const y = flipped ? height - 1 - r : r
        const sq = y * width + x
        const piece = pieces[sq]

        const isLight = (x + y) % 2 === 0
        const isSelected = selectedSq === sq
        const isLastMove = lastMove ? lastMove.from === sq || lastMove.to === sq : false
        const isKingInCheck = kingSq === sq
        const isDest = validDests.includes(sq)
        const isPremoveFrom = premoves.some((pm) => pm.from === sq)
        const isPremoveTo = premoves.some((pm) => pm.to === sq)

        const sqEl = document.createElement('div')
        sqEl.className = `chess-square ${isLight ? 'light' : 'dark'}`
        sqEl.dataset.square = sq.toString()

        if (isSelected) sqEl.classList.add('selected', 'selected-square', 'square-selected')
        if (isLastMove) sqEl.classList.add('last-move')
        if (isKingInCheck) sqEl.classList.add('in-check')
        if (isPremoveFrom) sqEl.classList.add('square-premove-from', 'square-premove-origin')
        if (isPremoveTo) sqEl.classList.add('square-premove-to')

        // Coordinate labels on edges
        const isRankEdge = flipped ? c === width - 1 : c === 0
        const isFileEdge = flipped ? r === 0 : r === height - 1

        if (isRankEdge) {
          const rankLabel = document.createElement('span')
          rankLabel.className = 'coord-label rank'
          rankLabel.textContent = (height - y).toString()
          sqEl.appendChild(rankLabel)
        }

        if (isFileEdge) {
          const fileLabel = document.createElement('span')
          fileLabel.className = 'coord-label file'
          fileLabel.textContent = String.fromCharCode(97 + x)
          sqEl.appendChild(fileLabel)
        }

        // Destination hints
        if (isDest) {
          const hint = document.createElement('div')
          hint.className = piece ? 'dest-capture-ring' : 'dest-hint'
          sqEl.appendChild(hint)
        }

        // Piece
        if (piece) {
          const pieceEl = document.createElement('div')
          pieceEl.className = 'piece-wrapper'
          pieceEl.innerHTML = getPieceSvg(piece.type, piece.color)
          sqEl.appendChild(pieceEl)
        }

        this.boardEl.appendChild(sqEl)
      }
    }

    // Render promotion dialog if needed
    if (pendingPromo) {
      this.renderPromotionModal(pendingPromo)
    } else {
      this.promoOverlayEl.style.display = 'none'
      this.promoOverlayEl.innerHTML = ''
    }

    this.renderEvalBar(flipped)
    this.renderBestMoveArrow(flipped)
    this.renderMoveBadge(flipped)
    this.handleReviewMoveKinematics(flipped, width, height)
    this.renderSolarWings()
    this.renderPlanning()
    if (newLiveMove) {
      const land = () => this.animateLanding(newLiveMove.to)
      if (newLiveMove.piece.color !== this.store.getPlayerColor() && !this.isDragging) {
        this.animatePieceSlide(newLiveMove.from, newLiveMove.to, flipped, width, height, land, true)
      } else {
        land()
      }
    }
    if (shock && kingSq !== null) this.animateKingShock(kingSq)

    this.lastRenderedFen = serializeFEN(state)
    this.lastRenderedFlipped = flipped
    this.lastRenderedSelectedSq = selectedSq
    this.lastRenderedHistoryLen = historyLen
    this.lastRenderedViewIndex = this.store.getViewIndex()
    this.lastRenderedVariationId = this.store.getActiveVariationNode()?.id ?? null
    this.lastRenderedPendingPromo = pendingPromo !== null
    this.lastRenderedPremovesLen = premoves.length
    this.lastRenderedAnalysisKey = this.getAnalysisRenderKey()
    this.lastRenderedReview = this.store.getReviewResult()
  }

  private animationsEnabled(): boolean {
    return !this.instantMotion && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }

  private clearBoardEffects(): void {
    this.clearingEffects = true
    for (const cleanup of [...this.effectCleanups]) cleanup()
    this.effectsLayerEl.replaceChildren()
    this.clearingEffects = false
  }

  private finishEffect(el: HTMLElement, duration: number, done: () => void, transition = false): void {
    let timer: ReturnType<typeof setTimeout> | undefined
    const eventName = transition ? 'transitionend' : 'animationend'
    const cleanup = () => {
      if (!this.effectCleanups.delete(cleanup)) return
      if (timer !== undefined) clearTimeout(timer)
      el.removeEventListener(eventName, onEnd)
      done()
    }
    const onEnd = (event: Event) => {
      if (event.target === el && (!transition || (event as TransitionEvent).propertyName === 'transform')) cleanup()
    }
    this.effectCleanups.add(cleanup)
    el.addEventListener(eventName, onEnd)
    if (this.animationsEnabled()) timer = setTimeout(cleanup, duration + 30)
    else cleanup()
  }

  private effectElement(className: string): HTMLElement {
    const el = document.createElement('div')
    el.className = className
    el.setAttribute('aria-hidden', 'true')
    return el
  }

  private positionEffect(el: HTMLElement, sq: Square, flipped: boolean, width: number, height: number): void {
    const col = flipped ? width - 1 - sq % width : sq % width
    const row = flipped ? height - 1 - Math.floor(sq / width) : Math.floor(sq / width)
    el.style.left = `${col * 100 / width}%`
    el.style.top = `${row * 100 / height}%`
    el.style.width = `${100 / width}%`
    el.style.height = `${100 / height}%`
  }

  private animateLanding(sq: Square): void {
    const target = this.boardEl.querySelector<HTMLElement>(`[data-square="${sq}"]`)
    if (!target) return
    target.classList.add('solar-piece-land')
    const piece = target.querySelector<HTMLElement>('.piece-wrapper')
    if (!this.animationsEnabled()) {
      target.classList.remove('solar-piece-land')
      return
    }
    if (piece) this.finishEffect(piece, 140, () => target.classList.remove('solar-piece-land'))
    const ripple = this.effectElement('solar-landing-ripple')
    target.prepend(ripple)
    this.finishEffect(ripple, 180, () => ripple.remove())
  }

  private dematerializeCapturedPiece(move: Move, flipped: boolean, width: number, height: number): void {
    if (!this.animationsEnabled()) return
    const sq = move.capturedAt ?? move.to
    const piece = this.boardEl.querySelector<HTMLElement>(`[data-square="${sq}"] .piece-wrapper`)
    if (!piece) return
    const slot = this.effectElement('solar-capture-slot')
    this.positionEffect(slot, sq, flipped, width, height)
    piece.className = 'piece-wrapper piece-dematerialize'
    piece.style.transform = ''
    piece.style.transition = ''
    piece.setAttribute('aria-hidden', 'true')
    slot.appendChild(piece)
    this.effectsLayerEl.appendChild(slot)
    this.finishEffect(piece, 190, () => slot.remove())
  }

  private animateKingShock(sq: Square): void {
    if (!this.animationsEnabled()) return
    const target = this.boardEl.querySelector<HTMLElement>(`[data-square="${sq}"]`)
    const piece = target?.querySelector<HTMLElement>('.piece-wrapper')
    if (!target || !piece) return
    target.classList.add('solar-king-shock')
    piece.classList.add('solar-king-shock')
    const halo = this.effectElement('solar-king-halo')
    target.prepend(halo)
    this.finishEffect(target, 340, () => {
      target.classList.remove('solar-king-shock')
      piece.classList.remove('solar-king-shock')
      halo.remove()
    })
  }

  private animateWarpTrail(from: Square, to: Square, flipped: boolean, width: number, height: number): void {
    if (!this.animationsEnabled()) return
    const rect = this.boardEl.getBoundingClientRect()
    const sign = flipped ? -1 : 1
    const dx = (to % width - from % width) * rect.width / width * sign
    const dy = (Math.floor(to / width) - Math.floor(from / width)) * rect.height / height * sign
    const slot = this.effectElement('solar-trail-slot')
    this.positionEffect(slot, from, flipped, width, height)
    const trail = this.effectElement('solar-warp-trail')
    trail.style.width = `${Math.hypot(dx, dy)}px`
    trail.style.transform = `translate3d(0, -50%, 0) rotate(${Math.atan2(dy, dx)}rad)`
    slot.appendChild(trail)
    this.effectsLayerEl.appendChild(slot)
    this.finishEffect(trail, 240, () => slot.remove())
  }

  private handleReviewMoveKinematics(flipped: boolean, width: number, height: number): void {
    const isReview = this.store.isReviewMode()
    const viewIndex = this.store.getViewIndex()
    const review = this.store.getReviewResult()
    const activeVar = this.store.getActiveVariationNode()

    if (!isReview) {
      this.lastAnimatedViewIndex = null
      this.lastAnimatedVariationId = null
      this.isReviewModeWasActive = false
      return
    }

    // When review mode is first entered, memorize position without sliding
    if (!this.isReviewModeWasActive) {
      this.isReviewModeWasActive = true
      this.lastAnimatedViewIndex = viewIndex
      this.lastAnimatedVariationId = activeVar ? activeVar.id : null
      return
    }

    // Check if active variation changed or was played
    if (activeVar) {
      if (activeVar.id !== this.lastAnimatedVariationId) {
        const prevVarId = this.lastAnimatedVariationId
        this.lastAnimatedVariationId = activeVar.id

        if (prevVarId) {
          const prevVar = this.store.findVariationNode(prevVarId)
          if (prevVar && prevVar.parentId === activeVar.id) {
            // Step backward 1 move in variation
            this.animatePieceSlide(prevVar.move.to, prevVar.move.from, flipped, width, height)
            return
          }
        }
        // Step forward or new variation
        this.animatePieceSlide(activeVar.move.from, activeVar.move.to, flipped, width, height)
      }
      return
    } else {
      this.lastAnimatedVariationId = null
    }

    if (!review || !review.moves || review.moves.length === 0) {
      this.lastAnimatedViewIndex = null
      return
    }

    const prevIndex = this.lastAnimatedViewIndex
    this.lastAnimatedViewIndex = viewIndex

    // If viewIndex hasn't changed, no animation
    if (prevIndex === viewIndex) {
      return
    }

    // Spam / rapid click protection (< 150ms): snap immediately without animation
    const now = Date.now()
    if (this.lastSlideTime > 0 && now - this.lastSlideTime < 150 && now >= this.lastSlideTime) {
      this.lastSlideTime = now
      return
    }
    this.lastSlideTime = now

    const effectiveCurrent = viewIndex === null ? review.moves.length - 1 : viewIndex
    const effectivePrev = prevIndex === null ? review.moves.length - 1 : prevIndex

    if (effectiveCurrent === effectivePrev) {
      return
    }

    if (effectiveCurrent > effectivePrev) {
      // Step forward: the move at effectiveCurrent was made
      const revMove = review.moves[effectiveCurrent]
      if (revMove && revMove.move) {
        this.animatePieceSlide(revMove.move.from, revMove.move.to, flipped, width, height)
      }
    } else if (effectiveCurrent === effectivePrev - 1) {
      // Step backward 1 move: the move at effectivePrev was undone
      const revMove = review.moves[effectivePrev]
      if (revMove && revMove.move) {
        this.animatePieceSlide(revMove.move.to, revMove.move.from, flipped, width, height)
      }
    } else if (effectiveCurrent >= 0) {
      // Jumped to a move: animate the move landing
      const revMove = review.moves[effectiveCurrent]
      if (revMove && revMove.move) {
        this.animatePieceSlide(revMove.move.from, revMove.move.to, flipped, width, height)
      }
    }
  }

  private animatePieceSlide(
    fromSq: Square,
    toSq: Square,
    flipped: boolean,
    width: number,
    height: number,
    onLanding?: () => void,
    warp = false,
  ): void {
    const targetSqEl = this.boardEl.querySelector(`[data-square="${toSq}"]`) as HTMLElement | null
    if (!targetSqEl) return

    const pieceEl = targetSqEl.querySelector('.piece-wrapper') as HTMLElement | null
    if (!pieceEl) return
    if (!this.animationsEnabled()) {
      // Preserve the existing review marker without running motion in tests.
      if (!onLanding) {
        pieceEl.classList.add('piece-sliding')
      }
      onLanding?.()
      return
    }
    if (warp) this.animateWarpTrail(fromSq, toSq, flipped, width, height)

    const fromX = fromSq % width
    const fromY = Math.floor(fromSq / width)
    const toX = toSq % width
    const toY = Math.floor(toSq / width)

    const fromCol = flipped ? width - 1 - fromX : fromX
    const fromRow = flipped ? height - 1 - fromY : fromY
    const toCol = flipped ? width - 1 - toX : toX
    const toRow = flipped ? height - 1 - toY : toY

    const deltaCol = fromCol - toCol
    const deltaRow = fromRow - toRow

    if (deltaCol === 0 && deltaRow === 0) return

    const sqRect = targetSqEl.getBoundingClientRect()
    const usePx = sqRect && sqRect.width > 0
    const dx = usePx ? `${deltaCol * sqRect.width}px` : `calc(${deltaCol} * 100% / 0.9)`
    const dy = usePx ? `${deltaRow * sqRect.height}px` : `calc(${deltaRow} * 100% / 0.9)`

    // Invert phase (FLIP)
    pieceEl.style.transition = 'none'
    pieceEl.style.transform = `translate3d(${dx}, ${dy}, 0)`

    // Force reflow
    void pieceEl.offsetHeight

    // Play phase (FLIP)
    pieceEl.classList.add('piece-sliding')
    pieceEl.style.transition = ''
    pieceEl.style.transform = 'translate3d(0, 0, 0)'

    const cleanup = () => {
      pieceEl.classList.remove('piece-sliding')
      pieceEl.style.transform = ''
      if (pieceEl.isConnected && !this.clearingEffects) onLanding?.()
    }
    this.finishEffect(pieceEl, 170, cleanup, true)
  }

  private clearStellarDecorations(): void {
    this.currentWingsMountEl?.remove()
    this.currentWingsMountEl = null
    if (this.wingsTimer) clearTimeout(this.wingsTimer)
    this.wingsTimer = null
    this.boardEl.querySelectorAll('.stellar-wings-mount, .stellar-wings, .stellar-crown, .stellar-aura')
      .forEach((el) => el.remove())
    this.boardEl.querySelectorAll('.is-stellar, .has-wings')
      .forEach((el) => el.classList.remove('is-stellar', 'has-wings'))
  }

  private renderSolarWings(): void {
    const isReview = this.store.isReviewMode()
    if (!isReview) return
    const activeVar = this.store.getActiveVariationNode()
    if (activeVar) {
      if (activeVar.class === 'stellar') this.mountSolarWings(activeVar.move.to)
      return
    }
    const review = this.store.getReviewResult()
    if (!isReview || !review || !review.moves || review.moves.length === 0) {
      return
    }

    const viewIndex = this.store.getViewIndex()
    if (viewIndex === -1) {
      return
    }

    const currentMoveIndex = viewIndex === null ? review.moves.length - 1 : viewIndex
    if (currentMoveIndex < 0 || currentMoveIndex >= review.moves.length) {
      return
    }

    const reviewedMove = review.moves[currentMoveIndex]
    if (!reviewedMove || reviewedMove.class !== 'stellar' || !reviewedMove.move) {
      return
    }

    const toSquare = reviewedMove.move.to
    this.mountSolarWings(toSquare)
  }

  private mountSolarWings(toSquare: Square): void {
    const targetSqEl = this.boardEl.querySelector(`[data-square="${toSquare}"]`) as HTMLElement | null
    if (!targetSqEl) return

    const wingsMount = document.createElement('div')
    wingsMount.className = 'stellar-wings-mount stellar-wings'
    wingsMount.setAttribute('aria-hidden', 'true')
    wingsMount.innerHTML = `
      <svg class="stellar-wings-svg stellar-wings-flutter" viewBox="0 0 100 60" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="solar-wing-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="45%" stop-color="#f43f5e" />
            <stop offset="100%" stop-color="#c026d3" />
          </linearGradient>
          <linearGradient id="wing-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="45%" stop-color="#f43f5e" />
            <stop offset="100%" stop-color="#c026d3" />
          </linearGradient>
          <linearGradient id="solar-wings-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="100%" stop-color="#c026d3" />
          </linearGradient>
          <linearGradient id="solar-crown-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fffbeb" />
            <stop offset="35%" stop-color="#fde68a" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>
        </defs>
        <g class="stellar-wings-group">
          <!-- Left Angelic Wing -->
          <g class="stellar-wing stellar-wing-left">
            <path class="wing-feather-main" d="M 45 35 C 41 24, 30 12, 16 3 L -4 -2 C 4 7, 10 13, 13 18 L -1 18 C 7 22, 13 26, 16 30 L 5 31 C 12 34, 17 37, 20 40 L 12 43 C 18 45, 23 47, 26 49 L 22 52 C 30 50, 38 44, 45 35 Z" fill="url(#solar-wing-gradient)" stroke="none" />
            <path class="wing-feather-soft" d="M 44 34 C 38 25, 29 16, 18 9 L 6 7 C 12 13, 18 19, 21 24 L 11 25 C 17 29, 22 33, 24 37 L 18 39 C 24 42, 31 43, 36 41 C 41 39, 43 36, 44 34 Z" fill="url(#solar-wing-gradient)" opacity="0.6" stroke="none" />
          </g>
          <!-- Right Angelic Wing -->
          <g class="stellar-wing stellar-wing-right">
            <path class="wing-feather-main" d="M 55 35 C 59 24, 70 12, 84 3 L 104 -2 C 96 7, 90 13, 87 18 L 101 18 C 93 22, 87 26, 84 30 L 95 31 C 88 34, 83 37, 80 40 L 88 43 C 82 45, 77 47, 74 49 L 78 52 C 70 50, 62 44, 55 35 Z" fill="url(#solar-wing-gradient)" stroke="none" />
            <path class="wing-feather-soft" d="M 56 34 C 62 25, 71 16, 82 9 L 94 7 C 88 13, 82 19, 79 24 L 89 25 C 83 29, 78 33, 76 37 L 82 39 C 76 42, 69 43, 64 41 C 59 39, 57 36, 56 34 Z" fill="url(#solar-wing-gradient)" opacity="0.6" stroke="none" />
          </g>
        </g>
        <!-- Floating Solar Crown (Stage 5b-5) -->
        <g class="stellar-crown stellar-crown-float" aria-hidden="true">
          <path class="crown-body" d="M 38 14 L 38 6 L 43 10 L 46 3 L 49 8 L 50 0 L 51 8 L 54 3 L 57 10 L 62 6 L 62 14 Q 50 16 38 14 Z" fill="url(#solar-crown-gold)" stroke="none" />
          <path class="crown-sparkle" d="M 50 -3 L 51 -1 L 53 0 L 51 1 L 50 3 L 49 1 L 47 0 L 49 -1 Z" fill="#fffbeb" />
          <circle cx="46" cy="3" r="1" fill="#fffbeb" />
          <circle cx="54" cy="3" r="1" fill="#fffbeb" />
          <circle cx="38" cy="6" r="0.8" fill="#fde68a" />
          <circle cx="62" cy="6" r="0.8" fill="#fde68a" />
        </g>
      </svg>
    `.trim()

    const pieceWrapper = targetSqEl.querySelector('.piece-wrapper')
    if (pieceWrapper) {
      targetSqEl.insertBefore(wingsMount, pieceWrapper)
    } else {
      targetSqEl.appendChild(wingsMount)
    }

    this.currentWingsMountEl = wingsMount

    const cleanup = () => {
      if (wingsMount.parentElement) {
        wingsMount.remove()
      }
      if (this.currentWingsMountEl === wingsMount) {
        this.currentWingsMountEl = null
      }
      if (this.wingsTimer) {
        clearTimeout(this.wingsTimer)
        this.wingsTimer = null
      }
    }

    wingsMount.addEventListener('animationend', cleanup, { once: true })
    this.wingsTimer = setTimeout(cleanup, 2500)
  }

  private renderMoveBadge(flipped: boolean): void {
    if (!this.badgeLayerEl) return
    this.badgeLayerEl.innerHTML = ''
    if (this.hideBadges) return

    const activeVar = this.store.getActiveVariationNode()
    if (activeVar) {
      const toSquare = activeVar.move.to
      const moveClass = activeVar.class
      const meta = moveClass ? getMoveClassMeta(moveClass) : null

      const { width, height } = this.store.getState().board
      const toX = toSquare % width
      const toY = Math.floor(toSquare / width)

      const col = flipped ? width - 1 - toX : toX
      const row = flipped ? height - 1 - toY : toY

      const leftPct = (col / width) * 100
      const topPct = (row / height) * 100
      const widthPct = 100 / width
      const heightPct = 100 / height

      const slotEl = document.createElement('div')
      slotEl.className = 'board-badge-slot'
      slotEl.style.position = 'absolute'
      slotEl.style.left = `${leftPct}%`
      slotEl.style.top = `${topPct}%`
      slotEl.style.width = `${widthPct}%`
      slotEl.style.height = `${heightPct}%`
      slotEl.style.pointerEvents = 'none'

      const badgeEl = document.createElement('div')
      badgeEl.className = `board-move-badge move-badge badge-${moveClass ?? 'pending'}`
      if (moveClass) badgeEl.dataset.class = moveClass
      badgeEl.dataset.square = toSquare.toString()
      badgeEl.title = meta?.nameRu ?? 'Анализ...'
      badgeEl.innerHTML = meta?.svg ?? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2" /></svg>'

      slotEl.appendChild(badgeEl)
      this.badgeLayerEl.appendChild(slotEl)
      return
    }

    const review = this.store.getReviewResult()
    if (!review || !review.moves || review.moves.length === 0) {
      return
    }

    const viewIndex = this.store.getViewIndex()
    // In start position before the first move (viewIndex = -1), badge must not be shown
    if (viewIndex === -1) {
      return
    }

    let moveIndex: number
    if (viewIndex === null) {
      // In live/current view, show badge in review mode or when game is finished
      if (!this.store.isReviewMode() && !this.store.isGameOver()) {
        return
      }
      moveIndex = review.moves.length - 1
    } else {
      moveIndex = viewIndex
    }

    if (moveIndex < 0 || moveIndex >= review.moves.length) {
      return
    }

    const reviewedMove = review.moves[moveIndex]
    if (!reviewedMove || !reviewedMove.move) {
      return
    }

    const toSquare = reviewedMove.move.to
    const moveClass = reviewedMove.class
    const meta = getMoveClassMeta(moveClass)

    const { width, height } = this.store.getState().board
    const toX = toSquare % width
    const toY = Math.floor(toSquare / width)

    const col = flipped ? width - 1 - toX : toX
    const row = flipped ? height - 1 - toY : toY

    const leftPct = (col / width) * 100
    const topPct = (row / height) * 100
    const widthPct = 100 / width
    const heightPct = 100 / height

    const slotEl = document.createElement('div')
    slotEl.className = 'board-badge-slot'
    slotEl.style.position = 'absolute'
    slotEl.style.left = `${leftPct}%`
    slotEl.style.top = `${topPct}%`
    slotEl.style.width = `${widthPct}%`
    slotEl.style.height = `${heightPct}%`
    slotEl.style.pointerEvents = 'none'

    const badgeEl = document.createElement('div')
    badgeEl.className = `board-move-badge move-badge badge-${moveClass}`
    badgeEl.dataset.class = moveClass
    badgeEl.dataset.square = toSquare.toString()
    badgeEl.title = meta.nameRu
    badgeEl.innerHTML = meta.svg

    slotEl.appendChild(badgeEl)
    this.badgeLayerEl.appendChild(slotEl)
  }

  private renderEvalBar(flipped: boolean): void {
    if (this.externalScore !== null) {
      this.evalBarWrapperEl.style.display = 'flex'
      const whiteChance = Math.max(0, Math.min(100, winChance(this.externalScore)))
      const fillHeight = flipped ? 100 - whiteChance : whiteChance
      this.evalBarFillEl.style.height = `${fillHeight}%`
      if (this.externalScore.type === 'mate') {
        const val = this.externalScore.value
        this.evalBarTextEl.textContent = val > 0 ? `M${Math.abs(val)}` : `-M${Math.abs(val)}`
      } else {
        const cp = this.externalScore.value / 100
        const sign = cp > 0 ? '+' : ''
        this.evalBarTextEl.textContent = `${sign}${cp.toFixed(1)}`
      }
      return
    }

    const isReviewActive = this.store.isReviewMode()
    const activeVar = this.store.getActiveVariationNode()
    if (isReviewActive && activeVar && activeVar.score) {
      this.evalBarWrapperEl.style.display = 'flex'
      const whiteChance = Math.max(0, Math.min(100, winChance(activeVar.score)))
      const fillHeight = flipped ? 100 - whiteChance : whiteChance
      this.evalBarFillEl.style.height = `${fillHeight}%`
      if (activeVar.score.type === 'mate') {
        this.evalBarTextEl.textContent = 'Мат'
      } else {
        this.evalBarTextEl.textContent = `${Math.round(whiteChance)}%`
      }
      return
    }

    const review = this.store.getReviewResult()
    if (!isReviewActive || !review || !review.evalHistory || review.evalHistory.length === 0) {
      this.evalBarWrapperEl.style.display = 'none'
      return
    }

    this.evalBarWrapperEl.style.display = 'flex'
    const viewIdx = this.store.getViewIndex()
    let ply = 0
    if (viewIdx === null) {
      ply = review.evalHistory.length - 1
    } else if (viewIdx >= 0) {
      ply = Math.min(viewIdx + 1, review.evalHistory.length - 1)
    }

    const evalPoint = review.evalHistory[ply]
    if (!evalPoint) return

    const whiteChance = Math.max(0, Math.min(100, evalPoint.whiteWinChance))
    const fillHeight = flipped ? 100 - whiteChance : whiteChance
    this.evalBarFillEl.style.height = `${fillHeight}%`

    if (evalPoint.score.type === 'mate') {
      this.evalBarTextEl.textContent = 'Мат'
    } else {
      this.evalBarTextEl.textContent = `${Math.round(whiteChance)}%`
    }
  }

  private renderBestMoveArrow(flipped: boolean): void {
    if (!this.arrowLayerEl) return
    this.arrowLayerEl.innerHTML = ''

    const activeVar = this.store.getActiveVariationNode()
    const review = this.store.getReviewResult()
    const viewIndex = this.store.getViewIndex()

    let bestMove = this.externalArrow ?? activeVar?.bestMove ?? null
    if (!bestMove && review && viewIndex !== null && viewIndex >= 0 && viewIndex < review.moves.length) {
      bestMove = review.moves[viewIndex]?.bestMove ?? null
    }
    if (!bestMove) return

    const { width, height } = this.store.getState().board

    const sqW = 800 / width
    const sqH = 800 / height

    const fromX = bestMove.from % width
    const fromY = Math.floor(bestMove.from / width)
    const toX = bestMove.to % width
    const toY = Math.floor(bestMove.to / width)

    const fromCol = flipped ? width - 1 - fromX : fromX
    const fromRow = flipped ? height - 1 - fromY : fromY
    const toCol = flipped ? width - 1 - toX : toX
    const toRow = flipped ? height - 1 - toY : toY

    const x1 = fromCol * sqW + sqW / 2
    const y1 = fromRow * sqH + sqH / 2
    const x2 = toCol * sqW + sqW / 2
    const y2 = toRow * sqH + sqH / 2

    const angle = Math.atan2(y2 - y1, x2 - x1)
    const shorten = sqW * 0.22
    const endX = x2 - Math.cos(angle) * shorten
    const endY = y2 - Math.sin(angle) * shorten

    this.arrowLayerEl.innerHTML = `
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="#22c55e" />
        </marker>
      </defs>
      <line
        class="best-move-arrow-line"
        x1="${x1}"
        y1="${y1}"
        x2="${endX}"
        y2="${endY}"
        stroke="#22c55e"
        stroke-width="14"
        stroke-linecap="round"
        opacity="0.85"
        marker-end="url(#arrowhead)"
      />
    `
  }

  private renderPromotionModal(promo: { from: Square; to: Square }): void {
    const state = this.store.getState()
    const color = state.turn
    const pieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight']

    this.promoOverlayEl.innerHTML = `
      <div class="promo-modal">
        <div class="promo-title">Выберите фигуру</div>
        <div class="promo-options"></div>
      </div>
    `

    const optionsContainer = this.promoOverlayEl.querySelector('.promo-options') as HTMLElement
    for (const p of pieces) {
      const btn = document.createElement('button')
      btn.className = 'promo-btn'
      btn.innerHTML = getPieceSvg(p, color)
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.store.makeMove(promo.from, promo.to, p)
      })
      optionsContainer.appendChild(btn)
    }

    this.promoOverlayEl.style.display = 'flex'
  }

  private processStartAt(target: HTMLElement, clientX: number, clientY: number): boolean {
    if (this.store.getPendingPromotion()) return false
    const isReview = this.store.isReviewMode()
    if (isReview) {
      if (this.store.isReviewInProgress()) return false
    } else if (this.store.isGameOver() || (!this.store.isAllowVariations() && this.store.isViewingHistory())) {
      return false
    }
    if (!target || !target.dataset.square) return false

    const sq = parseInt(target.dataset.square, 10)
    const state = this.store.getState()
    const specPieces = this.getSpeculativePieces()
    const piece = specPieces[sq] ?? state.board.pieces[sq]
    const turn = state.turn

    // ── Premove Handling ──────────────────────────────────────────────────
    if (!isReview) {
      // 1. If a premove piece is already selected, delegate to premove handler
      if (this.premoveSelectedSq !== null) {
        return this.processPremoveStartAt(sq, piece, clientX, clientY, target)
      }

      // 2. If clicking on a piece of the side NOT currently on turn (or AI thinking):
      const isAI = this.store.getGameMode() === 'ai'
      const isPremovePiece =
        piece &&
        (isAI
          ? piece.color === this.store.getPlayerColor() &&
            (turn !== this.store.getPlayerColor() || this.store.isAIThinking())
          : piece.color !== turn)

      if (isPremovePiece) {
        return this.processPremoveStartAt(sq, piece, clientX, clientY, target)
      }

      // 3. If clicking empty space or enemy piece while a premove is pending, reset it
      if (this.store.getPremoves().length > 0 && (!piece || piece.color !== turn)) {
        this.clearPremoves()
      }
    }

    // ── Normal Move Handling (Current turn) ──────────────────────────────
    if (!this.store.isPlayerTurn() || this.store.isAIThinking()) {
      return false
    }

    const selectedSq = this.store.getSelectedSquare()

    // If we already had a square selected and clicked on another square
    if (selectedSq !== null) {
      // If clicking on one of legal destinations
      const validDests = this.store.getValidDestinationsFor(selectedSq)
      if (validDests.includes(sq)) {
        this.store.makeMove(selectedSq, sq)
        return true
      }

      // If clicking back on the same square -> deselect
      if (selectedSq === sq) {
        this.store.selectSquare(null)
        return true
      }
    }

    // Clicked on a piece of current turn -> select & prepare drag
    if (piece && piece.color === turn) {
      this.store.selectSquare(sq)

      // Start drag
      this.isDragging = true
      this.dragFromSquare = sq

      // Dim original piece
      const pieceWrapper = target.querySelector('.piece-wrapper') as HTMLElement | null
      if (pieceWrapper) {
        pieceWrapper.classList.add('dragging')
      }

      // Create floating element
      if (this.floatingPieceEl) {
        this.floatingPieceEl.remove()
      }
      this.floatingPieceEl = document.createElement('div')
      this.floatingPieceEl.className = 'floating-drag-piece'
      this.floatingPieceEl.innerHTML = getPieceSvg(piece.type, piece.color)
      this.floatingPieceEl.style.left = `${clientX}px`
      this.floatingPieceEl.style.top = `${clientY}px`
      document.body.appendChild(this.floatingPieceEl)
      return true
    } else {
      // Clicked on empty space or enemy piece without active selection
      this.store.selectSquare(null)
      return false
    }
  }

  private processPremoveStartAt(
    sq: Square,
    piece: Piece | null,
    clientX: number,
    clientY: number,
    target: HTMLElement,
  ): boolean {
    const state = this.store.getState()
    const { width, height, pieces } = state.board
    const myColor =
      this.store.getGameMode() === 'ai'
        ? this.store.getPlayerColor()
        : state.turn === 'white'
          ? 'black'
          : 'white'

    // If we already have a square selected for premove
    if (this.premoveSelectedSq !== null) {
      // Clicking on the exact same square -> deselect
      if (this.premoveSelectedSq === sq) {
        this.premoveSelectedSq = null
        this.clearPremoveHintDots()
        return true
      }

      // Clicking on another piece of player's color -> switch selection to it
      if (piece && piece.color === myColor) {
        this.clearPremoveHintDots()
        this.premoveSelectedSq = sq
        this.renderPremoveHintDots(sq)
        this.isDragging = true
        this.dragFromSquare = sq
        this.isPremoveDrag = true

        const pieceWrapper = target.querySelector('.piece-wrapper') as HTMLElement | null
        if (pieceWrapper) {
          pieceWrapper.classList.add('dragging')
        }
        if (this.floatingPieceEl) {
          this.floatingPieceEl.remove()
        }
        this.floatingPieceEl = document.createElement('div')
        this.floatingPieceEl.className = 'floating-drag-piece'
        this.floatingPieceEl.innerHTML = getPieceSvg(piece.type, piece.color)
        this.floatingPieceEl.style.left = `${clientX}px`
        this.floatingPieceEl.style.top = `${clientY}px`
        document.body.appendChild(this.floatingPieceEl)
        return true
      }

      // Clicking on any other destination square -> commit premove from -> to
      const fromSq = this.premoveSelectedSq
      const specPieces = this.getSpeculativePieces()
      const fromPiece = specPieces[fromSq] ?? pieces[fromSq]
      if (fromPiece && !isGeometricallyValidPremove(fromSq, sq, fromPiece, width, height)) {
        this.premoveSelectedSq = null
        this.clearPremoveHintDots()
        this.clearPremoves()
        return false
      }
      let promo: PieceType | undefined
      if (fromPiece && fromPiece.type === 'pawn') {
        const toY = Math.floor(sq / width)
        const isPromoRank = fromPiece.color === 'white' ? toY === 0 : toY === height - 1
        if (isPromoRank) {
          promo = 'queen'
        }
      }

      this.premoveSelectedSq = null
      this.clearPremoveHintDots()
      this.addPremove({ from: fromSq, to: sq, promotion: promo })
      return true
    }

    // No piece currently selected for premove:
    // If clicking on a piece of player's color -> start premove selection/drag & render hint dots
    if (piece && piece.color === myColor) {
      this.premoveSelectedSq = sq
      this.renderPremoveHintDots(sq)
      this.isDragging = true
      this.dragFromSquare = sq
      this.isPremoveDrag = true

      const pieceWrapper = target.querySelector('.piece-wrapper') as HTMLElement | null
      if (pieceWrapper) {
        pieceWrapper.classList.add('dragging')
      }
      if (this.floatingPieceEl) {
        this.floatingPieceEl.remove()
      }
      this.floatingPieceEl = document.createElement('div')
      this.floatingPieceEl.className = 'floating-drag-piece'
      this.floatingPieceEl.innerHTML = getPieceSvg(piece.type, piece.color)
      this.floatingPieceEl.style.left = `${clientX}px`
      this.floatingPieceEl.style.top = `${clientY}px`
      document.body.appendChild(this.floatingPieceEl)
      return true
    } else {
      // Left click on empty square or enemy piece resets all active premoves
      this.clearPremoves()
      return false
    }
  }

  private updateDragPosition(clientX: number, clientY: number): void {
    if (!this.isDragging || !this.floatingPieceEl) return
    this.floatingPieceEl.style.left = `${clientX}px`
    this.floatingPieceEl.style.top = `${clientY}px`
  }

  private finishDragAt(elemBelow: Element | null, clientX?: number, clientY?: number): void {
    if (!this.isDragging) return

    const fromSq = this.dragFromSquare
    this.isDragging = false
    this.dragFromSquare = null

    if (this.floatingPieceEl) {
      this.floatingPieceEl.remove()
      this.floatingPieceEl = null
    }

    // Restore dimmed piece
    if (fromSq !== null) {
      const fromEl = this.boardEl.querySelector(
        `[data-square="${fromSq}"] .piece-wrapper`
      )
      if (fromEl) {
        fromEl.classList.remove('dragging')
      }
    }

    // Determine target square under drop position
    let targetSqEl = elemBelow?.closest('.chess-square') as HTMLElement | null

    // Geometric coordinate fallback if elementFromPoint didn't find a chess-square
    if (!targetSqEl && clientX !== undefined && clientY !== undefined) {
      const rect = this.boardEl.getBoundingClientRect()
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        const state = this.store.getState()
        const { width, height } = state.board
        const flipped = this.store.isFlipped()
        const col = Math.floor(((clientX - rect.left) / rect.width) * width)
        const row = Math.floor(((clientY - rect.top) / rect.height) * height)
        const clampedCol = Math.max(0, Math.min(width - 1, col))
        const clampedRow = Math.max(0, Math.min(height - 1, row))
        const toX = flipped ? width - 1 - clampedCol : clampedCol
        const toY = flipped ? height - 1 - clampedRow : clampedRow
        const toSq = toY * width + toX
        targetSqEl = this.boardEl.querySelector(`[data-square="${toSq}"]`) as HTMLElement | null
      }
    }

    if (this.isPremoveDrag) {
      this.isPremoveDrag = false
      if (targetSqEl && targetSqEl.dataset.square && fromSq !== null) {
        const toSq = parseInt(targetSqEl.dataset.square, 10)
        if (toSq !== fromSq) {
          const specPieces = this.getSpeculativePieces()
          const fromPiece = specPieces[fromSq] ?? this.store.getState().board.pieces[fromSq]
          const { width, height } = this.store.getState().board
          if (fromPiece && !isGeometricallyValidPremove(fromSq, toSq, fromPiece, width, height)) {
            this.premoveSelectedSq = null
            this.clearPremoveHintDots()
            this.render()
            return
          }
          let promo: PieceType | undefined
          if (fromPiece && fromPiece.type === 'pawn') {
            const { width, height } = this.store.getState().board
            const toY = Math.floor(toSq / width)
            const isPromoRank = fromPiece.color === 'white' ? toY === 0 : toY === height - 1
            if (isPromoRank) {
              promo = 'queen'
            }
          }
          this.premoveSelectedSq = null
          this.clearPremoveHintDots()
          this.addPremove({ from: fromSq, to: toSq, promotion: promo })
          return
        }
      }
      return
    }

    if (targetSqEl && targetSqEl.dataset.square && fromSq !== null) {
      const toSq = parseInt(targetSqEl.dataset.square, 10)
      if (toSq !== fromSq) {
        const validDests = this.store.getValidDestinationsFor(fromSq)
        if (validDests.includes(toSq)) {
          this.store.makeMove(fromSq, toSq)
          return
        }
      }
    }
  }

  private cancelDrag(): void {
    if (!this.isDragging) return
    this.isPremoveDrag = false
    this.clearPremoveHintDots()
    const fromSq = this.dragFromSquare
    this.isDragging = false
    this.dragFromSquare = null
    if (this.floatingPieceEl) {
      this.floatingPieceEl.remove()
      this.floatingPieceEl = null
    }
    if (fromSq !== null) {
      const fromEl = this.boardEl.querySelector(
        `[data-square="${fromSq}"] .piece-wrapper`
      )
      if (fromEl) {
        fromEl.classList.remove('dragging')
      }
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 2) {
      e.preventDefault()
      const from = this.getPlanningSquare(e.target)
      this.clearPremoves()
      this.planningFromSquare = from
      return
    }
    if (e.button !== 0) return
    this.clearPlanning()
    if (
      e.pointerType === 'touch' &&
      (this.isTouching || Date.now() - this.lastTouchEndTime < 500)
    ) {
      return
    }
    const target = (e.target as HTMLElement).closest('.chess-square') as HTMLElement | null
    if (!target) return

    const handled = this.processStartAt(target, e.clientX, e.clientY)
    if (handled && e.pointerId !== undefined) {
      try {
        if (target.hasPointerCapture && !target.hasPointerCapture(e.pointerId)) {
          target.setPointerCapture(e.pointerId)
        }
      } catch {
        // Ignore synthetic or unsupported pointer capture errors
      }
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch' && this.isTouching) return
    this.updateDragPosition(e.clientX, e.clientY)
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.button === 2) {
      const from = this.planningFromSquare
      const to = this.getPlanningSquare(e.target)
      this.planningFromSquare = null
      if (from === null || to === null) return
      e.preventDefault()
      if (from === to) {
        if (!this.planningHighlights.delete(to)) this.planningHighlights.add(to)
      } else {
        const key = `${from}:${to}`
        if (!this.planningArrows.delete(key)) this.planningArrows.set(key, { from, to })
      }
      this.renderPlanning()
      return
    }
    if (e.button !== 0) return
    if (
      e.pointerType === 'touch' &&
      (this.isTouching || Date.now() - this.lastTouchEndTime < 500)
    ) {
      return
    }
    if (e.pointerId !== undefined) {
      try {
        const target = e.target as HTMLElement | null
        if (target && target.hasPointerCapture && target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Ignore synthetic or unsupported pointer capture errors
      }
    }
    if (!this.isDragging) return
    let elemBelow: Element | null = null
    if (this.floatingPieceEl) {
      this.floatingPieceEl.style.display = 'none'
    }
    try {
      elemBelow = document.elementFromPoint(e.clientX, e.clientY)
    } catch {
      // Ignore
    }
    this.finishDragAt(elemBelow, e.clientX, e.clientY)
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return
    this.isTouching = true
    const touch = e.touches[0]
    const elem = document.elementFromPoint(touch.clientX, touch.clientY)
    const target =
      ((e.target as HTMLElement | null)?.closest('.chess-square') as HTMLElement | null) ??
      (elem?.closest('.chess-square') as HTMLElement | null)
    if (!target) return

    const handled = this.processStartAt(target, touch.clientX, touch.clientY)
    if (handled) {
      e.preventDefault()
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isDragging || e.touches.length === 0) return
    e.preventDefault()
    const touch = e.touches[0]
    this.updateDragPosition(touch.clientX, touch.clientY)
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.isDragging) {
      this.isTouching = false
      this.lastTouchEndTime = Date.now()
      return
    }
    e.preventDefault()
    this.isTouching = false
    this.lastTouchEndTime = Date.now()

    const touch = e.changedTouches[0] ?? e.touches[0]
    if (touch) {
      if (this.floatingPieceEl) {
        this.floatingPieceEl.style.display = 'none'
      }
      let elemBelow: Element | null = null
      try {
        elemBelow = document.elementFromPoint(touch.clientX, touch.clientY)
      } catch {
        // Ignore
      }
      this.finishDragAt(elemBelow, touch.clientX, touch.clientY)
    } else {
      this.cancelDrag()
    }
  }

  private handleTouchCancel(): void {
    this.isTouching = false
    this.lastTouchEndTime = Date.now()
    this.cancelDrag()
  }
}
