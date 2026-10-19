import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { initApp } from '@/main';
import { globalStore } from '@/state/store';
import { calculateRingOffset, createAccuracyRing } from '@/ui/accuracy-ring';
import { createClassRow, createClassRowsList } from '@/ui/class-rows';
import { getMoveClassMeta, type GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

describe('Stage A2c-5: Fullscreen Solar Background and Review Panel Styling', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    globalStore.newGame();
    initApp();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('bg layer has position fixed, inset 0, aria-hidden, pointer-events none and is child of body', () => {
    const gameSolarBg = document.getElementById('game-solar-bg');
    expect(gameSolarBg).not.toBeNull();
    expect(gameSolarBg?.parentElement).toBe(document.body);

    const app = document.getElementById('app');
    const screenGame = document.getElementById('screen-game');
    const reviewOverlay = document.getElementById('review-overlay');

    expect(app?.contains(gameSolarBg!)).toBe(false);
    expect(screenGame?.contains(gameSolarBg!)).toBe(false);
    expect(reviewOverlay?.contains(gameSolarBg!)).toBe(false);

    expect(gameSolarBg?.getAttribute('aria-hidden')).toBe('true');
    expect(gameSolarBg?.style.pointerEvents).toBe('none');

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const bgMatch = css.match(/\.game-solar-background\s*\{([^}]*)\}/);
    expect(bgMatch).not.toBeNull();
    expect(bgMatch![1]).toMatch(/position:\s*fixed;/);
    expect(bgMatch![1]).toMatch(/inset:\s*0;/);
    expect(bgMatch![1]).toMatch(/pointer-events:\s*none;/);
    expect(bgMatch![1]).toMatch(/z-index:\s*(?:-1|var\(--z-bg\));/);
  });

  it('bg layer is visible on game screen and review overlay, but hidden on home screen', () => {
    const homeSolarBg = document.getElementById('solar-bg');
    const gameSolarBg = document.getElementById('game-solar-bg');

    // On home screen
    expect(homeSolarBg?.style.display).not.toBe('none');
    expect(gameSolarBg?.style.display).toBe('none');

    // Start a game and navigate to #/game
    globalStore.setActiveGame(true);
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(homeSolarBg?.style.display).toBe('none');
    expect(gameSolarBg?.style.display).toBe('block');
    expect(document.body.classList.contains('game-active')).toBe(true);

    // Open review overlay
    const reviewBtn = document.getElementById('btn-modal-review');
    reviewBtn?.click();
    expect(gameSolarBg?.style.display).toBe('none');
    expect(document.body.classList.contains('review-active')).toBe(true);

    // Close review overlay
    const closeBtn = document.getElementById('btn-close-review-overlay');
    closeBtn?.click();
    expect(document.body.classList.contains('review-active')).toBe(false);

    // Back to home
    window.location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(homeSolarBg?.style.display).not.toBe('none');
    expect(gameSolarBg?.style.display).toBe('none');
  });

  it('bg layer has <= 12 SVG child nodes and no blur, backdrop-filter or animations in CSS', () => {
    const gameSolarBg = document.getElementById('game-solar-bg');
    expect(gameSolarBg).not.toBeNull();
    const svgChildNodes = gameSolarBg?.querySelectorAll('svg > *');
    expect(svgChildNodes).toBeDefined();
    expect(svgChildNodes!.length).toBeGreaterThan(0);
    expect(svgChildNodes!.length).toBeLessThanOrEqual(12);

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const bgRuleMatch = css.match(/\.game-solar-background\s*\{([^}]*)\}/);
    expect(bgRuleMatch).not.toBeNull();
    expect(bgRuleMatch![1]).not.toContain('backdrop-filter');
    expect(bgRuleMatch![1]).not.toContain('blur');
    expect(bgRuleMatch![1]).not.toContain('animation');
  });

  it('game screen has transparent background and review overlay has opaque edge base', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const screenMatch = css.match(/\.screen-game\s*\{([^}]*)\}/);
    expect(screenMatch).not.toBeNull();
    expect(screenMatch![1]).toMatch(/background:\s*transparent;/);

    const overlayMatch = css.match(/\.review-overlay\s*\{([^}]*)\}/);
    expect(overlayMatch).not.toBeNull();
    expect(overlayMatch![1]).toMatch(/background-color:\s*var\(--solar-bg-edge\);/);
  });

  it('body.game-active and body.review-active match --solar-bg-edge in CSS', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const bodyMatch = css.match(/body\.game-active,\s*body\.review-active\s*\{([^}]*)\}/);
    expect(bodyMatch).not.toBeNull();
    expect(bodyMatch![1]).toMatch(/background-color:\s*var\(--solar-bg-edge\);/);
  });

  it('player bars use span color indicator and contain no checkbox input elements', () => {
    const topIndicator = document.getElementById('player-indicator-top');
    const bottomIndicator = document.getElementById('player-indicator-bottom');

    expect(topIndicator?.tagName.toLowerCase()).toBe('span');
    expect(bottomIndicator?.tagName.toLowerCase()).toBe('span');

    const boardCol = document.getElementById('game-board-col');
    const checkboxes = boardCol?.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes?.length).toBe(0);

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const indicatorMatch = css.match(/\.player-color-indicator\s*\{([^}]*)\}/);
    expect(indicatorMatch).not.toBeNull();
    expect(indicatorMatch![1]).toMatch(/border-radius:\s*50%;/);
  });

  it('accuracy-ring module accurately calculates stroke-dashoffset based on percentage', () => {
    // Circumference = 175.93
    expect(calculateRingOffset(100)).toBeCloseTo(0, 1);
    expect(calculateRingOffset(0)).toBeCloseTo(175.93, 1);
    expect(calculateRingOffset(50)).toBeCloseTo(87.965, 1);
    expect(calculateRingOffset(82.4)).toBeCloseTo(175.93 * (1 - 0.824), 1);

    const ring = createAccuracyRing({ size: 72, radius: 28 });
    expect(ring.wrapEl.classList.contains('card-accuracy-ring-wrap')).toBe(true);

    ring.update(88.5);
    expect(ring.valueEl.textContent).toBe('88.5%');
    expect(ring.progressCircle.classList.contains('ring-high')).toBe(true);

    ring.update(74.0);
    expect(ring.progressCircle.classList.contains('ring-mid')).toBe(true);

    ring.update(62.0);
    expect(ring.progressCircle.classList.contains('ring-low')).toBe(true);
  });

  it('class-rows module outputs registry badge and name with zero-count class for zeroes', () => {
    const singleRow = createClassRow(getMoveClassMeta('blunder'));
    expect(singleRow.rowEl.getAttribute('data-class-id')).toBe('blunder');
    expect(singleRow.badgeEl.textContent).toBe('??');
    expect(singleRow.labelEl.textContent).toBe('Зевок:');

    singleRow.update(0);
    expect(singleRow.countEl.textContent).toBe('0');
    expect(singleRow.rowEl.classList.contains('zero-count')).toBe(true);

    singleRow.update(3);
    expect(singleRow.countEl.textContent).toBe('3');
    expect(singleRow.rowEl.classList.contains('zero-count')).toBe(false);

    const rowsList = createClassRowsList();
    expect(rowsList.rows.size).toBe(6);
    rowsList.update({ best: 2, blunder: 0 });
    expect(rowsList.rows.get('best')?.countEl.textContent).toBe('2');
    expect(rowsList.rows.get('blunder')?.rowEl.classList.contains('zero-count')).toBe(true);
  });

  it('ReviewPanelUI and GameOverModalUI share createAccuracyRing and createClassRowsList', () => {
    const gameOverFile = fs.readFileSync(path.resolve(__dirname, '../ui/gameovermodal.ts'), 'utf8');
    const reviewPanelFile = fs.readFileSync(path.resolve(__dirname, '../ui/reviewpanel.ts'), 'utf8');

    expect(gameOverFile).toContain('createAccuracyRing');
    expect(gameOverFile).toContain('createClassRowsList');

    expect(reviewPanelFile).toContain('createAccuracyRing');
    expect(reviewPanelFile).toContain('createClassRowsList');
  });

  it('review panel renders engine badges, accuracy rings, class rows, graph and key moments', () => {
    const mockReview = {
      engineName: 'Stockfish 19 Lite WASM',
      depth: 16,
      reanalyzed: 4,
      accuracy: { white: 89.2, black: 78.4 },
      counts: {
        white: { best: 10, excellent: 5, good: 2, inaccuracy: 1, mistake: 0, blunder: 0 },
        black: { best: 6, excellent: 4, good: 3, inaccuracy: 2, mistake: 2, blunder: 1 },
      },
      lostMaterial: { white: 0, black: 3 },
      evalHistory: [
        { ply: 0, score: { type: 'cp' as const, value: 20 }, cp: 20, whiteWinChance: 52 },
        { ply: 1, score: { type: 'cp' as const, value: -120 }, cp: -120, whiteWinChance: 35 },
      ],
      moves: [
        {
          ply: 0,
          color: 'white' as const,
          move: { from: 12, to: 28 } as unknown as Move,
          bestMove: { from: 12, to: 28 } as unknown as Move,
          san: 'e4',
          class: 'best' as const,
          loss: 0,
          accuracy: 100,
          winBefore: 50,
          winAfter: 52,
          onlyMove: false,
          bestSan: 'e4',
          evalBefore: { type: 'cp' as const, value: 0 },
          evalAfter: { type: 'cp' as const, value: 20 },
        },
        {
          ply: 1,
          color: 'black' as const,
          move: { from: 53, to: 45 } as unknown as Move,
          bestMove: { from: 57, to: 42 } as unknown as Move,
          san: 'f6',
          class: 'blunder' as const,
          loss: 15.2,
          accuracy: 25,
          winBefore: 48,
          winAfter: 35,
          onlyMove: false,
          bestSan: 'e5',
          evalBefore: { type: 'cp' as const, value: 20 },
          evalAfter: { type: 'cp' as const, value: -120 },
        },
      ],
    } as unknown as GameReviewResult;

    globalStore.setReviewResult(mockReview);
    globalStore.setReviewMode(true);

    const engineInfo = document.getElementById('review-engine-info');
    expect(engineInfo?.textContent).toContain('Stockfish 19 Lite WASM');
    expect(engineInfo?.textContent).toContain('16');
    expect(engineInfo?.textContent).toContain('4');

    const accWhite = document.getElementById('review-acc-white');
    const accBlack = document.getElementById('review-acc-black');
    expect(accWhite?.textContent).toBe('89.2%');
    expect(accBlack?.textContent).toBe('78.4%');

    const whiteList = document.getElementById('review-classes-white-list');
    const blackList = document.getElementById('review-classes-black-list');
    expect(whiteList?.querySelectorAll('.card-class-row').length).toBe(6);
    expect(blackList?.querySelectorAll('.card-class-row').length).toBe(6);

    const graphSvg = document.getElementById('review-eval-graph');
    expect(graphSvg?.querySelector('polygon')).not.toBeNull();
    expect(graphSvg?.querySelector('polyline')).not.toBeNull();

    const keyMoments = document.getElementById('review-key-moments-list');
    expect(keyMoments?.querySelectorAll('.key-moment-item').length).toBe(1);
    expect(keyMoments?.textContent).toContain('f6');
  });

  it('review panel has no backdrop-filter, filter blur or emojis and uses CSS variables', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const reviewBlock = css.substring(css.indexOf('/* Review Panel */'), css.indexOf('/* Game Over Modal */'));
    expect(reviewBlock).not.toContain('backdrop-filter');
    expect(reviewBlock).not.toContain('filter: blur');

    const reviewPanelHtml = document.getElementById('review-mount')?.innerHTML ?? '';
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/u;
    expect(emojiRegex.test(reviewPanelHtml)).toBe(false);

    expect(reviewBlock).toContain('var(--solar-');
    expect(reviewBlock).toContain('var(--orbit-stroke)');
  });
});
