import { ChessStore } from '../state/store';
import { getPieceSvg } from './pieces';
import type { PieceType, Square } from '@/core';

export class ChessBoardUI {
  private container: HTMLElement;
  private store: ChessStore;
  private boardEl: HTMLElement;
  private promoOverlayEl: HTMLElement;
  private evalBarWrapperEl: HTMLElement;
  private evalBarFillEl: HTMLElement;
  private evalBarTextEl: HTMLElement;
  private arrowLayerEl: SVGElement;

  // Drag state
  private isDragging = false;
  private dragFromSquare: Square | null = null;
  private floatingPieceEl: HTMLElement | null = null;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="board-area">
        <div class="eval-bar-wrapper" id="eval-bar-wrapper" style="display: none;">
          <div class="eval-bar-track">
            <div class="eval-bar-fill" id="eval-bar-fill"></div>
            <span class="eval-bar-text" id="eval-bar-text">50%</span>
          </div>
        </div>
        <div class="board-container">
          <div class="chess-board"></div>
          <svg class="board-arrow-layer" viewBox="0 0 800 800" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4;"></svg>
          <div class="promo-overlay" style="display: none;"></div>
        </div>
      </div>
    `;

    this.boardEl = this.container.querySelector('.chess-board') as HTMLElement;
    this.promoOverlayEl = this.container.querySelector('.promo-overlay') as HTMLElement;
    this.evalBarWrapperEl = this.container.querySelector('#eval-bar-wrapper') as HTMLElement;
    this.evalBarFillEl = this.container.querySelector('#eval-bar-fill') as HTMLElement;
    this.evalBarTextEl = this.container.querySelector('#eval-bar-text') as HTMLElement;
    this.arrowLayerEl = this.container.querySelector('.board-arrow-layer') as SVGElement;

    this.initEvents();
    this.store.subscribe(() => this.render());
  }

  private initEvents(): void {
    // Pointer down on board
    this.boardEl.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
  }

  private render(): void {
    const state = this.store.getState();
    const { width, height, pieces } = state.board;
    const flipped = this.store.isFlipped();
    const selectedSq = this.store.getSelectedSquare();
    const pendingPromo = this.store.getPendingPromotion();
    const validDests = selectedSq !== null ? this.store.getValidDestinationsFor(selectedSq) : [];
    const lastMove = this.store.getLastMove();
    const inCheck = this.store.isInCheck();
    const kingSq = inCheck ? this.store.getKingSquare() : null;

    // Set board CSS grid variable
    this.boardEl.style.setProperty('--board-width', width.toString());
    this.boardEl.style.setProperty('--board-height', height.toString());

    this.boardEl.innerHTML = '';

    // Render squares in display order
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const x = flipped ? width - 1 - c : c;
        const y = flipped ? height - 1 - r : r;
        const sq = y * width + x;
        const piece = pieces[sq];

        const isLight = (x + y) % 2 === 0;
        const isSelected = selectedSq === sq;
        const isLastMove = lastMove ? lastMove.from === sq || lastMove.to === sq : false;
        const isKingInCheck = kingSq === sq;
        const isDest = validDests.includes(sq);

        const sqEl = document.createElement('div');
        sqEl.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        sqEl.dataset.square = sq.toString();

        if (isSelected) sqEl.classList.add('selected');
        if (isLastMove) sqEl.classList.add('last-move');
        if (isKingInCheck) sqEl.classList.add('in-check');

        // Coordinate labels on edges
        const isRankEdge = flipped ? c === width - 1 : c === 0;
        const isFileEdge = flipped ? r === 0 : r === height - 1;

        if (isRankEdge) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-label rank';
          rankLabel.textContent = (height - y).toString();
          sqEl.appendChild(rankLabel);
        }

        if (isFileEdge) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-label file';
          fileLabel.textContent = String.fromCharCode(97 + x);
          sqEl.appendChild(fileLabel);
        }

        // Destination hints
        if (isDest) {
          const hint = document.createElement('div');
          hint.className = piece ? 'dest-capture-ring' : 'dest-hint';
          sqEl.appendChild(hint);
        }

        // Piece
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece-wrapper';
          pieceEl.innerHTML = getPieceSvg(piece.type, piece.color);
          sqEl.appendChild(pieceEl);
        }

        this.boardEl.appendChild(sqEl);
      }
    }

    // Render promotion dialog if needed
    if (pendingPromo) {
      this.renderPromotionModal(pendingPromo);
    } else {
      this.promoOverlayEl.style.display = 'none';
      this.promoOverlayEl.innerHTML = '';
    }

    this.renderEvalBar(flipped);
    this.renderBestMoveArrow(flipped);
  }

  private renderEvalBar(flipped: boolean): void {
    const review = this.store.getReviewResult();
    const isReviewActive = this.store.isReviewMode() || review !== null;
    if (!isReviewActive || !review || !review.evalHistory || review.evalHistory.length === 0) {
      this.evalBarWrapperEl.style.display = 'none';
      return;
    }

    this.evalBarWrapperEl.style.display = 'flex';
    const viewIdx = this.store.getViewIndex();
    let ply = 0;
    if (viewIdx === null) {
      ply = review.evalHistory.length - 1;
    } else if (viewIdx >= 0) {
      ply = Math.min(viewIdx + 1, review.evalHistory.length - 1);
    }

    const evalPoint = review.evalHistory[ply];
    if (!evalPoint) return;

    const whiteChance = Math.max(0, Math.min(100, evalPoint.whiteWinChance));
    const fillHeight = flipped ? 100 - whiteChance : whiteChance;
    this.evalBarFillEl.style.height = `${fillHeight}%`;

    if (evalPoint.score.type === 'mate') {
      this.evalBarTextEl.textContent = 'Мат';
    } else {
      this.evalBarTextEl.textContent = `${Math.round(whiteChance)}%`;
    }
  }

  private renderBestMoveArrow(flipped: boolean): void {
    if (!this.arrowLayerEl) return;
    this.arrowLayerEl.innerHTML = '';

    const review = this.store.getReviewResult();
    if (!review) return;

    const viewIndex = this.store.getViewIndex();
    if (viewIndex === null || viewIndex < 0 || viewIndex >= review.moves.length) {
      return;
    }

    const reviewedMove = review.moves[viewIndex];
    if (!reviewedMove || !reviewedMove.bestMove) return;

    const { width, height } = this.store.getState().board;
    const bestMove = reviewedMove.bestMove;

    const sqW = 800 / width;
    const sqH = 800 / height;

    const fromX = bestMove.from % width;
    const fromY = Math.floor(bestMove.from / width);
    const toX = bestMove.to % width;
    const toY = Math.floor(bestMove.to / width);

    const fromCol = flipped ? width - 1 - fromX : fromX;
    const fromRow = flipped ? height - 1 - fromY : fromY;
    const toCol = flipped ? width - 1 - toX : toX;
    const toRow = flipped ? height - 1 - toY : toY;

    const x1 = fromCol * sqW + sqW / 2;
    const y1 = fromRow * sqH + sqH / 2;
    const x2 = toCol * sqW + sqW / 2;
    const y2 = toRow * sqH + sqH / 2;

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const shorten = sqW * 0.22;
    const endX = x2 - Math.cos(angle) * shorten;
    const endY = y2 - Math.sin(angle) * shorten;

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
    `;
  }

  private renderPromotionModal(promo: { from: Square; to: Square }): void {
    const state = this.store.getState();
    const color = state.turn;
    const pieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

    this.promoOverlayEl.innerHTML = `
      <div class="promo-modal">
        <div class="promo-title">Выберите фигуру</div>
        <div class="promo-options"></div>
      </div>
    `;

    const optionsContainer = this.promoOverlayEl.querySelector('.promo-options') as HTMLElement;
    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.innerHTML = getPieceSvg(p, color);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.makeMove(promo.from, promo.to, p);
      });
      optionsContainer.appendChild(btn);
    }

    this.promoOverlayEl.style.display = 'flex';
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.store.getPendingPromotion()) return;
    if (!this.store.isPlayerTurn() || this.store.isAIThinking()) return;
    const target = (e.target as HTMLElement).closest('.chess-square') as HTMLElement | null;
    if (!target || !target.dataset.square) return;

    const sq = parseInt(target.dataset.square, 10);
    const piece = this.store.getState().board.pieces[sq];
    const turn = this.store.getState().turn;
    const selectedSq = this.store.getSelectedSquare();

    // If we already had a square selected and clicked on another square
    if (selectedSq !== null) {
      // If clicking on one of legal destinations
      const validDests = this.store.getValidDestinationsFor(selectedSq);
      if (validDests.includes(sq)) {
        this.store.makeMove(selectedSq, sq);
        return;
      }

      // If clicking back on the same square -> deselect
      if (selectedSq === sq) {
        this.store.selectSquare(null);
        return;
      }
    }

    // Clicked on a piece of current turn -> select & prepare drag
    if (piece && piece.color === turn) {
      this.store.selectSquare(sq);

      // Start drag
      this.isDragging = true;
      this.dragFromSquare = sq;

      // Dim original piece
      const pieceWrapper = target.querySelector('.piece-wrapper') as HTMLElement | null;
      if (pieceWrapper) {
        pieceWrapper.classList.add('dragging');
      }

      // Create floating element
      this.floatingPieceEl = document.createElement('div');
      this.floatingPieceEl.className = 'floating-drag-piece';
      this.floatingPieceEl.innerHTML = getPieceSvg(piece.type, piece.color);
      this.floatingPieceEl.style.left = `${e.clientX}px`;
      this.floatingPieceEl.style.top = `${e.clientY}px`;
      document.body.appendChild(this.floatingPieceEl);

      try {
        if (target.hasPointerCapture && !target.hasPointerCapture(e.pointerId)) {
          target.setPointerCapture(e.pointerId);
        }
      } catch {
        // Ignore synthetic or unsupported pointer capture errors
      }
    } else {
      // Clicked on empty space or enemy piece without active selection
      this.store.selectSquare(null);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDragging || !this.floatingPieceEl) return;
    this.floatingPieceEl.style.left = `${e.clientX}px`;
    this.floatingPieceEl.style.top = `${e.clientY}px`;
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    if (this.floatingPieceEl) {
      this.floatingPieceEl.remove();
      this.floatingPieceEl = null;
    }

    // Restore dimmed piece
    const fromEl = this.boardEl.querySelector(`[data-square="${this.dragFromSquare}"] .piece-wrapper`);
    if (fromEl) {
      fromEl.classList.remove('dragging');
    }

    // Determine target square under drop position
    const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
    const targetSqEl = elemBelow?.closest('.chess-square') as HTMLElement | null;

    if (targetSqEl && targetSqEl.dataset.square && this.dragFromSquare !== null) {
      const toSq = parseInt(targetSqEl.dataset.square, 10);
      if (toSq !== this.dragFromSquare) {
        const validDests = this.store.getValidDestinationsFor(this.dragFromSquare);
        if (validDests.includes(toSq)) {
          this.store.makeMove(this.dragFromSquare, toSq);
          this.dragFromSquare = null;
          return;
        }
      }
    }

    this.dragFromSquare = null;
  }
}
