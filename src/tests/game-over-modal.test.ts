import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore } from '@/state/store';
import { GameOverModalUI } from '@/ui/gameovermodal';
import { parseFEN } from '@/core';
import type { ReviewRunResult } from '@/analysis';

describe('GameOverModalUI', () => {
  let store: ChessStore;
  let container: HTMLElement;
  let modal: GameOverModalUI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    store = new ChessStore();
  });

  afterEach(() => {
    modal?.destroy();
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows modal on checkmate with title, reason, moves and material', () => {
    modal = new GameOverModalUI(container, store);

    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    expect(modal.isOpen()).toBe(false);

    store.makeMove(d8, h4); // Checkmate!
    expect(modal.isOpen()).toBe(true);

    const titleEl = container.querySelector('#game-over-title');
    const reasonEl = container.querySelector('#game-over-reason');
    const movesEl = container.querySelector('#game-over-moves');
    const materialEl = container.querySelector('#game-over-material');

    expect(titleEl?.textContent).toBe('Мат. Победили чёрные');
    expect(reasonEl?.textContent).toBe('Король белых атакован и не имеет защиты');
    expect(movesEl?.textContent).toContain('2');
    expect(movesEl?.textContent).toContain('полуходов: 4');
    expect(materialEl?.textContent).toContain('Белые: −0 очков');
  });

  it('shows modal on stalemate with draw title and reason', () => {
    // White to move: Qg1 to Qg6 results in stalemate
    const preStalemateFen = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';
    store.newGame(parseFEN(preStalemateFen));
    modal = new GameOverModalUI(container, store);

    const g1 = store.coordsToSquare(6, 7);
    const g6 = store.coordsToSquare(6, 2);

    store.makeMove(g1, g6);
    expect(store.getGameResult().type).toBe('stalemate');
    expect(modal.isOpen()).toBe(true);

    const titleEl = container.querySelector('#game-over-title');
    const reasonEl = container.querySelector('#game-over-reason');

    expect(titleEl?.textContent).toBe('Ничья: пат');
    expect(reasonEl?.textContent).toBe('У стороны нет возможных ходов, и король не находится под шахом');
  });

  it('shows modal on clock timeout with winner title and reason', () => {
    modal = new GameOverModalUI(container, store);
    store.setClockMode('bullet-1-0');

    // Make 1 move to start the clock
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    store.makeMove(e2, e4);

    expect(store.isClockActive()).toBe(true);
    expect(modal.isOpen()).toBe(false);

    // Fast-forward time past Black's clock (60s)
    const nowSpy = vi.spyOn(Date, 'now');
    const startTime = Date.now();
    nowSpy.mockReturnValue(startTime + 65_000);

    store.tickClock();
    expect(store.getTimedOutLoser()).toBe('black');
    expect(modal.isOpen()).toBe(true);

    const titleEl = container.querySelector('#game-over-title');
    const reasonEl = container.querySelector('#game-over-reason');

    expect(titleEl?.textContent).toBe('Время чёрных истекло. Победили белые');
    expect(reasonEl?.textContent).toBe('У чёрных закончилось время на обдумывание');
  });

  it('does not show modal when loading completed FEN or PGN', () => {
    modal = new GameOverModalUI(container, store);

    // Ended FEN (Fool's mate position)
    const mateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    store.loadFEN(mateFen);
    expect(store.getGameResult().type).toBe('checkmate');
    expect(modal.isOpen()).toBe(false);

    // Ended PGN
    const pgn = `[Event "Opera Game"]
[Site "Paris"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
    store.loadPGN(pgn);
    expect(store.getGameResult().type).toBe('checkmate');
    expect(modal.isOpen()).toBe(false);
  });

  it('does not show modal while viewing history or in review mode', () => {
    modal = new GameOverModalUI(container, store);

    // Play to checkmate
    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    store.makeMove(d8, h4);
    expect(modal.isOpen()).toBe(true);

    // Step back into history -> modal should hide
    store.setViewIndex(1);
    expect(store.isViewingHistory()).toBe(true);
    expect(modal.isOpen()).toBe(false);

    // Return to live move -> modal should re-open
    store.setViewIndex(null);
    expect(store.isViewingHistory()).toBe(false);
    expect(modal.isOpen()).toBe(true);

    // Enter review mode -> modal should hide
    store.setReviewMode(true);
    expect(modal.isOpen()).toBe(false);
  });

  it('shows prominent AI verdict banner for win, loss, and draw', () => {
    modal = new GameOverModalUI(container, store);

    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);

    // 1. Player is Black, Black delivers Qh4# -> "Вы выиграли"
    store.configureGame({ mode: 'ai', playerColor: 'black' });
    store.makeMove(d8, h4);

    expect(modal.isOpen()).toBe(true);
    const verdictEl = container.querySelector('#game-over-verdict');
    expect(verdictEl?.textContent).toBe('Вы выиграли');
    expect(verdictEl?.classList.contains('verdict-win')).toBe(true);

    // 2. Player was White (Fool's mate victim) -> "Вы проиграли"
    store.configureGame({ mode: 'ai', playerColor: 'white' });
    modal.renderContent();
    expect(verdictEl?.textContent).toBe('Вы проиграли');
    expect(verdictEl?.classList.contains('verdict-loss')).toBe(true);

    // 3. Stalemate -> "Ничья"
    store.newGame(parseFEN('7k/5K2/8/8/8/8/8/6Q1 w - - 0 1'), { mode: 'ai', playerColor: 'white' });
    const g1 = store.coordsToSquare(6, 7);
    const g6 = store.coordsToSquare(6, 2);
    store.makeMove(g1, g6);

    expect(modal.isOpen()).toBe(true);
    expect(verdictEl?.textContent).toBe('Ничья');
    expect(verdictEl?.classList.contains('verdict-draw')).toBe(true);
  });

  it('undo closes modal and completing game again shows modal', () => {
    modal = new GameOverModalUI(container, store);

    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    store.makeMove(d8, h4); // Mate

    expect(modal.isOpen()).toBe(true);

    // Undo move -> modal must hide
    store.undo();
    expect(store.getGameResult().type).toBe('ongoing');
    expect(modal.isOpen()).toBe(false);

    // Deliver mate again -> modal must show again
    store.makeMove(d8, h4);
    expect(store.getGameResult().type).toBe('checkmate');
    expect(modal.isOpen()).toBe(true);
  });

  it('closing modal preserves summary button and reopening works', () => {
    modal = new GameOverModalUI(container, store);

    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    store.makeMove(d8, h4);

    expect(modal.isOpen()).toBe(true);

    // Close via close button
    const closeBtn = container.querySelector('#game-over-close-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(modal.isOpen()).toBe(false);
    expect(store.isGameOverModalDismissed()).toBe(true);

    // Reopen using modal.show()
    modal.show();
    expect(modal.isOpen()).toBe(true);

    // Close via Escape key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.isOpen()).toBe(false);
  });

  it('review button and new game button trigger their actions', () => {
    const onStartReview = vi.fn();
    const onNewGame = vi.fn();

    modal = new GameOverModalUI(container, store, { onStartReview, onNewGame });

    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    store.makeMove(d8, h4);

    expect(modal.isOpen()).toBe(true);

    const reviewBtn = container.querySelector('#btn-modal-review') as HTMLButtonElement;
    reviewBtn.click();
    expect(onStartReview).toHaveBeenCalledTimes(1);
    expect(modal.isOpen()).toBe(false);

    // Reopen and test new game button
    modal.show();
    expect(modal.isOpen()).toBe(true);

    const newGameBtn = container.querySelector('#btn-modal-new-game') as HTMLButtonElement;
    newGameBtn.click();
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(modal.isOpen()).toBe(false);
  });

  it('shows review placeholder initially and review stats when present', () => {
    modal = new GameOverModalUI(container, store);

    const f2 = store.coordsToSquare(5, 6);
    const f3 = store.coordsToSquare(5, 5);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    const g2 = store.coordsToSquare(6, 6);
    const g4 = store.coordsToSquare(6, 4);
    const d8 = store.coordsToSquare(3, 0);
    const h4 = store.coordsToSquare(7, 4);

    store.makeMove(f2, f3);
    store.makeMove(e7, e5);
    store.makeMove(g2, g4);
    store.makeMove(d8, h4);

    const reviewSummary = container.querySelector('#game-over-review-summary');
    expect(reviewSummary?.textContent).toContain('Разбор партии покажет точность и ключевые моменты');

    // Simulate review completion
    const mockReview: ReviewRunResult = {
      moves: [],
      accuracy: { white: 84.5, black: 97.2 },
      counts: {
        white: { best: 1, excellent: 0, good: 0, inaccuracy: 1, mistake: 1, blunder: 1 },
        black: { best: 2, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      },
      keyMoments: [],
      evalHistory: [],
      engineName: 'Stockfish 16',
      reanalyzed: 0,
    };
    store.setReviewResult(mockReview);

    expect(reviewSummary?.textContent).toContain('84.5%');
    expect(reviewSummary?.textContent).toContain('97.2%');
    expect(reviewSummary?.textContent).toContain('неточностей: 1');
    expect(reviewSummary?.textContent).toContain('ошибок: 1');
    expect(reviewSummary?.textContent).toContain('зевков: 1');
  });

  it('has accessible dialog attributes, focus trap and returns focus', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Trigger';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    modal = new GameOverModalUI(container, store);

    const dialog = container.querySelector('.game-over-dialog');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('game-over-title');

    modal.show();

    // Focus trap: pressing Tab cycles through focusable elements
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(tabEvent);
    expect(document.activeElement).toBe(first);

    // Closing modal restores focus
    modal.hide();
    expect(document.activeElement).toBe(triggerBtn);
  });
});
