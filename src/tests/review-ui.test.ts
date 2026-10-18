import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { globalStore } from '@/state/store';
import { initApp } from '@/main';
import {
  exportReviewedPGN,
  runGameReview,
  type GameReviewResult,
  type AnalysisEngine,
  type ReviewWorkerLike,
  type ReviewWorkerResponse,
} from '@/analysis';

import type { Move } from '@/core';

function createMockReviewResult(): GameReviewResult {
  return {
    engineName: 'MockEngine 1.0',
    reanalyzed: 0,
    accuracy: {
      white: 94.5,
      black: 88.2,
    },
    counts: {
      white: { best: 2, excellent: 1, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { best: 1, excellent: 0, good: 0, inaccuracy: 1, mistake: 0, blunder: 1 },
    },
    moves: [
      {
        ply: 1,
        san: 'e4',
        color: 'white',
        move: { from: 12, to: 28 } as unknown as Move,
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: 25 },
        bestMove: { from: 12, to: 28 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 52.0,
        winAfter: 52.5,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 2,
        san: 'e5',
        color: 'black',
        move: { from: 52, to: 36 } as unknown as Move,
        evalBefore: { type: 'cp', value: 25 },
        evalAfter: { type: 'cp', value: 30 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e5',
        winBefore: 47.5,
        winAfter: 47.0,
        loss: 0.5,
        accuracy: 98,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 3,
        san: 'Nf3',
        color: 'white',
        move: { from: 6, to: 21 } as unknown as Move,
        evalBefore: { type: 'cp', value: 30 },
        evalAfter: { type: 'cp', value: 35 },
        bestMove: { from: 6, to: 21 } as unknown as Move,
        bestSan: 'Nf3',
        winBefore: 53.0,
        winAfter: 53.5,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 4,
        san: 'f6',
        color: 'black',
        move: { from: 53, to: 45 } as unknown as Move,
        evalBefore: { type: 'cp', value: 35 },
        evalAfter: { type: 'cp', value: 300 },
        bestMove: { from: 57, to: 42 } as unknown as Move, // Nc6
        bestSan: 'Nc6',
        winBefore: 46.5,
        winAfter: 18.0,
        loss: 28.5,
        accuracy: 32,
        class: 'blunder',
        onlyMove: false,
      },
    ],
    keyMoments: [
      {
        ply: 4,
        san: 'f6',
        color: 'black',
        move: { from: 53, to: 45 } as unknown as Move,
        evalBefore: { type: 'cp', value: 35 },
        evalAfter: { type: 'cp', value: 300 },
        bestMove: { from: 57, to: 42 } as unknown as Move,
        bestSan: 'Nc6',
        winBefore: 46.5,
        winAfter: 18.0,
        loss: 28.5,
        accuracy: 32,
        class: 'blunder',
        onlyMove: false,
      },
    ],
    evalHistory: [
      { ply: 0, score: { type: 'cp', value: 20 }, cp: 20, whiteWinChance: 52 },
      { ply: 1, score: { type: 'cp', value: 25 }, cp: 25, whiteWinChance: 52.5 },
      { ply: 2, score: { type: 'cp', value: 30 }, cp: 30, whiteWinChance: 53 },
      { ply: 3, score: { type: 'cp', value: 35 }, cp: 35, whiteWinChance: 53.5 },
      { ply: 4, score: { type: 'cp', value: 300 }, cp: 300, whiteWinChance: 82 },
    ],
  };
}

describe('Game Review UI Integration Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    globalStore.newGame();
    initApp();
  });

  afterEach(() => {
    globalStore.setReviewEngine(undefined);
    globalStore.setReviewWorkerFactory(undefined);
  });

  it('Кнопка разбора партии становится доступной после мата', () => {
    const reviewBtn = document.getElementById('btn-start-review') as HTMLButtonElement;
    expect(reviewBtn).toBeTruthy();
    // At initial position (0 moves), review is not available
    expect(reviewBtn.disabled).toBe(true);

    // Play Fool's mate: 1. f3 e5 2. g4 Qh4#
    // Square indexes in classical 8x8: sq = y * 8 + x (where y=0 is rank 8, y=7 is rank 1)
    const f3 = globalStore.coordsToSquare(5, 5);
    const f2 = globalStore.coordsToSquare(5, 6);
    const e5 = globalStore.coordsToSquare(4, 3);
    const e7 = globalStore.coordsToSquare(4, 1);
    const g4 = globalStore.coordsToSquare(6, 4);
    const g2 = globalStore.coordsToSquare(6, 6);
    const h4 = globalStore.coordsToSquare(7, 4);
    const d8 = globalStore.coordsToSquare(3, 0);

    globalStore.makeMove(f2, f3);
    globalStore.makeMove(e7, e5);
    globalStore.makeMove(g2, g4);
    globalStore.makeMove(d8, h4);

    expect(globalStore.getGameResult().type).toBe('checkmate');
    expect(globalStore.canReview()).toBe(true);
    expect(reviewBtn.disabled).toBe(false);
  });

  it('Индикатор прогресса разбора корректно доходит до 100%', async () => {
    // Play 2 moves so review is allowed
    const e4 = globalStore.coordsToSquare(4, 4);
    const e2 = globalStore.coordsToSquare(4, 6);
    const e5 = globalStore.coordsToSquare(4, 3);
    const e7 = globalStore.coordsToSquare(4, 1);
    globalStore.makeMove(e2, e4);
    globalStore.makeMove(e7, e5);

    const mockReviewResult = createMockReviewResult();
    const mockEngine: AnalysisEngine = {
      name: 'MockEngine',
      analyze: async (_st, opts) => {
        const depth = opts?.depth ?? 16;
        return {
          engineName: 'MockEngine',
          bestMove: { from: 12, to: 28 } as unknown as Move,
          score: { type: 'cp', value: 20 },
          depth,
          nodes: 100,
          timeMs: 10,
          pv: [{ from: 12, to: 28 } as unknown as Move],
          lines: [
            {
              move: { from: 12, to: 28 } as unknown as Move,
              san: 'e4',
              score: { type: 'cp', value: 20 },
              pv: [{ from: 12, to: 28 } as unknown as Move],
              pvSan: ['e4'],
            },
          ],
        };
      },
      dispose: () => {},
    };
    globalStore.setReviewEngine(mockEngine);

    const reviewBtn = document.getElementById('btn-start-review') as HTMLButtonElement;
    expect(reviewBtn.disabled).toBe(false);

    // Simulate progress updates
    globalStore.setReviewInProgress(true);
    globalStore.setReviewProgress({ completed: 1, total: 3, ply: 0 });
    const progressText = document.getElementById('review-progress-text') as HTMLElement;
    const progressBar = document.getElementById('review-progress-bar') as HTMLProgressElement;
    expect(progressText.textContent).toContain('33%');

    globalStore.setReviewProgress({ completed: 3, total: 3, ply: 2 });
    expect(progressText.textContent).toContain('100%');
    expect(progressBar.value).toBe(3);

    // Complete review
    globalStore.setReviewResult(mockReviewResult);
    globalStore.setReviewProgress(null);
    globalStore.setReviewInProgress(false);
    globalStore.setReviewMode(true);

    const resultsSection = document.getElementById('review-results-section') as HTMLElement;
    expect(resultsSection.style.display).not.toBe('none');
    const accWhite = document.getElementById('review-acc-white') as HTMLElement;
    expect(accWhite.textContent).toBe('94.5%');
  });

  it('Кнопка отмены успешно прерывает выполнение разбора', () => {
    // Play 2 moves
    const e4 = globalStore.coordsToSquare(4, 4);
    const e2 = globalStore.coordsToSquare(4, 6);
    const e5 = globalStore.coordsToSquare(4, 3);
    const e7 = globalStore.coordsToSquare(4, 1);
    globalStore.makeMove(e2, e4);
    globalStore.makeMove(e7, e5);

    // Start review state
    globalStore.setReviewInProgress(true);
    globalStore.setReviewProgress({ completed: 1, total: 3, ply: 0 });

    const progressSection = document.getElementById('review-progress-section') as HTMLElement;
    expect(progressSection.style.display).not.toBe('none');

    const cancelBtn = document.getElementById('btn-cancel-review') as HTMLButtonElement;
    cancelBtn.click();

    expect(globalStore.isReviewInProgress()).toBe(false);
    expect(progressSection.style.display).toBe('none');
  });

  it('Клик по ходу отображает бейдж класса и стрелку лучшего хода', () => {
    const e4 = globalStore.coordsToSquare(4, 4);
    const e2 = globalStore.coordsToSquare(4, 6);
    const e5 = globalStore.coordsToSquare(4, 3);
    const e7 = globalStore.coordsToSquare(4, 1);
    const Nf3 = globalStore.coordsToSquare(5, 5);
    const g1 = globalStore.coordsToSquare(6, 7);
    const f6 = globalStore.coordsToSquare(5, 2);
    const f7 = globalStore.coordsToSquare(5, 1);

    globalStore.makeMove(e2, e4);
    globalStore.makeMove(e7, e5);
    globalStore.makeMove(g1, Nf3);
    globalStore.makeMove(f7, f6);

    const mockResult = createMockReviewResult();
    globalStore.setReviewResult(mockResult);
    globalStore.setReviewMode(true);

    // Fourth move (index 3: f6) was classified as blunder
    const moveEls = document.querySelectorAll('.history-move');
    expect(moveEls.length).toBe(4);

    const move4 = moveEls[3] as HTMLElement;
    const badge = move4.querySelector('.badge-blunder') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.dataset.class).toBe('blunder');

    // Click on move 4
    move4.click();

    // Check detail panel shows eval and best move
    const detailPanel = document.getElementById('history-detail-panel') as HTMLElement;
    expect(detailPanel.style.display).not.toBe('none');
    expect(detailPanel.textContent).toContain('зевок');
    expect(detailPanel.textContent).toContain('Nc6');

    // Check SVG arrow on board
    const arrowLine = document.querySelector('.best-move-arrow-line') as SVGLineElement;
    expect(arrowLine).toBeTruthy();
    expect(arrowLine.getAttribute('stroke')).toBe('#22c55e');
  });

  it('При ошибке Stockfish происходит fallback со специальной плашкой', async () => {
    const states = [globalStore.getState()];

    const mockWorker: ReviewWorkerLike = {
      postMessage: function (msg) {
        if (msg.type === 'review') {
          setTimeout(() => {
            const reply: ReviewWorkerResponse = {
              type: 'result',
              id: msg.id,
              result: createMockReviewResult(),
            };
            this.onmessage?.({ data: reply } as MessageEvent);
          }, 0);
        }
      },
      terminate: () => {},
      onmessage: null,
      onerror: null,
    };

    // Test runGameReview with forceOwnEngine to trigger graceful fallback
    const res = await runGameReview(states, {
      forceOwnEngine: true,
      workerFactory: () => mockWorker,
    });

    expect(res.fallbackNote).toBe('разбор сделан встроенным движком (менее точный)');

    // In UI, setting result with fallback displays banner
    globalStore.setReviewResult(res, res.fallbackNote);
    globalStore.setReviewMode(true);

    const fallbackEl = document.getElementById('review-fallback-note') as HTMLElement;
    expect(fallbackEl.style.display).not.toBe('none');
    expect(fallbackEl.textContent).toContain('разбор сделан встроенным движком (менее точный)');
  });

  it('Закрытие панели разбора восстанавливает обычный режим игры', () => {
    globalStore.setReviewMode(true);
    expect(globalStore.isReviewMode()).toBe(true);

    const closeBtn = document.getElementById('btn-close-review') as HTMLButtonElement;
    expect(closeBtn.style.display).not.toBe('none');
    closeBtn.click();

    expect(globalStore.isReviewMode()).toBe(false);
    const resultsSection = document.getElementById('review-results-section') as HTMLElement;
    expect(resultsSection.style.display).toBe('none');
  });

  it('Экспорт партии содержит комментарии с оценками [%eval] и NAG', () => {
    const mockResult = createMockReviewResult();
    const pgn = exportReviewedPGN(globalStore.getLiveState(), mockResult);

    expect(pgn).toContain('{[%eval');
    expect(pgn).toContain('??'); // NAG for blunder (ply 4)
    expect(pgn).toContain('[WhiteAccuracy "94.5"]');
    expect(pgn).toContain('[BlackAccuracy "88.2"]');

    // UI copy button
    globalStore.setReviewResult(mockResult);
    globalStore.setReviewMode(true);

    const copyBtn = document.getElementById('btn-copy-reviewed-pgn') as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();
  });

  it('Игровые часы останавливаются на время действия режима разбора', () => {
    vi.useFakeTimers();
    try {
      globalStore.setClockMode('blitz-5-0');
      const e4 = globalStore.coordsToSquare(4, 4);
      const e2 = globalStore.coordsToSquare(4, 6);
      globalStore.makeMove(e2, e4);

      // Advance time by 2 seconds during Black's live turn
      vi.advanceTimersByTime(2000);
      globalStore.tickClock();
      const blackTimeBefore = globalStore.getTime('black');

      // Enter review mode
      globalStore.setReviewMode(true);
      expect(globalStore.isClockActive()).toBe(false);

      // Advance time by 5 seconds while reviewing
      vi.advanceTimersByTime(5000);
      globalStore.tickClock();
      const blackTimeDuring = globalStore.getTime('black');

      // Clock must NOT tick down during review mode
      expect(blackTimeDuring).toBe(blackTimeBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
