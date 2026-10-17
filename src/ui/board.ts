import { ChessStore } from '../state/store';
import { getPieceSvg } from './pieces';
import type { PieceType, Square } from '@/core';

export class ChessBoardUI {
  private container: HTMLElement;
  private store: ChessStore;
  private boardEl: HTMLElement;
  private promoOverlayEl: HTMLElement;

  // Drag state
  private isDragging = false;
  private dragFromSquare: Square | null = null;
  private floatingPieceEl: HTMLElement | null = null;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="board-container">
        <div class="chess-board"></div>
        <div class="promo-overlay" style="display: none;"></div>
      </div>
    `;

    this.boardEl = this.container.querySelector('.chess-board') as HTMLElement;
    this.promoOverlayEl = this.container.querySelector('.promo-overlay') as HTMLElement;

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
