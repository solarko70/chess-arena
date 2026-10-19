import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
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
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    globalStore.newGame();
    initApp();
  });

  afterEach(() => {
    globalStore.setReviewEngine(undefined);
    globalStore.setReviewWorkerFactory(undefined);
  });

  it('Кнопка разбора партии становится доступной после мата', () => {
    // At initial position (0 moves), review is not available
    expect(globalStore.canReview()).toBe(false);

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

    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    expect(modalReviewBtn).toBeTruthy();
    expect(modalReviewBtn.disabled).toBe(false);
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

    expect(globalStore.canReview()).toBe(true);

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
    globalStore.setReviewEngine({
      name: 'StubEngine',
      analyze: async () => ({
        engineName: 'StubEngine',
        bestMove: null,
        score: { type: 'cp', value: 0 },
        depth: 1,
        nodes: 1,
        timeMs: 1,
        pv: [],
        lines: [],
      }),
      dispose: () => {},
    });

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

    // Open review overlay via summary modal button
    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();

    expect(globalStore.isReviewMode()).toBe(true);
    const reviewOverlay = document.getElementById('review-overlay') as HTMLElement;
    expect(reviewOverlay.style.display).toBe('flex');

    const closeBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    closeBtn.click();

    expect(globalStore.isReviewMode()).toBe(false);
    expect(reviewOverlay.style.display).toBe('none');
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

  it('Кнопки навигации смонтированы в review-board-nav под доской в оверлее разбора', () => {
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

    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();

    const boardSlot = document.getElementById('review-overlay-board-slot') as HTMLElement;
    expect(boardSlot).toBeTruthy();

    const nav = boardSlot.querySelector('.review-board-nav') as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.id).toBe('review-board-nav');

    // Board mount is placed directly above review-board-nav
    const children = Array.from(boardSlot.children);
    expect(children.length).toBe(2);
    expect(children[0].id).toBe('board-mount');
    expect(children[1].id).toBe('review-board-nav');
  });

  it('Кнопки review-board-nav имеют верные aria-label, SVG-иконки и не содержат эмодзи', () => {
    const nav = document.getElementById('review-board-nav') as HTMLElement;
    expect(nav).toBeTruthy();

    const firstBtn = nav.querySelector('#review-nav-first') as HTMLButtonElement;
    const prevBtn = nav.querySelector('#review-nav-prev') as HTMLButtonElement;
    const nextBtn = nav.querySelector('#review-nav-next') as HTMLButtonElement;
    const lastBtn = nav.querySelector('#review-nav-last') as HTMLButtonElement;

    expect(firstBtn).toBeTruthy();
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
    expect(lastBtn).toBeTruthy();

    expect(firstBtn.getAttribute('aria-label')).toBe('В начало (Home)');
    expect(prevBtn.getAttribute('aria-label')).toBe('Назад (←)');
    expect(nextBtn.getAttribute('aria-label')).toBe('Вперёд (→)');
    expect(lastBtn.getAttribute('aria-label')).toBe('В конец (End)');

    // Ensure all 4 navigation buttons contain vector SVG icons with viewBox 0 0 24 24
    [firstBtn, prevBtn, nextBtn, lastBtn].forEach((btn) => {
      const svg = btn.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('none');
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
    });

    // Zero emojis in button text/titles
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(nav.textContent || '')).toBe(false);
  });

  it('Клики по кнопкам навигации review-board-nav корректно переключают viewIndex', () => {
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

    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();

    const firstBtn = document.getElementById('review-nav-first') as HTMLButtonElement;
    const prevBtn = document.getElementById('review-nav-prev') as HTMLButtonElement;
    const nextBtn = document.getElementById('review-nav-next') as HTMLButtonElement;
    const lastBtn = document.getElementById('review-nav-last') as HTMLButtonElement;

    firstBtn.click();
    expect(globalStore.getViewIndex()).toBe(-1);

    nextBtn.click();
    expect(globalStore.getViewIndex()).toBe(0);

    nextBtn.click();
    expect(globalStore.getViewIndex()).toBe(1);

    prevBtn.click();
    expect(globalStore.getViewIndex()).toBe(0);

    lastBtn.click();
    expect(globalStore.getViewIndex()).toBe(null);

    prevBtn.click();
    expect(globalStore.getViewIndex()).toBe(2);
  });

  it('Кнопки навигации review-board-nav корректно меняют disabled состояние', () => {
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

    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();

    const firstBtn = document.getElementById('review-nav-first') as HTMLButtonElement;
    const prevBtn = document.getElementById('review-nav-prev') as HTMLButtonElement;
    const nextBtn = document.getElementById('review-nav-next') as HTMLButtonElement;
    const lastBtn = document.getElementById('review-nav-last') as HTMLButtonElement;

    // At the end of game (viewIndex = null)
    expect(globalStore.getViewIndex()).toBe(null);
    expect(firstBtn.disabled).toBe(false);
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
    expect(lastBtn.disabled).toBe(true);

    // Navigate to beginning
    firstBtn.click();
    expect(globalStore.getViewIndex()).toBe(-1);
    expect(firstBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(lastBtn.disabled).toBe(false);

    // In the middle
    nextBtn.click();
    expect(globalStore.getViewIndex()).toBe(0);
    expect(firstBtn.disabled).toBe(false);
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
    expect(lastBtn.disabled).toBe(false);
  });

  it('Строки классов в модальном окне и панели разбора имеют значки class-row-badge', () => {
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

    const modalRows = document.querySelectorAll('#game-over-modal-mount .card-class-row');
    const reviewRows = document.querySelectorAll('#review-mount .card-class-row');

    expect(modalRows.length).toBeGreaterThan(0);
    expect(reviewRows.length).toBeGreaterThan(0);

    const allBadges = document.querySelectorAll('.card-class-row .class-row-badge');
    expect(allBadges.length).toBe(modalRows.length + reviewRows.length);

    allBadges.forEach((badge) => {
      expect(badge.classList.contains('class-row-badge')).toBe(true);
      const svg = badge.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    });
  });

  it('Автоанализ после окончания партии вызывается с depth = 14', async () => {
    let requestedDepth: number | undefined;
    const mockEngine: AnalysisEngine = {
      name: 'DepthSpyEngine',
      analyze: async (_st, opts) => {
        requestedDepth = opts?.depth;
        return {
          engineName: 'DepthSpyEngine',
          bestMove: null,
          score: { type: 'cp', value: 0 },
          depth: opts?.depth ?? 14,
          nodes: 10,
          timeMs: 1,
          pv: [],
          lines: [],
        };
      },
      dispose: () => {},
    };
    globalStore.setReviewEngine(mockEngine);

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

    expect(globalStore.isGameOver()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requestedDepth).toBe(14);
    expect(globalStore.getReviewResult()?.depth).toBe(14);
  });

  it('В итоговом окне есть чекбокс глубокого анализа и состояние сохраняется в localStorage', () => {
    localStorage.removeItem('chess_arena_deep_analysis');
    const checkbox = document.getElementById('deep-analysis-checkbox') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);

    checkbox.click();
    expect(checkbox.checked).toBe(true);
    expect(localStorage.getItem('chess_arena_deep_analysis')).toBe('true');

    checkbox.click();
    expect(checkbox.checked).toBe(false);
    expect(localStorage.getItem('chess_arena_deep_analysis')).toBe('false');
  });

  it('Запуск разбора с активным чекбоксом передаёт depth = 20', async () => {
    let requestedDepth: number | undefined;
    const mockEngine: AnalysisEngine = {
      name: 'Depth20Engine',
      analyze: async (_st, opts) => {
        requestedDepth = opts?.depth;
        return {
          engineName: 'Depth20Engine',
          bestMove: null,
          score: { type: 'cp', value: 0 },
          depth: opts?.depth ?? 20,
          nodes: 10,
          timeMs: 1,
          pv: [],
          lines: [],
        };
      },
      dispose: () => {},
    };
    globalStore.setReviewEngine(mockEngine);

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

    const checkbox = document.getElementById('deep-analysis-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const reviewModalBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reviewModalBtn.click();

    await vi.waitFor(() => {
      expect(requestedDepth).toBe(20);
      expect(globalStore.getReviewResult()?.depth).toBe(20);
    });
  });

  it('Бейдж глубины в разборе показывает число, и кнопка углубления пересчитывает на 20', async () => {
    let currentDepth = 16;
    const mockEngine: AnalysisEngine = {
      name: 'DynamicDepthEngine',
      analyze: async (_st, opts) => {
        currentDepth = opts?.depth ?? currentDepth;
        return {
          engineName: 'DynamicDepthEngine',
          bestMove: null,
          score: { type: 'cp', value: 0 },
          depth: currentDepth,
          nodes: 10,
          timeMs: 1,
          pv: [],
          lines: [],
        };
      },
      dispose: () => {},
    };
    globalStore.setReviewEngine(mockEngine);

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

    // Initial review at depth 16
    const reviewModalBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reviewModalBtn.click();
    await vi.waitFor(() => {
      const depthBadge = document.querySelector('.engine-depth');
      expect(depthBadge?.textContent).toContain('16');
    });

    const deepenBtn = document.getElementById('btn-deepen-review') as HTMLButtonElement;
    expect(deepenBtn).toBeTruthy();

    deepenBtn.click();
    await vi.waitFor(() => {
      const depthBadge = document.querySelector('.engine-depth');
      expect(depthBadge?.textContent).toContain('20');
      expect(document.getElementById('btn-deepen-review')).toBeNull();
    });
  });

  it('Повторное открытие разбора с той же или меньшей глубиной не сбрасывает кэш', async () => {
    let analyzeCount = 0;
    const mockEngine: AnalysisEngine = {
      name: 'CacheCheckEngine',
      analyze: async (_st, opts) => {
        analyzeCount++;
        return {
          engineName: 'CacheCheckEngine',
          bestMove: null,
          score: { type: 'cp', value: 0 },
          depth: opts?.depth ?? 16,
          nodes: 10,
          timeMs: 1,
          pv: [],
          lines: [],
        };
      },
      dispose: () => {},
    };
    globalStore.setReviewEngine(mockEngine);

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

    // Open review overlay with depth 16
    const reviewModalBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reviewModalBtn.click();
    await vi.waitFor(() => {
      expect(globalStore.isReviewInProgress()).toBe(false);
      expect(globalStore.getReviewResult()).not.toBeNull();
    });

    const initialAnalyzeCount = analyzeCount;
    expect(initialAnalyzeCount).toBeGreaterThan(0);

    // Close review overlay
    const closeBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    closeBtn.click();

    // Reopen review overlay
    const reopenReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reopenReviewBtn.click();
    await vi.waitFor(() => {
      expect(globalStore.isReviewInProgress()).toBe(false);
    });

    // analyzeCount should not have increased because cached depth 16 was reused
    expect(analyzeCount).toBe(initialAnalyzeCount);
  });

  it('Контейнер review-board-nav на узких экранах содержит ровно 4 кнопки без выпадения', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const nav = document.getElementById('review-board-nav') as HTMLElement;
    expect(nav).toBeTruthy();

    const buttons = nav.querySelectorAll<HTMLButtonElement>('.review-nav-btn');
    expect(buttons.length).toBe(4);
    expect(document.getElementById('review-nav-first')).toBeTruthy();
    expect(document.getElementById('review-nav-prev')).toBeTruthy();
    expect(document.getElementById('review-nav-next')).toBeTruthy();
    expect(document.getElementById('review-nav-last')).toBeTruthy();

    // Check CSS grid and button flex-shrink rules
    expect(css).toMatch(/\.review-board-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\);/);
    expect(css).toMatch(/\.review-nav-btn\s*\{[^}]*min-width:\s*0;/);
    expect(css).toMatch(/\.review-nav-btn\s+svg\s*\{[^}]*max-width:\s*20px;[^}]*max-height:\s*20px;/);

    // Check mobile responsive constraints (<= 800px)
    expect(css).toMatch(/\.review-board-nav\s*\{[^}]*width:\s*min\(calc\(100vw - 24px\),\s*400px\);/);
    expect(css).toMatch(/\.review-board-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\);/);
    expect(css).toMatch(/\.review-nav-btn\s*\{[^}]*height:\s*42px;/);
  });

  it('Элементы class-row имеют min-height не менее 32px и flex-shrink: 0', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const classRows = document.querySelectorAll('.class-row');
    expect(classRows.length).toBeGreaterThan(0);

    // Verify base rules have min-height >= 32px and flex-shrink: 0
    const baseRowMatch = css.match(/\.(?:card-class-row,\s*\.class-row|class-row)\s*\{([^}]*)\}/);
    expect(baseRowMatch).not.toBeNull();
    const minHeightMatch = baseRowMatch![1].match(/min-height:\s*(\d+)px;/);
    expect(minHeightMatch).not.toBeNull();
    expect(Number(minHeightMatch![1])).toBeGreaterThanOrEqual(32);
    expect(baseRowMatch![1]).toMatch(/flex-shrink:\s*0;/);

    // Verify mobile responsive rule <= 800px has min-height: 38px, height: 38px, flex-shrink: 0
    expect(css).toMatch(/\.class-row,\s*\.card-class-row\s*\{[^}]*min-height:\s*38px;/);
    expect(css).toMatch(/\.class-row,\s*\.card-class-row\s*\{[^}]*height:\s*38px;/);
    expect(css).toMatch(/\.class-row,\s*\.card-class-row\s*\{[^}]*flex-shrink:\s*0;/);
    expect(css).toMatch(/color:\s*var\(--solar-text,\s*#f8fafc\);/);
  });

  it('Мобильные вкладки (Ходы / Обзор / График) переключают видимость секций', async () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Desktop rule: .review-mobile-tabs is hidden
    expect(css).toMatch(/\.review-mobile-tabs\s*\{[^}]*display:\s*none;/);

    // Mobile rule <= 800px has display: grid and tabs switching rules
    expect(css).toMatch(/\.review-mobile-tabs\s*\{[^}]*display:\s*grid;/);
    expect(css).toContain('[data-active-tab="moves"]');
    expect(css).toContain('[data-active-tab="overview"]');
    expect(css).toContain('[data-active-tab="graph"]');

    // Open review overlay
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

    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();

    const sideCol = document.getElementById('review-overlay-side-col') as HTMLElement;
    expect(sideCol).toBeTruthy();
    expect(sideCol.getAttribute('data-active-tab')).toBe('moves');

    const mobileTabs = document.getElementById('review-mobile-tabs') as HTMLElement;
    expect(mobileTabs).toBeTruthy();

    const movesBtn = mobileTabs.querySelector('[data-tab="moves"]') as HTMLButtonElement;
    const overviewBtn = mobileTabs.querySelector('[data-tab="overview"]') as HTMLButtonElement;
    const graphBtn = mobileTabs.querySelector('[data-tab="graph"]') as HTMLButtonElement;

    expect(movesBtn).toBeTruthy();
    expect(overviewBtn).toBeTruthy();
    expect(graphBtn).toBeTruthy();

    expect(movesBtn.classList.contains('active')).toBe(true);
    expect(overviewBtn.classList.contains('active')).toBe(false);
    expect(graphBtn.classList.contains('active')).toBe(false);

    // Switch to Overview tab
    overviewBtn.click();
    expect(sideCol.getAttribute('data-active-tab')).toBe('overview');
    expect(overviewBtn.classList.contains('active')).toBe(true);
    expect(movesBtn.classList.contains('active')).toBe(false);

    // Switch to Graph tab
    graphBtn.click();
    expect(sideCol.getAttribute('data-active-tab')).toBe('graph');
    expect(graphBtn.classList.contains('active')).toBe(true);
    expect(overviewBtn.classList.contains('active')).toBe(false);

    // Switch back to Moves tab
    movesBtn.click();
    expect(sideCol.getAttribute('data-active-tab')).toBe('moves');
    expect(movesBtn.classList.contains('active')).toBe(true);

    // Check data-review-tab attributes on review sections
    expect(document.querySelector('.review-accuracies')?.getAttribute('data-review-tab')).toBe('overview');
    expect(document.querySelector('.review-classes-table-wrap')?.getAttribute('data-review-tab')).toBe('overview');
    expect(document.querySelector('.review-engine-info')?.getAttribute('data-review-tab')).toBe('graph');
    expect(document.querySelector('.review-graph-wrap')?.getAttribute('data-review-tab')).toBe('graph');
    expect(document.querySelector('.review-key-moments-wrap')?.getAttribute('data-review-tab')).toBe('graph');
    expect(document.querySelector('.review-actions')?.getAttribute('data-review-tab')).toBe('graph');
  });

  it('Кнопки перехода по ошибкам в разборе партии осуществляют навигацию по ошибкам', () => {
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

    const mockResult = createMockReviewResult();
    globalStore.setReviewResult(mockResult);
    globalStore.setReviewMode(true);

    const prevMistakeBtn = document.getElementById('btn-prev-mistake') as HTMLButtonElement;
    const nextMistakeBtn = document.getElementById('btn-next-mistake') as HTMLButtonElement;
    expect(prevMistakeBtn).toBeTruthy();
    expect(nextMistakeBtn).toBeTruthy();

    // In mock review, move index 3 (ply 4: f6) is blunder
    globalStore.setViewIndex(0);
    expect(nextMistakeBtn.disabled).toBe(false);

    nextMistakeBtn.click();
    expect(globalStore.getViewIndex()).toBe(3);

    // Now at index 3 (last blunder), next should be disabled
    expect(nextMistakeBtn.disabled).toBe(true);
  });
});
