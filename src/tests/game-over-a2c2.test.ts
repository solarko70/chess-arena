import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore, globalStore } from '@/state/store';
import { initApp, getRouter } from '@/main';
import { GameOverModalUI } from '@/ui/gameovermodal';
import { HistoryUI } from '@/ui/history';
import { ReviewPanelUI } from '@/ui/reviewpanel';
import {
  MOVE_CLASS_REGISTRY,
  formatMaterialPoints,
  type ReviewRunResult,
  type ReviewWorkerLike,
  type ReviewWorkerResponse,
} from '@/analysis';
import type { Move } from '@/core';

function createStubReviewResult(): ReviewRunResult {
  return {
    engineName: 'StubEngine 1.0',
    reanalyzed: 0,
    accuracy: {
      white: 82.4,
      black: 95.1,
    },
    counts: {
      white: { best: 1, excellent: 0, good: 0, inaccuracy: 1, mistake: 0, blunder: 1 },
      black: { best: 2, excellent: 1, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    },
    moves: [
      {
        ply: 1,
        san: 'f3',
        color: 'white',
        move: { from: 53, to: 45 } as unknown as Move,
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: -50 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 52,
        winAfter: 45,
        loss: 7,
        accuracy: 78,
        class: 'inaccuracy',
        onlyMove: false,
      },
      {
        ply: 2,
        san: 'e5',
        color: 'black',
        move: { from: 12, to: 28 } as unknown as Move,
        evalBefore: { type: 'cp', value: -50 },
        evalAfter: { type: 'cp', value: -60 },
        bestMove: { from: 12, to: 28 } as unknown as Move,
        bestSan: 'e5',
        winBefore: 55,
        winAfter: 56,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 3,
        san: 'g4',
        color: 'white',
        move: { from: 54, to: 38 } as unknown as Move,
        evalBefore: { type: 'cp', value: -60 },
        evalAfter: { type: 'mate', value: -1 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 44,
        winAfter: 0,
        loss: 44,
        accuracy: 10,
        class: 'blunder',
        onlyMove: false,
      },
      {
        ply: 4,
        san: 'Qh4#',
        color: 'black',
        move: { from: 3, to: 39 } as unknown as Move,
        evalBefore: { type: 'mate', value: -1 },
        evalAfter: { type: 'mate', value: 0 },
        bestMove: { from: 3, to: 39 } as unknown as Move,
        bestSan: 'Qh4#',
        winBefore: 100,
        winAfter: 100,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
    ],
    keyMoments: [],
    evalHistory: [
      { ply: 0, score: { type: 'cp', value: 20 }, cp: 20, whiteWinChance: 52 },
      { ply: 1, score: { type: 'cp', value: -50 }, cp: -50, whiteWinChance: 45 },
      { ply: 2, score: { type: 'cp', value: -60 }, cp: -60, whiteWinChance: 44 },
      { ply: 3, score: { type: 'mate', value: -1 }, cp: -10000, whiteWinChance: 0 },
      { ply: 4, score: { type: 'mate', value: 0 }, cp: -10000, whiteWinChance: 0 },
    ],
  };
}

function playFoolsMate(store: ChessStore): void {
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
}

describe('Stage A2c-2: Summary Modal, Move Class Registry, Background Analysis & Notify Guard', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    globalStore.setReviewEngine(undefined);
    globalStore.setReviewWorkerFactory(undefined);
    globalStore.newGame(undefined, { mode: 'pvp' });
  });

  afterEach(() => {
    globalStore.cancelReview();
    globalStore.setReviewEngine(undefined);
    globalStore.setReviewWorkerFactory(undefined);
    getRouter()?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('store.notify re-entrancy guard prevents stack overflow and bounds subscriber calls', () => {
    const store = new ChessStore();
    let calls = 0;

    // Subscriber mutates state once during notify
    store.subscribe((_state, s) => {
      calls++;
      if (calls === 2) {
        // Trigger a single re-entrant state mutation during notify
        s.toggleFlip();
      }
    });

    // Initial subscribe call = 1
    expect(calls).toBe(1);

    // Calling toggleFlip triggers pass 1 (calls=2, which calls toggleFlip again -> sets dirty flag)
    // and then pass 2 runs once (calls=3) without stack recursion
    store.toggleFlip();
    expect(calls).toBe(3);

    // Subscriber that calls notify > 20 times in a single cycle throws descriptive Error
    const badStore = new ChessStore();
    let armed = false;
    badStore.subscribe((_state, s) => {
      if (!armed) return;
      for (let i = 0; i < 25; i++) {
        s.toggleFlip();
      }
    });

    armed = true;
    expect(() => badStore.toggleFlip()).toThrow(
      'store.notify re-entered too deeply: a subscriber is mutating state; see stack',
    );
  });

  it('render functions of HistoryUI, GameOverModalUI, and ReviewPanelUI do not call notify', () => {
    const store = new ChessStore();
    const hMount = document.createElement('div');
    const gMount = document.createElement('div');
    const rMount = document.createElement('div');
    document.body.append(hMount, gMount, rMount);

    const historyUI = new HistoryUI(hMount, store);
    const modalUI = new GameOverModalUI(gMount, store);
    const reviewUI = new ReviewPanelUI(rMount, store);

    let extraSubscriberNotifications = 0;
    store.subscribe(() => {
      extraSubscriberNotifications++;
    });
    // Reset after initial subscription invocation
    extraSubscriberNotifications = 0;

    // Directly invoke render methods
    (historyUI as unknown as { render(): void }).render();
    modalUI.renderContent();
    (reviewUI as unknown as { render(): void }).render();

    expect(extraSubscriberNotifications).toBe(0);
    modalUI.destroy();
  });

  it('move class registry has 6 ordered classes with unique ids and CSS variables in styles.css', () => {
    expect(MOVE_CLASS_REGISTRY.length).toBe(10);

    const ids = MOVE_CLASS_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(10);
    expect(ids).toEqual(['opening', 'stellar', 'superb', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missed']);

    for (let i = 1; i < MOVE_CLASS_REGISTRY.length; i++) {
      expect(MOVE_CLASS_REGISTRY[i].order).toBeGreaterThan(MOVE_CLASS_REGISTRY[i - 1].order);
    }

    const stylesPath = path.resolve(process.cwd(), 'src', 'ui', 'styles.css');
    const cssText = fs.readFileSync(stylesPath, 'utf-8');
    for (const meta of MOVE_CLASS_REGISTRY) {
      expect(cssText).toContain(`${meta.cssVar}:`);
      expect(cssText).toContain(meta.color);
    }
  });

  it('summary modal renders two player cards with accuracy, 6 classes, zero-count dimming and winner badge', () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modal = new GameOverModalUI(mount, store);

    playFoolsMate(store);
    store.setReviewResult(createStubReviewResult());

    const cards = mount.querySelectorAll('.game-over-card');
    expect(cards.length).toBe(2);

    const whiteCard = mount.querySelector('.game-over-card[data-side="white"]') as HTMLElement;
    const blackCard = mount.querySelector('.game-over-card[data-side="black"]') as HTMLElement;
    expect(whiteCard).toBeTruthy();
    expect(blackCard).toBeTruthy();

    // Black won Fool's mate -> winner highlight and badge on black card
    expect(blackCard.classList.contains('winner-card')).toBe(true);
    expect(whiteCard.classList.contains('winner-card')).toBe(false);
    expect(blackCard.querySelector('.card-winner-badge')?.textContent).toBe('Победитель');

    // Accuracies
    expect(whiteCard.querySelector('.card-accuracy-val')?.textContent).toBe('82.4%');
    expect(blackCard.querySelector('.card-accuracy-val')?.textContent).toBe('95.1%');

    // 7 class rows in each card in registry order
    const whiteRows = Array.from(whiteCard.querySelectorAll('.card-class-row'));
    const blackRows = Array.from(blackCard.querySelectorAll('.card-class-row'));
    expect(whiteRows.length).toBe(10);
    expect(blackRows.length).toBe(10);

    const expectedLabels = MOVE_CLASS_REGISTRY.map((m) => `${m.nameRu}:`);
    expect(whiteRows.map((r) => r.querySelector('.card-class-label')?.textContent)).toEqual(expectedLabels);

    // Zero-count rows have .zero-count class, non-zero do not
    // White counts: opening=0, stellar=0, superb=0, best=1, excellent=0, good=0, inaccuracy=1, mistake=0, blunder=1, missed=0
    expect(whiteRows[0].classList.contains('zero-count')).toBe(true); // opening: 0
    expect(whiteRows[1].classList.contains('zero-count')).toBe(true); // stellar: 0
    expect(whiteRows[2].classList.contains('zero-count')).toBe(true); // superb: 0
    expect(whiteRows[3].classList.contains('zero-count')).toBe(false); // best: 1
    expect(whiteRows[4].classList.contains('zero-count')).toBe(true); // excellent: 0
    expect(whiteRows[5].classList.contains('zero-count')).toBe(true); // good: 0
    expect(whiteRows[6].classList.contains('zero-count')).toBe(false); // inaccuracy: 1
    expect(whiteRows[7].classList.contains('zero-count')).toBe(true); // mistake: 0
    expect(whiteRows[8].classList.contains('zero-count')).toBe(false); // blunder: 1
    expect(whiteRows[9].classList.contains('zero-count')).toBe(true); // missed: 0

    modal.destroy();
  });

  it('shows correct player and bot titles in summary cards for AI game mode', () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modal = new GameOverModalUI(mount, store);

    store.configureGame({ mode: 'ai', level: 'expert', playerColor: 'white' });
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    store.makeMove(e2, e4);
    store.resign('white');

    const whiteCard = mount.querySelector('.game-over-card[data-side="white"]') as HTMLElement;
    const blackCard = mount.querySelector('.game-over-card[data-side="black"]') as HTMLElement;

    expect(whiteCard.querySelector('.card-title')?.textContent).toBe('Вы');
    expect(blackCard.querySelector('.card-title')?.textContent).toBe('Компьютер: Эксперт');

    modal.destroy();
  });

  it('auto-starts background analysis once after checkmate and resignation when worker is provided', async () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modal = new GameOverModalUI(mount, store);

    let workerCalls = 0;
    const stubResult = createStubReviewResult();

    store.setReviewWorkerFactory(() => {
      workerCalls++;
      const worker: ReviewWorkerLike = {
        onmessage: null,
        onerror: null,
        postMessage(msg) {
          if (msg.type === 'review') {
            setTimeout(() => {
              const progressReply: ReviewWorkerResponse = {
                type: 'progress',
                id: msg.id,
                progress: { completed: 2, total: 5, ply: 2 },
              };
              worker.onmessage?.({ data: progressReply } as MessageEvent<ReviewWorkerResponse>);

              const doneReply: ReviewWorkerResponse = {
                type: 'result',
                id: msg.id,
                result: stubResult,
              };
              worker.onmessage?.({ data: doneReply } as MessageEvent<ReviewWorkerResponse>);
            }, 5);
          }
        },
        terminate() {},
      };
      return worker;
    });

    playFoolsMate(store);

    // Immediately after mate, analysis is in progress and worker was created exactly once
    expect(workerCalls).toBe(1);
    expect(store.isReviewInProgress()).toBe(true);
    expect(modal.isOpen()).toBe(true);
    expect(mount.querySelector('.analysis-progress-label')?.textContent).toContain('Анализ партии:');

    // Wait for stub worker completion
    await vi.waitFor(() => {
      expect(store.isReviewInProgress()).toBe(false);
      expect(store.getReviewResult()).toBeTruthy();
    });

    expect(workerCalls).toBe(1);
    expect(mount.querySelector('.card-accuracy-val')?.textContent).toBe('82.4%');

    // Test resignation also triggers auto-review once
    store.newGame();
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    const e7 = store.coordsToSquare(4, 1);
    const e5 = store.coordsToSquare(4, 3);
    store.makeMove(e2, e4);
    store.makeMove(e7, e5);
    store.resign('white');

    expect(workerCalls).toBe(2);
    await vi.waitFor(() => {
      expect(store.isReviewInProgress()).toBe(false);
    });

    modal.destroy();
  });

  it('skips analysis and shows message when game has fewer than 2 plies', () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modal = new GameOverModalUI(mount, store);

    let workerCalls = 0;
    store.setReviewWorkerFactory(() => {
      workerCalls++;
      return { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
    });

    // 1 ply only, then resign
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    store.makeMove(e2, e4);
    store.resign('black');

    expect(workerCalls).toBe(0);
    expect(store.isReviewInProgress()).toBe(false);
    expect(mount.querySelector('.analysis-too-short')?.textContent).toBe(
      'Партия слишком короткая для анализа',
    );
    expect(mount.querySelector('.card-class-count')?.textContent).toBe('—');

    modal.destroy();
  });

  it('reuses cached review result when clicking Game Review without re-running worker', async () => {
    initApp();
    let workerRuns = 0;
    const stubResult = createStubReviewResult();

    globalStore.setReviewWorkerFactory(() => {
      workerRuns++;
      const worker: ReviewWorkerLike = {
        onmessage: null,
        onerror: null,
        postMessage(msg) {
          if (msg.type === 'review') {
            setTimeout(() => {
              worker.onmessage?.({
                data: { type: 'result', id: msg.id, result: stubResult },
              } as MessageEvent<ReviewWorkerResponse>);
            }, 5);
          }
        },
        terminate() {},
      };
      return worker;
    });

    playFoolsMate(globalStore);

    await vi.waitFor(() => {
      expect(globalStore.isReviewInProgress()).toBe(false);
      expect(globalStore.getReviewResult()).not.toBeNull();
    });

    expect(workerRuns).toBe(1);

    // Click "Разбор партии" in summary modal
    const reviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reviewBtn.click();

    const reviewOverlay = document.getElementById('review-overlay') as HTMLElement;
    expect(reviewOverlay.style.display).toBe('flex');
    // Cached result reused -> no additional worker runs
    expect(workerRuns).toBe(1);
  });

  it('cancels background analysis when clicking Play Again', () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    let terminated = false;

    store.setReviewWorkerFactory(() => ({
      onmessage: null,
      onerror: null,
      postMessage() {
        // Never responds -> stays in progress until cancelled
      },
      terminate() {
        terminated = true;
      },
    }));

    const modal = new GameOverModalUI(mount, store);
    playFoolsMate(store);

    expect(store.isReviewInProgress()).toBe(true);

    const newGameBtn = mount.querySelector('#btn-modal-new-game') as HTMLButtonElement;
    newGameBtn.click();

    expect(store.isReviewInProgress()).toBe(false);
    expect(terminated).toBe(true);

    modal.destroy();
  });

  it('shows error message and retry button when analysis fails, and retry succeeds', async () => {
    const store = new ChessStore();
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modal = new GameOverModalUI(mount, store);

    let shouldFail = true;
    const stubResult = createStubReviewResult();

    store.setReviewWorkerFactory(() => {
      const worker: ReviewWorkerLike = {
        onmessage: null,
        onerror: null,
        postMessage(msg) {
          if (msg.type === 'review') {
            setTimeout(() => {
              if (shouldFail) {
                worker.onmessage?.({
                  data: { type: 'error', id: msg.id, message: 'Boom' },
                } as MessageEvent<ReviewWorkerResponse>);
              } else {
                worker.onmessage?.({
                  data: { type: 'result', id: msg.id, result: stubResult },
                } as MessageEvent<ReviewWorkerResponse>);
              }
            }, 5);
          }
        },
        terminate() {},
      };
      return worker;
    });

    playFoolsMate(store);

    await vi.waitFor(() => {
      expect(store.getReviewError()).toBe('Анализ недоступен');
    });

    expect(mount.querySelector('.analysis-error-text')?.textContent).toBe('Анализ недоступен');
    const retryBtn = mount.querySelector('#btn-retry-analysis') as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();

    // Now let retry succeed
    shouldFail = false;
    retryBtn.click();

    await vi.waitFor(() => {
      expect(store.getReviewError()).toBeNull();
      expect(store.getReviewResult()).not.toBeNull();
    });

    expect(mount.querySelector('.card-accuracy-val')?.textContent).toBe('82.4%');
    modal.destroy();
  });

  it('formats material points with proper Russian declension and no minus sign', () => {
    expect(formatMaterialPoints(0)).toBe('0 очков');
    expect(formatMaterialPoints(1)).toBe('1 очко');
    expect(formatMaterialPoints(2)).toBe('2 очка');
    expect(formatMaterialPoints(5)).toBe('5 очков');
    expect(formatMaterialPoints(11)).toBe('11 очков');
    expect(formatMaterialPoints(21)).toBe('21 очко');
    expect(formatMaterialPoints(22)).toBe('22 очка');
    expect(formatMaterialPoints(25)).toBe('25 очков');
    expect(formatMaterialPoints(-3)).toBe('3 очка');
  });
});
