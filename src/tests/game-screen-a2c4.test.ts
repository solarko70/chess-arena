import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore, globalStore } from '@/state/store';
import { initApp, getRouter } from '@/main';
import { createSolarDecorLayer } from '@/ui/solar-decor';
import { GameSetupModalUI } from '@/ui/setupmodals';
import { GameOverModalUI } from '@/ui/gameovermodal';

describe('Stage A2c-4: Unified Solar Design for Game Screen and Setup Modals', () => {
  let store: ChessStore;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#/';
    document.body.innerHTML = '<div id="app"></div>';
    store = new ChessStore();
  });

  afterEach(() => {
    getRouter()?.destroy();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('theme variables set different orbit stroke and opacity with light theme >= 0.25', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Extract :root block
    const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
    expect(rootMatch).not.toBeNull();
    const rootBlock = rootMatch ? rootMatch[1] : '';

    // Extract [data-theme='light'] block
    const lightMatch = css.match(/\[data-theme=['"]light['"]\]\s*\{([\s\S]*?)\}/);
    expect(lightMatch).not.toBeNull();
    const lightBlock = lightMatch ? lightMatch[1] : '';

    expect(rootBlock).toContain('--orbit-stroke');
    expect(rootBlock).toContain('--orbit-opacity');
    expect(lightBlock).toContain('--orbit-stroke');
    expect(lightBlock).toContain('--orbit-opacity');

    // Check light theme opacity is not below 0.25
    const lightOpacityMatch = lightBlock.match(/--orbit-opacity:\s*([0-9.]+)/);
    expect(lightOpacityMatch).not.toBeNull();
    const lightOpacity = parseFloat(lightOpacityMatch![1]);
    expect(lightOpacity).toBeGreaterThanOrEqual(0.25);

    // Dark and light values must differ
    const darkOpacityMatch = rootBlock.match(/--orbit-opacity:\s*([0-9.]+)/);
    expect(darkOpacityMatch).not.toBeNull();
    const darkOpacity = parseFloat(darkOpacityMatch![1]);
    expect(lightOpacity).not.toBe(darkOpacity);
  });

  it('solar decor has at most 4 moving elements with transform-only animations', () => {
    const layer = createSolarDecorLayer({ withAnimatedPieces: true });
    document.body.appendChild(layer);

    const movingOrbits = layer.querySelectorAll('.modal-moving-orbit');
    expect(movingOrbits.length).toBeLessThanOrEqual(4);
    expect(movingOrbits.length).toBeGreaterThan(0);

    // Check that CSS animation keyframes manipulate only transform
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const keyframeNames = ['modalOrbitRotate1', 'modalCounterRotate1', 'modalOrbitRotate2', 'modalCounterRotate2'];
    for (const name of keyframeNames) {
      const kfRegex = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\}`, 'm');
      const match = css.match(kfRegex);
      expect(match).not.toBeNull();
      const body = match ? match[1] : '';
      expect(body).toContain('transform: rotate');
      // Must not animate heavy layout or paint properties
      expect(body).not.toContain('width:');
      expect(body).not.toContain('height:');
      expect(body).not.toContain('filter:');
    }

    layer.destroy();
  });

  it('closing setup modal and game over modal completely removes decor layer from DOM', () => {
    // 1. Setup modal lifecycle
    const setupMount = document.createElement('div');
    document.body.appendChild(setupMount);
    const setupModal = new GameSetupModalUI(setupMount, () => {});

    setupModal.open('local');
    expect(setupMount.querySelector('.solar-decor-layer')).not.toBeNull();

    setupModal.close();
    expect(setupMount.querySelector('.solar-decor-layer')).toBeNull();

    setupModal.destroy();

    // 2. GameOver modal lifecycle
    const gameOverMount = document.createElement('div');
    document.body.appendChild(gameOverMount);
    const gameOverModal = new GameOverModalUI(gameOverMount, store);

    gameOverModal.show();
    expect(gameOverMount.querySelector('.solar-decor-layer')).not.toBeNull();

    gameOverModal.hide();
    expect(gameOverMount.querySelector('.solar-decor-layer')).toBeNull();

    gameOverModal.destroy();
  });

  it('reduced motion media query disables animations and transitions for solar elements', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const reducedMotionMatch = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
    expect(reducedMotionMatch).not.toBeNull();
    const block = reducedMotionMatch ? reducedMotionMatch[1] : '';

    expect(block).toContain('.modal-moving-orbit');
    expect(block).toContain('.modal-piece-counter');
    expect(block).toContain('.player-bar');
    expect(block).toContain('.player-clock');
    expect(block).toContain('.setup-time-card');
    expect(block).toContain('.btn-setup-start');
  });

  it('solar decor layer pauses animation when document visibility is hidden', () => {
    const layer = createSolarDecorLayer({ withAnimatedPieces: true });
    document.body.appendChild(layer);

    expect(layer.classList.contains('solar-anim-paused')).toBe(false);

    // Mock document.hidden = true
    const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(layer.classList.contains('solar-anim-paused')).toBe(true);

    // Restore visibility
    hiddenSpy.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(layer.classList.contains('solar-anim-paused')).toBe(false);

    layer.destroy();
  });

  it('createSolarDecorLayer produces at most 12 SVG child nodes with aria-hidden', () => {
    const layer = createSolarDecorLayer();
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.style.pointerEvents).toBe('none');

    const svg = layer.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.children.length).toBeLessThanOrEqual(12);

    layer.destroy();
  });

  it('game screen and setup modals CSS contain no backdrop-filter or blur filters', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Extract game screen, board, player bars, side panel and setup modal rules
    const selectors = [
      '\\.screen-game',
      '\\.game-layout',
      '\\.game-board-mount',
      '\\.player-bar',
      '\\.player-clock',
      '\\.game-side-panel',
      '\\.setup-modal-dialog',
      '\\.setup-time-card',
      '\\.btn-setup-start',
    ];

    for (const sel of selectors) {
      const reg = new RegExp(`${sel}[^{]*\\{([^}]*)\\}`, 'g');
      let m;
      while ((m = reg.exec(css)) !== null) {
        const body = m[1];
        expect(body).not.toContain('backdrop-filter');
        expect(body).not.toContain('filter: blur');
      }
    }
  });

  it('active player side has active player bar class and toggles with turns', () => {
    initApp();

    // Start local game
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();
    const startBtn = document.getElementById('btn-setup-start') as HTMLButtonElement;
    startBtn.click();

    const topBar = document.getElementById('player-bar-top') as HTMLElement;
    const bottomBar = document.getElementById('player-bar-bottom') as HTMLElement;

    // White starts turn -> bottom bar is White by default
    expect(bottomBar.classList.contains('active-turn')).toBe(true);
    expect(bottomBar.classList.contains('active-player-bar')).toBe(true);
    expect(topBar.classList.contains('active-turn')).toBe(false);

    // Make move 1. e4 -> Black's turn
    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    expect(topBar.classList.contains('active-turn')).toBe(true);
    expect(topBar.classList.contains('active-player-bar')).toBe(true);
    expect(bottomBar.classList.contains('active-turn')).toBe(false);
  });

  it('selected time control card in setup modal has selected class', () => {
    initApp();
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();

    const blitz5Card = document.querySelector('.setup-time-card[data-time-id="blitz-5-0"]') as HTMLElement;
    expect(blitz5Card).not.toBeNull();

    blitz5Card.click();
    expect(blitz5Card.classList.contains('selected')).toBe(true);

    const otherCard = document.querySelector('.setup-time-card[data-time-id="rapid-10-0"]') as HTMLElement;
    expect(otherCard.classList.contains('selected')).toBe(false);
  });

  it('game screen and setup modal markup contain no emojis', () => {
    initApp();

    // Check game screen
    const gameScreen = document.getElementById('screen-game') as HTMLElement;
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/u;
    expect(emojiRegex.test(gameScreen.innerHTML)).toBe(false);

    // Check setup modal
    const playBotBtn = document.getElementById('btn-play-bot') as HTMLButtonElement;
    playBotBtn.click();

    const modalMount = document.getElementById('setup-modal-mount') as HTMLElement;
    expect(emojiRegex.test(modalMount.innerHTML)).toBe(false);
  });

  it('new solar theme styling blocks use CSS variables for colors', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Check that game screen, player-bar, setup dialog and setup start button use var(--...) for borders and backgrounds
    const screenMatch = css.match(/\.screen-game\s*\{([^}]*)\}/);
    expect(screenMatch).not.toBeNull();
    expect(screenMatch![1]).toContain('var(--');

    const playerBarMatch = css.match(/\.player-bar\.active-turn[^{]*\{([^}]*)\}/);
    expect(playerBarMatch).not.toBeNull();
    expect(playerBarMatch![1]).toContain('var(--solar-accent)');

    const setupBtnMatch = css.match(/\.btn-setup-start\s*\{([^}]*)\}/);
    expect(setupBtnMatch).not.toBeNull();
    expect(setupBtnMatch![1]).toContain('var(--solar-btn-start)');
  });
});
