import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

function createMockReviewWithStellar(): GameReviewResult {
  return {
    engineName: 'MockEngine',
    reanalyzed: 0,
    accuracy: { white: 92.0, black: 80.0 },
    counts: {
      white: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, stellar: 1 },
      black: { best: 0, excellent: 0, good: 1, inaccuracy: 0, mistake: 0, blunder: 0 },
    },
    moves: [
      {
        ply: 1,
        san: 'e4',
        color: 'white',
        move: { from: 52, to: 36 } as unknown as Move,
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: 30 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 52,
        winAfter: 53,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 2,
        san: 'e5',
        color: 'black',
        move: { from: 12, to: 28 } as unknown as Move,
        evalBefore: { type: 'cp', value: 30 },
        evalAfter: { type: 'cp', value: 35 },
        bestMove: { from: 12, to: 28 } as unknown as Move,
        bestSan: 'e5',
        winBefore: 47,
        winAfter: 46.5,
        loss: 0.5,
        accuracy: 98,
        class: 'good',
        onlyMove: false,
      },
      {
        ply: 3,
        san: 'Nf3!!',
        color: 'white',
        move: { from: 62, to: 45 } as unknown as Move,
        evalBefore: { type: 'cp', value: 35 },
        evalAfter: { type: 'cp', value: 120 },
        bestMove: { from: 62, to: 45 } as unknown as Move,
        bestSan: 'Nf3',
        winBefore: 53.5,
        winAfter: 68,
        loss: 0,
        accuracy: 100,
        class: 'stellar',
        onlyMove: true,
      },
    ],
    keyMoments: [],
    evalHistory: [],
  };
}

describe('Solar Wings and Piece Kinematics (Stage 5a-2)', () => {
  let store: ChessStore;
  let boardContainer: HTMLElement;
  let boardUI: ChessBoardUI;

  beforeEach(() => {
    store = new ChessStore();
    boardContainer = document.createElement('div');
    document.body.appendChild(boardContainer);
    boardUI = new ChessBoardUI(boardContainer, store);
    expect(boardUI).toBeDefined();
  });

  afterEach(() => {
    boardContainer.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('монтирует .stellar-wings-mount на целевой клетке для звёздного хода', () => {
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // e4
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3)); // e5
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5)); // Nf3 (sq 45)

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    // Navigate to move 2 (Nf3!!, class = 'stellar', to = 45)
    store.setViewIndex(2);

    const targetSquare = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    expect(targetSquare).not.toBeNull();

    const wingsMount = targetSquare.querySelector('.stellar-wings-mount') as HTMLElement;
    expect(wingsMount).not.toBeNull();
    expect(wingsMount.getAttribute('aria-hidden')).toBe('true');
  });

  it('SVG крыльев содержит теги path и g, градиент и не содержит эмодзи', () => {
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);
    store.setViewIndex(2);

    const wingsMount = boardContainer.querySelector('.stellar-wings-mount') as HTMLElement;
    expect(wingsMount).not.toBeNull();

    const svg = wingsMount.querySelector('svg.stellar-wings-svg') as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.classList.contains('stellar-wings-flutter')).toBe(true);

    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2);

    const group = svg.querySelector('g.stellar-wings-group');
    expect(group).not.toBeNull();

    const grad = svg.querySelector('linearGradient#solar-wings-grad');
    expect(grad).not.toBeNull();

    const solarGrad = svg.querySelector('linearGradient#solar-wing-gradient');
    expect(solarGrad).not.toBeNull();

    // Verify pure vector geometry without emoji characters
    const html = wingsMount.innerHTML;
    // Standard emoji regex test
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });

  it('содержит независимые зеркальные крылья stellar-wing-left и stellar-wing-right', () => {
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);
    store.setViewIndex(2);

    const wingsMount = boardContainer.querySelector('.stellar-wings-mount') as HTMLElement;
    expect(wingsMount).not.toBeNull();

    const leftWing = wingsMount.querySelector('.stellar-wing.stellar-wing-left');
    const rightWing = wingsMount.querySelector('.stellar-wing.stellar-wing-right');
    expect(leftWing).not.toBeNull();
    expect(rightWing).not.toBeNull();

    const glowGrad = wingsMount.querySelector('linearGradient#wing-glow');
    expect(glowGrad).not.toBeNull();
  });

  it('CSS задает независимые точки transform-origin для левого и правого крыла', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.stellar-wing-left\s*\{[^}]*transform-origin:\s*45px\s+35px/);
    expect(css).toMatch(/\.stellar-wing-right\s*\{[^}]*transform-origin:\s*55px\s+35px/);
  });

  it('при переключении хода на не-stellar элемент крыльев удаляется из DOM', () => {
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    // Step onto stellar move
    store.setViewIndex(2);
    expect(boardContainer.querySelector('.stellar-wings-mount')).not.toBeNull();

    // Step away onto non-stellar move (move 1: e5, class = 'good')
    store.setViewIndex(1);
    expect(boardContainer.querySelector('.stellar-wings-mount')).toBeNull();
  });

  it('автоочистка удаляет крылья из DOM по завершению анимации или таймеру', () => {
    vi.useFakeTimers();
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);
    store.setViewIndex(2);

    expect(boardContainer.querySelector('.stellar-wings-mount')).not.toBeNull();

    // At 2400ms wings are still mounted before 2500ms timeout
    vi.advanceTimersByTime(2400);
    expect(boardContainer.querySelector('.stellar-wings-mount')).not.toBeNull();

    // Advance past 2500ms (+200ms -> 2600ms total): wings are automatically removed
    vi.advanceTimersByTime(200);

    expect(boardContainer.querySelector('.stellar-wings-mount')).toBeNull();
    vi.useRealTimers();
  });

  it('крылья используют градиент solar-wing-gradient и монолитный силуэт', () => {
    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);
    store.setViewIndex(2);

    const wingsMount = boardContainer.querySelector('.stellar-wings-mount') as HTMLElement;
    expect(wingsMount).not.toBeNull();

    const grad = wingsMount.querySelector('linearGradient#solar-wing-gradient');
    expect(grad).not.toBeNull();

    const leftMain = wingsMount.querySelector('.stellar-wing-left .wing-feather-main');
    expect(leftMain).not.toBeNull();
    expect(leftMain?.getAttribute('fill')).toBe('url(#solar-wing-gradient)');
    expect(leftMain?.getAttribute('stroke')).toBe('none');

    const rightMain = wingsMount.querySelector('.stellar-wing-right .wing-feather-main');
    expect(rightMain).not.toBeNull();
    expect(rightMain?.getAttribute('fill')).toBe('url(#solar-wing-gradient)');
    expect(rightMain?.getAttribute('stroke')).toBe('none');
  });

  it('при навигации в разборе фигура получает CSS-класс piece-sliding', () => {
    let mockTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    // Initial position in review mode
    store.setViewIndex(0);

    // Advance mock time by 300ms (> 150ms)
    mockTime += 300;

    // Step forward to move 1 (e7 to e5: sq 28)
    store.setViewIndex(1);

    const targetSq = boardContainer.querySelector('[data-square="28"]') as HTMLElement;
    const piece = targetSq?.querySelector('.piece-wrapper') as HTMLElement;
    expect(piece).not.toBeNull();
    expect(piece.classList.contains('piece-sliding')).toBe(true);
  });

  it('быстрая навигация спам менее 150мс мгновенно отменяет анимацию', () => {
    let mockTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

    const mockReview = createMockReviewWithStellar();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    store.setViewIndex(0);

    // Step 1 with ample time (> 150ms)
    mockTime += 300;
    store.setViewIndex(1);

    // Step 2 rapid (< 150ms)
    mockTime += 50;
    store.setViewIndex(2);

    // Since it was under 150ms, spam protection snaps directly without .piece-sliding
    const targetSq = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
    const piece = targetSq?.querySelector('.piece-wrapper') as HTMLElement;
    expect(piece).not.toBeNull();
    expect(piece.classList.contains('piece-sliding')).toBe(false);
  });

  it('в режиме живой партии без разбора piece-sliding не добавляется', () => {
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    const targetSq = boardContainer.querySelector('[data-square="36"]') as HTMLElement;
    const piece = targetSq?.querySelector('.piece-wrapper') as HTMLElement;
    expect(piece).not.toBeNull();
    expect(piece.classList.contains('piece-sliding')).toBe(false);
  });
});

