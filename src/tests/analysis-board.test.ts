import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalysisBoardUI, mountAnalysisBoard } from '@/ui/analysis-board';
import { serializeFEN } from '@/core';

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

describe('Stage 6b: Analysis Board & Board Editor', () => {
  let container: HTMLElement;
  let analysisUI: AnalysisBoardUI;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'screen-analysis';
    document.body.appendChild(container);
    analysisUI = mountAnalysisBoard(container);
  });

  afterEach(() => {
    analysisUI.destroy();
    document.body.innerHTML = '';
  });

  it('монтирование экрана анализа и корректное отображение элементов доски, FEN и PGN', () => {
    expect(container.querySelector('#analysis-board-mount')).toBeTruthy();
    expect(container.querySelector('#analysis-fen-input')).toBeTruthy();
    expect(container.querySelector('#analysis-pgn-input')).toBeTruthy();
    expect(container.querySelector('#btn-analysis-back-to-main')).toBeTruthy();
    expect(container.querySelector('#btn-analysis-flip')).toBeTruthy();
    expect(container.querySelector('#btn-board-editor')).toBeTruthy();

    const fenInput = container.querySelector('#analysis-fen-input') as HTMLInputElement;
    expect(fenInput.value).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('свободное выполнение ходов на доске анализа обновляет FEN, PGN и историю ходов', () => {
    const store = analysisUI.getStore();

    // 1. e4 (52 -> 36)
    store.makeMove(52, 36);
    expect(store.getState().turn).toBe('black');

    const fenInput = container.querySelector('#analysis-fen-input') as HTMLInputElement;
    expect(fenInput.value).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');

    // 1... e5 (12 -> 28)
    store.makeMove(12, 28);
    expect(store.getState().turn).toBe('white');

    const movesContainer = container.querySelector('#analysis-moves-container');
    expect(movesContainer?.textContent).toContain('e4');
    expect(movesContainer?.textContent).toContain('e5');

    const pgnInput = container.querySelector('#analysis-pgn-input') as HTMLTextAreaElement;
    expect(pgnInput.value).toContain('1. e4 e5');
  });

  it('кнопки навигации по истории ходов корректно переключают позицию на доске анализа', () => {
    const store = analysisUI.getStore();
    store.makeMove(52, 36); // 1. e4
    store.makeMove(12, 28); // 1... e5
    store.makeMove(62, 45); // 2. Nf3

    const btnPrev = container.querySelector('#btn-nav-prev') as HTMLButtonElement;
    const btnNext = container.querySelector('#btn-nav-next') as HTMLButtonElement;
    const btnStart = container.querySelector('#btn-nav-start') as HTMLButtonElement;
    const btnEnd = container.querySelector('#btn-nav-end') as HTMLButtonElement;

    expect(btnPrev).toBeTruthy();
    expect(btnNext).toBeTruthy();

    // Navigate backward
    btnPrev.click();
    expect(store.getViewIndex()).toBe(1); // after 1... e5

    btnPrev.click();
    expect(store.getViewIndex()).toBe(0); // after 1. e4

    // Navigate to start
    btnStart.click();
    expect(store.getViewIndex()).toBe(-1); // initial position

    // Navigate forward
    btnNext.click();
    expect(store.getViewIndex()).toBe(0);

    // Navigate to end
    btnEnd.click();
    expect(store.getViewIndex()).toBeNull(); // latest position
  });

  it('загрузка валидного FEN обновляет позицию на доске, а невалидный FEN выводит ошибку', () => {
    const fenInput = container.querySelector('#analysis-fen-input') as HTMLInputElement;
    const loadFenBtn = container.querySelector('#btn-load-fen') as HTMLButtonElement;
    const errorEl = container.querySelector('#analysis-fen-error') as HTMLElement;

    // 1. Invalid FEN: missing black king
    fenInput.value = '8/8/8/8/8/8/8/4K3 w - - 0 1';
    loadFenBtn.click();
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('король');

    // 2. Invalid syntax
    fenInput.value = 'invalid-chess-fen-string';
    loadFenBtn.click();
    expect(errorEl.style.display).toBe('block');

    // 3. Valid custom endgame FEN: White king on e1, Black king on e8, White pawn on e2
    const validCustomFEN = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    fenInput.value = validCustomFEN;
    loadFenBtn.click();

    expect(errorEl.style.display).toBe('none');
    const state = analysisUI.getStore().getState();
    expect(serializeFEN(state)).toContain('4k3/8/8/8/8/8/4P3/4K3');
  });

  it('импорт PGN партии успешно восстанавливает цепочку ходов на доске анализа', () => {
    const pgnInput = container.querySelector('#analysis-pgn-input') as HTMLTextAreaElement;
    const loadPgnBtn = container.querySelector('#btn-load-pgn') as HTMLButtonElement;

    // Simple 2-move PGN
    pgnInput.value = '1. e4 e5 2. Nf3 Nc6';
    loadPgnBtn.click();

    const liveState = analysisUI.getStore().getLiveState();
    expect(liveState.history.length).toBe(4);
    expect(liveState.history[0].from).toBe(52); // e4
    expect(liveState.history[0].to).toBe(36);
    expect(liveState.history[1].from).toBe(12); // e5
    expect(liveState.history[1].to).toBe(28);

    const movesContainer = container.querySelector('#analysis-moves-container');
    expect(movesContainer?.textContent).toContain('Nc6');
  });

  it('открытие редактора расстановки, очистка доски и расстановка фигур кистью', () => {
    const editorBtn = container.querySelector('#btn-board-editor') as HTMLButtonElement;
    const overlay = container.querySelector('#analysis-editor-overlay') as HTMLElement;
    expect(overlay.style.display).toBe('none');

    // Open editor
    editorBtn.click();
    expect(overlay.style.display).toBe('flex');

    // Clear board
    const clearBtn = container.querySelector('#btn-editor-clear') as HTMLButtonElement;
    clearBtn.click();

    // Check all squares on editor board are empty
    const editorSquares = container.querySelectorAll('.editor-board .chess-square');
    expect(editorSquares.length).toBe(64);
    expect(container.querySelectorAll('.editor-board .piece-wrapper').length).toBe(0);

    // Select White Queen from palette
    const whiteQueenBtn = container.querySelector('.palette-piece[data-color="white"][data-type="queen"]') as HTMLElement;
    expect(whiteQueenBtn).toBeTruthy();
    whiteQueenBtn.click();
    expect(whiteQueenBtn.classList.contains('active')).toBe(true);

    // Click on e4 square (index 36) to place queen
    const sq36 = container.querySelector('.editor-board [data-square="36"]') as HTMLElement;
    expect(sq36).toBeTruthy();
    sq36.click();

    const updatedSq36 = container.querySelector('.editor-board [data-square="36"]') as HTMLElement;
    expect(updatedSq36?.querySelector('.piece-wrapper')).toBeTruthy();
  });

  it('валидация редактора: запрет сохранения без королей или с пешкой на краю доски', () => {
    analysisUI.openBoardEditor();
    const applyBtn = container.querySelector('#btn-editor-apply') as HTMLButtonElement;
    const clearBtn = container.querySelector('#btn-editor-clear') as HTMLButtonElement;
    const errorEl = container.querySelector('#editor-error-msg') as HTMLElement;

    // Clear board -> 0 kings
    clearBtn.click();
    applyBtn.click();

    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('король');

    // Place White king on e1 (index 60) and Black king on e8 (index 4)
    const whiteKingBtn = container.querySelector('.palette-piece[data-color="white"][data-type="king"]') as HTMLElement;
    whiteKingBtn.click();
    (container.querySelector('.editor-board [data-square="60"]') as HTMLElement).click();

    const blackKingBtn = container.querySelector('.palette-piece[data-color="black"][data-type="king"]') as HTMLElement;
    blackKingBtn.click();
    (container.querySelector('.editor-board [data-square="4"]') as HTMLElement).click();

    // Place pawn on rank 8 (square 0) -> invalid
    const whitePawnBtn = container.querySelector('.palette-piece[data-color="white"][data-type="pawn"]') as HTMLElement;
    whitePawnBtn.click();
    (container.querySelector('.editor-board [data-square="0"]') as HTMLElement).click();

    applyBtn.click();
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('Пешки');
  });

  it('успешное применение корректной позиции из редактора переносит её на доску анализа', () => {
    analysisUI.openBoardEditor();
    const clearBtn = container.querySelector('#btn-editor-clear') as HTMLButtonElement;
    const applyBtn = container.querySelector('#btn-editor-apply') as HTMLButtonElement;
    const overlay = container.querySelector('#analysis-editor-overlay') as HTMLElement;

    // Clear board
    clearBtn.click();

    // Place White King on e1 (60) and Black King on e8 (4)
    const whiteKingBtn = container.querySelector('.palette-piece[data-color="white"][data-type="king"]') as HTMLElement;
    whiteKingBtn.click();
    (container.querySelector('.editor-board [data-square="60"]') as HTMLElement).click();

    const blackKingBtn = container.querySelector('.palette-piece[data-color="black"][data-type="king"]') as HTMLElement;
    blackKingBtn.click();
    (container.querySelector('.editor-board [data-square="4"]') as HTMLElement).click();

    // Place White Pawn on e2 (52)
    const whitePawnBtn = container.querySelector('.palette-piece[data-color="white"][data-type="pawn"]') as HTMLElement;
    whitePawnBtn.click();
    (container.querySelector('.editor-board [data-square="52"]') as HTMLElement).click();

    applyBtn.click();

    // Overlay closes and position is transferred to analysis board
    expect(overlay.style.display).toBe('none');
    const pieces = analysisUI.getStore().getState().board.pieces;
    expect(pieces[60]?.type).toBe('king');
    expect(pieces[60]?.color).toBe('white');
    expect(pieces[4]?.type).toBe('king');
    expect(pieces[4]?.color).toBe('black');
    expect(pieces[52]?.type).toBe('pawn');
  });

  it('безопасный демонтаж экрана анализа и вызов dispose останавливает работу движка', () => {
    const engine = analysisUI.getEngine();
    const disposeSpy = vi.spyOn(engine, 'dispose');

    analysisUI.destroy();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
