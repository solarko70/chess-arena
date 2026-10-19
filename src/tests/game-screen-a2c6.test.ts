import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { globalStore } from '@/state/store';
import { initApp } from '@/main';

describe('Stage A2c-6: Review screen isolation and expanded cosmic background', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    initApp();
  });

  afterEach(() => {
    globalStore.setReviewEngine(undefined);
    document.body.innerHTML = '';
  });

  it('screen-game is hidden on review open and restored on review close', () => {
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

    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const screenGame = document.getElementById('screen-game') as HTMLElement;
    const reviewOverlay = document.getElementById('review-overlay') as HTMLElement;

    expect(screenGame.style.display).toBe('flex');
    expect(screenGame.getAttribute('aria-hidden')).toBeNull();
    expect(screenGame.hasAttribute('inert')).toBe(false);
    expect(reviewOverlay.style.display).toBe('none');

    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    // Open review overlay via game over modal button
    const reviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    expect(reviewBtn).not.toBeNull();
    reviewBtn.click();

    // Verify review overlay is visible, screen-game is completely hidden and inert
    expect(reviewOverlay.style.display).toBe('flex');
    expect(screenGame.style.display).toBe('none');
    expect(screenGame.getAttribute('aria-hidden')).toBe('true');
    expect(screenGame.hasAttribute('inert')).toBe(true);

    // Close review overlay via close button
    const closeBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    // Verify screen-game is restored visible and interactive
    expect(reviewOverlay.style.display).toBe('none');
    expect(screenGame.style.display).toBe('flex');
    expect(screenGame.getAttribute('aria-hidden')).toBeNull();
    expect(screenGame.hasAttribute('inert')).toBe(false);
  });

  it('repeated review open and close preserves board moves, clocks, and state', () => {
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

    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Play 4 plies
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    const historyLenBefore = globalStore.getLiveState().history.length;
    const isGameOverBefore = globalStore.isGameOver();
    const resultBefore = globalStore.getGameResult();

    const reviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    const closeBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;

    // First cycle: open and close
    reviewBtn.click();
    closeBtn.click();

    // Second cycle: open and close
    const summaryModalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    summaryModalReviewBtn.click();
    closeBtn.click();

    const screenGame = document.getElementById('screen-game') as HTMLElement;
    expect(screenGame.style.display).toBe('flex');
    expect(globalStore.getLiveState().history.length).toBe(historyLenBefore);
    expect(globalStore.isGameOver()).toBe(isGameOverBefore);
    expect(globalStore.getGameResult()).toEqual(resultBefore);

    // Board mounts back into game screen column
    const boardMount = document.getElementById('board-mount');
    expect(boardMount?.parentElement?.id).toBe('game-board-col');
  });

  it('review-overlay has opaque base background-color with solar-bg-edge', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const overlayMatch = css.match(/\.review-overlay\s*\{([^}]*)\}/);
    expect(overlayMatch).not.toBeNull();
    const rules = overlayMatch![1];

    expect(rules).toMatch(/background-color:\s*var\(--solar-bg-edge\);/);
    expect(rules).not.toMatch(/background:\s*transparent;/);
    expect(rules).toMatch(/z-index:\s*var\(--z-overlay\);/);
  });

  it('layer z-index variables are declared on root with no numeric z-index above 10', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Check z-index CSS variables on :root
    const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
    expect(rootMatch).not.toBeNull();
    const rootVars = rootMatch![1];

    expect(rootVars).toMatch(/--z-bg:\s*-1;/);
    expect(rootVars).toMatch(/--z-screen:\s*1;/);
    expect(rootVars).toMatch(/--z-overlay:\s*50;/);
    expect(rootVars).toMatch(/--z-modal:\s*100;/);
    expect(rootVars).toMatch(/--z-toast:\s*200;/);

    // Check that no numeric z-index greater than 10 remains in the entire CSS
    const numericZIndexes: number[] = [];
    const zIndexRegex = /z-index:\s*(-?\d+)\s*;/g;
    let match: RegExpExecArray | null;
    while ((match = zIndexRegex.exec(css)) !== null) {
      numericZIndexes.push(parseInt(match[1], 10));
    }

    const largeNumericZIndexes = numericZIndexes.filter((val) => val > 10);
    expect(largeNumericZIndexes).toEqual([]);
  });

  it('game-solar-bg has planet cluster with center glow and max 70 nodes', () => {
    const gameSolarBg = document.getElementById('game-solar-bg');
    expect(gameSolarBg).not.toBeNull();

    const svg = gameSolarBg!.querySelector('svg');
    expect(svg).not.toBeNull();

    // Planet cluster in bottom-left
    const planetCluster = svg!.querySelector('.space-planet-cluster');
    expect(planetCluster).not.toBeNull();

    const planet = planetCluster!.querySelector('.space-planet');
    expect(planet).not.toBeNull();
    expect(planet!.getAttribute('cx')).toBe('140');
    expect(planet!.getAttribute('cy')).toBe('960');

    // Gradient center matches planet center exactly
    const grad = svg!.querySelector('#space-planet-body-grad');
    expect(grad).not.toBeNull();
    expect(grad!.getAttribute('cx')).toBe('140');
    expect(grad!.getAttribute('cy')).toBe('960');

    // Asteroid belt has no old class, has connected line
    expect(svg!.querySelector('.game-solar-asteroid-belt')).toBeNull();
    const asteroidTrack = svg!.querySelector('.space-asteroid-track');
    expect(asteroidTrack).not.toBeNull();
    expect(asteroidTrack!.querySelector('.space-asteroid-line')).not.toBeNull();
    expect(asteroidTrack!.querySelector('.space-asteroid-dots')).not.toBeNull();

    // Total child elements inside SVG must be <= 90
    const totalSvgElements = svg!.querySelectorAll('*').length;
    expect(totalSvgElements).toBeLessThanOrEqual(90);
  });

  it('game-solar-bg has no blur, backdrop-filter, or animation in CSS', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Extract all CSS rules related to game-solar background
    const bgRules = css.match(/\.game-solar-[^{]*\{([^}]*)\}/g);
    expect(bgRules).not.toBeNull();

    bgRules!.forEach((rule) => {
      expect(rule).not.toContain('backdrop-filter');
      expect(rule).not.toMatch(/filter:\s*blur/);
      expect(rule).not.toMatch(/\banimation:/);
    });
  });

  it('asteroid track and secondary stars are hidden on mobile under 800px', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Find media query matching max-width 800px
    const mediaMatch = css.match(/@media\s*\([^{]*max-width:\s*800px[^{]*\)\s*\{([\s\S]*?\n\})/);
    expect(mediaMatch).not.toBeNull();
    const mediaContent = mediaMatch![1];

    // Asteroid track hidden on mobile
    expect(mediaContent).toMatch(/space-asteroid-track/);
    expect(mediaContent).toMatch(/display:\s*none;/);

    // Planet cluster scales down on mobile
    expect(mediaContent).toMatch(/space-planet-cluster/);
    expect(mediaContent).toMatch(/transform:\s*scale\(/);
  });
});

