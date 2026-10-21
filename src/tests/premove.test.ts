import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { parseFEN } from '@/core';

if (typeof globalThis.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = MockPointerEvent as unknown as typeof globalThis.PointerEvent;
}

describe('Stage 6a-3: Premove Mechanics (chess.com style)', () => {
  let store: ChessStore;
  let boardContainer: HTMLElement;
  let boardUI: ChessBoardUI;

  beforeEach(() => {
    document.body.innerHTML = '';
    boardContainer = document.createElement('div');
    boardContainer.id = 'board-mount';
    document.body.appendChild(boardContainer);

    store = new ChessStore();
    boardUI = new ChessBoardUI(boardContainer, store);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('во время хода противника установка предхода сохраняет pendingPremove и навешивает CSS-классы', () => {
    // 1. e4 (52 -> 36)
    store.makeMove(52, 36);
    expect(store.getState().turn).toBe('black');

    // Click White knight on g1 (square 62)
    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    expect(sq62).toBeTruthy();
    sq62.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }));

    // Click destination square f3 (square 45)
    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(sq45).toBeTruthy();
    sq45.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 200 }));

    // Verify pendingPremove is set in store
    const pm = store.getPremove();
    expect(pm).toBeTruthy();
    expect(pm?.from).toBe(62);
    expect(pm?.to).toBe(45);

    // Verify visual classes on board
    const fromEl = boardContainer.querySelector('[data-square="62"]');
    const toEl = boardContainer.querySelector('[data-square="45"]');
    expect(fromEl?.classList.contains('square-premove-from')).toBe(true);
    expect(toEl?.classList.contains('square-premove-to')).toBe(true);
  });

  it('правый клик (contextmenu) или clearPremove() очищает предход и снимает классы с доски', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    // Set premove 2. Nf3 (62 -> 45)
    boardUI.setPremove({ from: 62, to: 45 });
    expect(store.getPremove()).toBeTruthy();

    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(sq62?.classList.contains('square-premove-from')).toBe(true);
    expect(sq45?.classList.contains('square-premove-to')).toBe(true);

    // Right-click (contextmenu) on the board
    const chessBoard = boardContainer.querySelector('.chess-board') as HTMLElement;
    expect(chessBoard).toBeTruthy();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    chessBoard.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(store.getPremove()).toBeNull();
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();

    // Re-set premove and test clearPremove() method directly
    boardUI.setPremove({ from: 62, to: 45 });
    expect(store.getPremove()).toBeTruthy();
    boardUI.clearPremove();
    expect(store.getPremove()).toBeNull();
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
  });

  it('успешное немедленное применение легального предхода после хода противника', () => {
    // 1. e4 (52 -> 36)
    store.makeMove(52, 36);
    expect(store.getState().turn).toBe('black');

    // White premoves 2. Nf3 (62 -> 45)
    boardUI.setPremove({ from: 62, to: 45 });
    expect(store.getPremove()).toBeTruthy();

    // Black plays 1... e5 (12 -> 28)
    store.makeMove(12, 28);

    // The premove 2. Nf3 should execute immediately with 0ms delay!
    const history = store.getLiveState().history;
    expect(history.length).toBe(3);
    expect(history[0].from).toBe(52); // 1. e4
    expect(history[0].to).toBe(36);
    expect(history[1].from).toBe(12); // 1... e5
    expect(history[1].to).toBe(28);
    expect(history[2].from).toBe(62); // 2. Nf3 (premove executed!)
    expect(history[2].to).toBe(45);

    // Premove state and highlights must be cleared after execution
    expect(store.getPremove()).toBeNull();
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
    expect(store.getState().turn).toBe('black');
  });

  it('корректный сброс нелегального предхода после хода противника без падения приложения', () => {
    // 1. e4 (52 -> 36)
    store.makeMove(52, 36);
    expect(store.getState().turn).toBe('black');

    // White premoves an illegal pawn push: 2. e5 (36 -> 28)
    // (If Black plays 1... e5 to square 28, White cannot push pawn into an occupied square)
    boardUI.setPremove({ from: 36, to: 28 });
    expect(store.getPremove()).toBeTruthy();

    // Black plays 1... e5 (12 -> 28), occupying square 28
    store.makeMove(12, 28);

    // Premove 36 -> 28 is now illegal! It must be safely cleared without executing or crashing
    const history = store.getLiveState().history;
    expect(history.length).toBe(2);
    expect(history[1].from).toBe(12);
    expect(history[1].to).toBe(28);

    // Premove state must be cleaned up and board awaits normal move from White
    expect(store.getPremove()).toBeNull();
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
    expect(store.getState().turn).toBe('white');
  });

  it('drag-and-drop во время хода противника успешно регистрирует предход с авто-ферзем', () => {
    // Position where White pawn is on a7 (square 8) and Black to move
    // 8/P7/8/8/8/8/8/k6K b - - 0 1
    const customState = parseFEN('8/P7/8/8/8/8/8/k6K b - - 0 1');
    store.newGame(customState);
    expect(store.getState().turn).toBe('black');

    const sq8 = boardContainer.querySelector('[data-square="8"]') as HTMLElement;
    const sq0 = boardContainer.querySelector('[data-square="0"]') as HTMLElement;
    expect(sq8).toBeTruthy();
    expect(sq0).toBeTruthy();

    // Start drag on square 8
    sq8.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 100 }));

    // Mock elementFromPoint to return square 0 (a8 promotion square)
    const origElementFromPoint = document.elementFromPoint;
    try {
      document.elementFromPoint = () => sq0;
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 20 }));
    } finally {
      document.elementFromPoint = origElementFromPoint;
    }

    const pm = store.getPremove();
    expect(pm).toBeTruthy();
    expect(pm?.from).toBe(8);
    expect(pm?.to).toBe(0);
    expect(pm?.promotion).toBe('queen');

    const fromEl = boardContainer.querySelector('[data-square="8"]');
    const toEl = boardContainer.querySelector('[data-square="0"]');
    expect(fromEl?.classList.contains('square-premove-from')).toBe(true);
    expect(toEl?.classList.contains('square-premove-to')).toBe(true);
  });

  it('клик по пустой клетке отменяет ранее установленный предход', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    boardUI.setPremove({ from: 62, to: 45 });
    expect(store.getPremove()).toBeTruthy();

    // Click on empty square e3 (square 44)
    const sq44 = boardContainer.querySelector('[data-square="44"]') as HTMLElement;
    expect(sq44).toBeTruthy();
    sq44.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }));

    expect(store.getPremove()).toBeNull();
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
  });
});

