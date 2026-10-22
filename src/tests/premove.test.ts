import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { parseFEN } from '@/core';
import { solarAudio } from '@/audio/solar-audio';

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

  it('очередь из нескольких премувов сохраняется и подсвечивает все клетки на доске', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    // Add first premove: 2. Nf3 (62 -> 45)
    boardUI.addPremove({ from: 62, to: 45 });
    // Add second premove: 3. d4 (51 -> 35)
    boardUI.addPremove({ from: 51, to: 35 });

    const queue = store.getPremoves();
    expect(queue.length).toBe(2);
    expect(queue[0].from).toBe(62);
    expect(queue[0].to).toBe(45);
    expect(queue[1].from).toBe(51);
    expect(queue[1].to).toBe(35);

    // All from and to squares must be highlighted
    const sq62 = boardContainer.querySelector('[data-square="62"]');
    const sq45 = boardContainer.querySelector('[data-square="45"]');
    const sq51 = boardContainer.querySelector('[data-square="51"]');
    const sq35 = boardContainer.querySelector('[data-square="35"]');

    expect(sq62?.classList.contains('square-premove-from')).toBe(true);
    expect(sq45?.classList.contains('square-premove-to')).toBe(true);
    expect(sq51?.classList.contains('square-premove-from')).toBe(true);
    expect(sq35?.classList.contains('square-premove-to')).toBe(true);
  });

  it('последовательное исполнение очереди премувов в ответ на очередные ходы соперника', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    // Queue 2 premoves: 2. Nf3 (62 -> 45) and 3. d4 (51 -> 35)
    boardUI.addPremove({ from: 62, to: 45 });
    boardUI.addPremove({ from: 51, to: 35 });
    expect(store.getPremoves().length).toBe(2);

    // Black plays 1... e5 (12 -> 28)
    store.makeMove(12, 28);

    // First premove 2. Nf3 executed immediately!
    let history = store.getLiveState().history;
    expect(history.length).toBe(3);
    expect(history[2].from).toBe(62);
    expect(history[2].to).toBe(45);

    // Second premove 3. d4 remains in queue
    expect(store.getPremoves().length).toBe(1);
    expect(store.getPremoves()[0].from).toBe(51);
    expect(store.getPremoves()[0].to).toBe(35);

    // Black plays 2... Nc6 (1 -> 18)
    store.makeMove(1, 18);

    // Second premove 3. d4 executed immediately!
    history = store.getLiveState().history;
    expect(history.length).toBe(5);
    expect(history[4].from).toBe(51);
    expect(history[4].to).toBe(35);

    // Queue is empty and highlights are cleared
    expect(store.getPremoves().length).toBe(0);
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
  });

  it('взятие фигуры в чужой ход отображает точки ходов и скрывает их после фиксации', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    // White Knight on g1 (square 62): start drag or click
    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    expect(sq62).toBeTruthy();
    sq62.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));

    // Hint dots should appear on geometrically accessible squares (e.g. f3 sq 45 and h3 sq 47)
    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    const sq47 = boardContainer.querySelector('[data-square="47"]') as HTMLElement;
    expect(sq45.querySelector('.dest-hint, .move-hint-dot, .square-hint')).not.toBeNull();
    expect(sq47.querySelector('.dest-hint, .move-hint-dot, .square-hint')).not.toBeNull();

    // Finish click on square 45
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }));
    sq45.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 200 }));

    // Hint dots must be removed once premove is registered
    expect(boardContainer.querySelectorAll('.premove-hint').length).toBe(0);
    expect(store.getPremoves().length).toBe(1);
    expect(store.getPremoves()[0].from).toBe(62);
    expect(store.getPremoves()[0].to).toBe(45);
  });

  it('клик вне доски или ПКМ сбрасывает всю очередь премувов и снимает подсветку', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    boardUI.addPremove({ from: 62, to: 45 });
    boardUI.addPremove({ from: 51, to: 35 });
    expect(store.getPremoves().length).toBe(2);
    expect(boardContainer.querySelectorAll('.square-premove-from').length).toBe(2);

    // Clicking outside the board
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 999, clientY: 999 }));

    expect(store.getPremoves().length).toBe(0);
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
    outsideEl.remove();

    // Re-queue and test right-click (contextmenu)
    boardUI.addPremove({ from: 62, to: 45 });
    boardUI.addPremove({ from: 51, to: 35 });
    expect(store.getPremoves().length).toBe(2);

    const chessBoard = boardContainer.querySelector('.chess-board') as HTMLElement;
    chessBoard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(store.getPremoves().length).toBe(0);
    expect(boardContainer.querySelector('.square-premove-from')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();
  });

  it('фиксация премува вызывает процедурный звук solarAudio.playPremove', () => {
    const playSpy = vi.spyOn(solarAudio, 'playPremove');
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    boardUI.addPremove({ from: 62, to: 45 });
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it('при установке предхода фигура переносится на целевую клетку с подсветкой origin', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    expect(sq62.querySelector('.piece-wrapper')).toBeTruthy();

    boardUI.setPremove({ from: 62, to: 45 });

    const fromEl = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    expect(fromEl.classList.contains('square-premove-origin')).toBe(true);
    expect(fromEl.classList.contains('square-premove-from')).toBe(true);
    expect(fromEl.querySelector('.piece-wrapper')).toBeNull();

    const toEl = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(toEl.classList.contains('square-premove-to')).toBe(true);
    expect(toEl.querySelector('.piece-wrapper')).toBeTruthy();
  });

  it('геометрически невозможный ход фигуры отклоняется и не фиксируется в предход', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    boardUI.setPremove({ from: 36, to: 44 });

    expect(store.getPremove()).toBeNull();
    expect(store.getPremoves().length).toBe(0);
    expect(boardContainer.querySelector('.square-premove-origin')).toBeNull();
    expect(boardContainer.querySelector('.square-premove-to')).toBeNull();

    const sq36 = boardContainer.querySelector('[data-square="36"]') as HTMLElement;
    expect(sq36.querySelector('.piece-wrapper')).toBeTruthy();
  });

  it('отмена предхода правым кликом возвращает фигуру на исходную клетку', () => {
    store.makeMove(52, 36); // 1. e4
    expect(store.getState().turn).toBe('black');

    boardUI.setPremove({ from: 62, to: 45 });
    expect(store.getPremove()).toBeTruthy();

    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(sq62.querySelector('.piece-wrapper')).toBeNull();
    expect(sq45.querySelector('.piece-wrapper')).toBeTruthy();

    const chessBoard = boardContainer.querySelector('.chess-board') as HTMLElement;
    chessBoard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(store.getPremove()).toBeNull();
    const updatedSq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    const updatedSq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(updatedSq62.querySelector('.piece-wrapper')).toBeTruthy();
    expect(updatedSq45.querySelector('.piece-wrapper')).toBeNull();
    expect(updatedSq62.classList.contains('square-premove-origin')).toBe(false);
  });

  it('захват фигуры с поля премува и добавление второго шага в очередь цепочки', () => {
    store.makeMove(52, 36); // 1. e4 (Black's turn)
    expect(store.getState().turn).toBe('black');

    // Step 1: Premove White Knight from 62 (g1) to 45 (f3)
    boardUI.addPremove({ from: 62, to: 45 });
    expect(store.getPremoves().length).toBe(1);

    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(sq45.querySelector('.piece-wrapper')).toBeTruthy();

    // Step 2: Grab the Knight on its speculative destination square 45 and chain to 28 (e5)
    sq45.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));

    // Hint dots should appear for the speculative position (including 28)
    const hintDots = boardContainer.querySelectorAll('.move-hint-dot, .dest-hint');
    expect(hintDots.length).toBeGreaterThan(0);

    // Click square 28 (e5) to commit second premove
    const sq28 = boardContainer.querySelector('[data-square="28"]') as HTMLElement;
    sq28.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));

    const queue = store.getPremoves();
    expect(queue.length).toBe(2);
    expect(queue[0]).toEqual({ from: 62, to: 45, promotion: undefined });
    expect(queue[1]).toEqual({ from: 45, to: 28, promotion: undefined });

    // The piece is now visually located at square 28
    const updatedSq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    const updatedSq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    const updatedSq28 = boardContainer.querySelector('[data-square="28"]') as HTMLElement;

    expect(updatedSq62.querySelector('.piece-wrapper')).toBeNull();
    expect(updatedSq45.querySelector('.piece-wrapper')).toBeNull();
    expect(updatedSq28.querySelector('.piece-wrapper')).toBeTruthy();

    // Both previous squares have origin highlight, final has to highlight
    expect(updatedSq62.classList.contains('square-premove-origin')).toBe(true);
    expect(updatedSq45.classList.contains('square-premove-origin')).toBe(true);
    expect(updatedSq28.classList.contains('square-premove-to')).toBe(true);
  });

  it('полный откат фигуры на исходное поле при отмене цепочки премувов правым кликом', () => {
    store.makeMove(52, 36); // 1. e4 (Black's turn)
    expect(store.getState().turn).toBe('black');

    boardUI.addPremove({ from: 62, to: 45 });
    boardUI.addPremove({ from: 45, to: 28 });
    expect(store.getPremoves().length).toBe(2);

    const chessBoard = boardContainer.querySelector('.chess-board') as HTMLElement;
    chessBoard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(store.getPremoves().length).toBe(0);
    expect(store.getPremove()).toBeNull();

    const sq62 = boardContainer.querySelector('[data-square="62"]') as HTMLElement;
    const sq45 = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    const sq28 = boardContainer.querySelector('[data-square="28"]') as HTMLElement;

    // Piece is restored on original square 62
    expect(sq62.querySelector('.piece-wrapper')).toBeTruthy();
    expect(sq45.querySelector('.piece-wrapper')).toBeNull();
    expect(sq28.querySelector('.piece-wrapper')).toBeNull();

    // All premove highlights cleared
    expect(sq62.classList.contains('square-premove-origin')).toBe(false);
    expect(sq45.classList.contains('square-premove-origin')).toBe(false);
    expect(sq28.classList.contains('square-premove-to')).toBe(false);
  });
});

