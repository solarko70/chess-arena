import { ChessStore, type Premove } from '../state/store'
import { getPieceSvg } from './pieces'
import { getMoveClassMeta, winChance } from '@/analysis'
import { solarAudio } from '@/audio/solar-audio'
import { generatePseudoLegal, type Piece, type PieceType, type Square } from '@/core'

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
  private lastHistoryLength = 0
  private lastVariationId: string | null = null

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

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container
    this.store = store
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
          <div class="board-badge-layer" aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; z-index: 5;"></div>
          <svg class="board-arrow-layer" viewBox="0 0 800 800" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4;"></svg>
          <div class="promo-overlay" style="display: none;"></div>
        </div>
      </div>
    `

    this.boardEl = this.container.querySelector('.chess-board') as HTMLElement
    this.promoOverlayEl = this.container.querySelector('.promo-overlay') as HTMLElement
    this.evalBarWrapperEl = this.container.querySelector('#eval-bar-wrapper') as HTMLElement
    this.evalBarFillEl = this.container.querySelector('#eval-bar-fill') as HTMLElement
    this.evalBarTextEl = this.container.querySelector('#eval-bar-text') as HTMLElement
    this.arrowLayerEl = this.container.querySelector('.board-arrow-layer') as SVGElement
    this.badgeLayerEl = this.container.querySelector('.board-badge-layer') as HTMLElement

    this.initEvents()
    this.store.subscribe(() => this.render())
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

  public setPremove(premove: Premove | null): void {
    if (premove) {
      this.store.setPremove(premove)
      solarAudio.playPremove()
    } else {
      this.clearPremoves()
    }
    this.updatePremoveClasses()
  }

  public addPremove(premove: Premove): void {
    this.store.addPremove(premove)
    solarAudio.playPremove()
    this.updatePremoveClasses()
  }

  public clearPremoves(): void {
    this.premoveSelectedSq = null
    this.clearPremoveHintDots()
    this.store.clearPremoves()
    this.updatePremoveClasses()
  }

  public clearPremove(): void {
    this.clearPremoves()
  }

  private renderPremoveHintDots(fromSq: Square): void {
    this.clearPremoveHintDots()
    const state = this.store.getState()
    const piece = state.board.pieces[fromSq]
    if (!piece) return

    const tempState = {
      ...state,
      turn: piece.color,
    }

    try {
      const pseudoMoves = generatePseudoLegal(tempState).filter((m) => m.from === fromSq)
      const destSquares = Array.from(new Set(pseudoMoves.map((m) => m.to)))

      for (const destSq of destSquares) {
        const targetSqEl = this.boardEl.querySelector(`[data-square="${destSq}"]`)
        if (targetSqEl && !targetSqEl.querySelector('.dest-hint, .dest-capture-ring, .move-hint-dot')) {
          const targetPiece = state.board.pieces[destSq]
          const hint = document.createElement('div')
          hint.className = targetPiece
            ? 'dest-capture-ring square-hint premove-hint'
            : 'dest-hint move-hint-dot square-hint premove-hint'
          targetSqEl.appendChild(hint)
        }
      }
    } catch {
      // Safe fallback if move generator encounters unexpected board state
    }
  }

  private clearPremoveHintDots(): void {
    const hints = this.boardEl.querySelectorAll('.premove-hint')
    hints.forEach((el) => el.remove())
  }

  private updatePremoveClasses(): void {
    const prevSquares = this.boardEl.querySelectorAll('.square-premove-from, .square-premove-to')
    prevSquares.forEach((el) => {
      el.classList.remove('square-premove-from', 'square-premove-to')
    })
    const premoves = this.store.getPremoves()
    for (const pm of premoves) {
      const fromEl = this.boardEl.querySelector(`[data-square="${pm.from}"]`)
      const toEl = this.boardEl.querySelector(`[data-square="${pm.to}"]`)
      fromEl?.classList.add('square-premove-from')
      toEl?.classList.add('square-premove-to')
    }
  }

  private render(): void {
    const liveState = this.store.getLiveState()
    const historyLen = liveState.history.length
    const isReview = this.store.isReviewMode()
    const isViewingHistory = this.store.isViewingHistory()

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

    // Clean up any active solar wings before re-rendering
    if (this.currentWingsMountEl) {
      this.currentWingsMountEl.remove()
      this.currentWingsMountEl = null
    }
    if (this.wingsTimer) {
      clearTimeout(this.wingsTimer)
      this.wingsTimer = null
    }

    const state = this.store.getState()
    const { width, height, pieces } = state.board
    const flipped = this.store.isFlipped()
    const selectedSq = this.store.getSelectedSquare()
    const pendingPromo = this.store.getPendingPromotion()
    const validDests = selectedSq !== null ? this.store.getValidDestinationsFor(selectedSq) : []
    const lastMove = this.store.getLastMove()
    const inCheck = this.store.isInCheck()
    const kingSq = inCheck ? this.store.getKingSquare() : null
    const premoves = this.store.getPremoves()

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

        if (isSelected) sqEl.classList.add('selected')
        if (isLastMove) sqEl.classList.add('last-move')
        if (isKingInCheck) sqEl.classList.add('in-check')
        if (isPremoveFrom) sqEl.classList.add('square-premove-from')
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
    height: number
  ): void {
    const targetSqEl = this.boardEl.querySelector(`[data-square="${toSq}"]`) as HTMLElement | null
    if (!targetSqEl) return

    const pieceEl = targetSqEl.querySelector('.piece-wrapper') as HTMLElement | null
    if (!pieceEl) return

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
    pieceEl.style.transform = `translate(${dx}, ${dy})`

    // Force reflow
    void pieceEl.offsetHeight

    // Play phase (FLIP)
    pieceEl.classList.add('piece-sliding')
    pieceEl.style.transition = ''
    pieceEl.style.transform = 'translate(0px, 0px)'

    const cleanup = () => {
      pieceEl.classList.remove('piece-sliding')
      pieceEl.style.transform = ''
      pieceEl.removeEventListener('transitionend', cleanup)
    }
    pieceEl.addEventListener('transitionend', cleanup)
  }

  private renderSolarWings(): void {
    const isReview = this.store.isReviewMode()
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
    wingsMount.className = 'stellar-wings-mount'
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

    const activeVar = this.store.getActiveVariationNode()
    if (activeVar) {
      const toSquare = activeVar.move.to
      const moveClass = activeVar.class ?? 'best'
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
      badgeEl.className = `board-move-badge badge-${moveClass}`
      badgeEl.dataset.class = moveClass
      badgeEl.dataset.square = toSquare.toString()
      badgeEl.title = meta.nameRu
      badgeEl.innerHTML = meta.svg

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
    badgeEl.className = `board-move-badge badge-${moveClass}`
    badgeEl.dataset.class = moveClass
    badgeEl.dataset.square = toSquare.toString()
    badgeEl.title = meta.nameRu
    badgeEl.innerHTML = meta.svg

    slotEl.appendChild(badgeEl)
    this.badgeLayerEl.appendChild(slotEl)
  }

  private renderEvalBar(flipped: boolean): void {
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

    let bestMove = activeVar?.bestMove ?? null
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
    } else if (this.store.isGameOver() || this.store.isViewingHistory()) {
      return false
    }
    if (!target || !target.dataset.square) return false

    const sq = parseInt(target.dataset.square, 10)
    const state = this.store.getState()
    const piece = state.board.pieces[sq]
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
      const fromPiece = pieces[fromSq]
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
          const fromPiece = this.store.getState().board.pieces[fromSq]
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
