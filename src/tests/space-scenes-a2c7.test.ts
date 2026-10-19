import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildGameScene,
  buildReviewScene,
  GAME_CONSTELLATIONS,
  REVIEW_CONSTELLATIONS,
  generateStars,
} from '@/ui/space-scenes';
import { globalStore } from '@/state/store';
import { initApp } from '@/main';

describe('Stage A2c-7: Celestial scenes, constellations, and review panel spacing', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    initApp();
  });

  afterEach(() => {
    globalStore.setReviewEngine(undefined);
    document.body.innerHTML = '';
  });

  it('buildGameScene and buildReviewScene return maximum 90 SVG nodes each', () => {
    const gameContainer = document.createElement('div');
    gameContainer.innerHTML = buildGameScene();
    const gameSvg = gameContainer.querySelector('svg');
    expect(gameSvg).not.toBeNull();
    const gameNodes = gameContainer.querySelectorAll('*').length;
    expect(gameNodes).toBeLessThanOrEqual(90);

    const reviewContainer = document.createElement('div');
    reviewContainer.innerHTML = buildReviewScene();
    const reviewSvg = reviewContainer.querySelector('svg');
    expect(reviewSvg).not.toBeNull();
    const reviewNodes = reviewContainer.querySelectorAll('*').length;
    expect(reviewNodes).toBeLessThanOrEqual(90);
  });

  it('decorative space layers have aria-hidden and pointer-events none', () => {
    const gameSolarBg = document.getElementById('game-solar-bg');
    expect(gameSolarBg).not.toBeNull();
    expect(gameSolarBg!.getAttribute('aria-hidden')).toBe('true');
    expect(gameSolarBg!.style.pointerEvents).toBe('none');

    const reviewScene = document.getElementById('review-solar-scene');
    expect(reviewScene).not.toBeNull();
    expect(reviewScene!.getAttribute('aria-hidden')).toBe('true');
    expect(reviewScene!.style.pointerEvents).toBe('none');
  });

  it('game scene has no legacy asteroid belt class and connects asteroids', () => {
    const gameContainer = document.createElement('div');
    gameContainer.innerHTML = buildGameScene();

    expect(gameContainer.querySelector('.game-solar-asteroid-belt')).toBeNull();

    const asteroidLine = gameContainer.querySelector('.space-asteroid-line');
    const asteroidDots = gameContainer.querySelector('.space-asteroid-dots');
    expect(asteroidLine).not.toBeNull();
    expect(asteroidDots).not.toBeNull();
  });

  it('glow gradient centers match planet circle and sun disk centers exactly', () => {
    const gameContainer = document.createElement('div');
    gameContainer.innerHTML = buildGameScene();

    // Planet circle and its body / halo gradients at (140, 960)
    const planetCircle = gameContainer.querySelector('.space-planet');
    expect(planetCircle).not.toBeNull();
    const pCx = planetCircle!.getAttribute('cx');
    const pCy = planetCircle!.getAttribute('cy');
    expect(pCx).toBe('140');
    expect(pCy).toBe('960');

    const planetHaloGrad = gameContainer.querySelector('#space-planet-halo-grad');
    expect(planetHaloGrad).not.toBeNull();
    expect(planetHaloGrad!.getAttribute('cx')).toBe(pCx);
    expect(planetHaloGrad!.getAttribute('cy')).toBe(pCy);

    const planetBodyGrad = gameContainer.querySelector('#space-planet-body-grad');
    expect(planetBodyGrad).not.toBeNull();
    expect(planetBodyGrad!.getAttribute('cx')).toBe(pCx);
    expect(planetBodyGrad!.getAttribute('cy')).toBe(pCy);

    // Sun disk and its glow / disk gradients at (1720, 60)
    const sunDisk = gameContainer.querySelector('.space-sun-disk');
    expect(sunDisk).not.toBeNull();
    const sCx = sunDisk!.getAttribute('cx');
    const sCy = sunDisk!.getAttribute('cy');
    expect(sCx).toBe('1720');
    expect(sCy).toBe('60');

    const sunGlowGrad = gameContainer.querySelector('#space-sun-glow-grad');
    expect(sunGlowGrad).not.toBeNull();
    expect(sunGlowGrad!.getAttribute('cx')).toBe(sCx);
    expect(sunGlowGrad!.getAttribute('cy')).toBe(sCy);

    const sunDiskGrad = gameContainer.querySelector('#space-sun-disk-grad');
    expect(sunDiskGrad).not.toBeNull();
    expect(sunDiskGrad!.getAttribute('cx')).toBe(sCx);
    expect(sunDiskGrad!.getAttribute('cy')).toBe(sCy);
  });

  it('game constellations have at least 6 points and edges connect all points', () => {
    expect(GAME_CONSTELLATIONS.length).toBeGreaterThanOrEqual(5);

    for (const c of GAME_CONSTELLATIONS) {
      expect(c.points.length).toBeGreaterThanOrEqual(6);
      expect(c.edges.length).toBeGreaterThanOrEqual(c.points.length - 1);

      // Verify all points are connected in graph
      const visited = new Set<number>();
      const queue = [0];
      visited.add(0);

      while (queue.length > 0) {
        const u = queue.shift()!;
        for (const [i, j] of c.edges) {
          if (i === u && !visited.has(j)) {
            visited.add(j);
            queue.push(j);
          } else if (j === u && !visited.has(i)) {
            visited.add(i);
            queue.push(i);
          }
        }
      }

      expect(visited.size).toBe(c.points.length);
    }
  });

  it('review chess constellations have at least 9 points and connected edges', () => {
    expect(REVIEW_CONSTELLATIONS.length).toBe(3);

    const names = REVIEW_CONSTELLATIONS.map((c) => c.name);
    expect(names).toContain('Knight');
    expect(names).toContain('King');
    expect(names).toContain('Rook');

    for (const c of REVIEW_CONSTELLATIONS) {
      expect(c.points.length).toBeGreaterThanOrEqual(9);

      // Verify connectedness
      const visited = new Set<number>();
      const queue = [0];
      visited.add(0);

      while (queue.length > 0) {
        const u = queue.shift()!;
        for (const [i, j] of c.edges) {
          if (i === u && !visited.has(j)) {
            visited.add(j);
            queue.push(j);
          } else if (j === u && !visited.has(i)) {
            visited.add(i);
            queue.push(i);
          }
        }
      }

      expect(visited.size).toBe(c.points.length);
    }
  });

  it('space scenes are deterministic with identical markup on re-renders', () => {
    const game1 = buildGameScene();
    const game2 = buildGameScene();
    expect(game1).toBe(game2);

    const review1 = buildReviewScene();
    const review2 = buildReviewScene();
    expect(review1).toBe(review2);
  });

  it('no stars are generated inside exclusion zones or center chessboard area', () => {
    const circles = [
      { cx: 1720, cy: 60, r: 430 },
      { cx: 140, cy: 960, r: 310 },
      { cx: 1700, cy: 880, r: 180 },
    ];
    const rects = [{ x1: 400, y1: 120, x2: 1520, y2: 950 }];

    const { small, medium, large, sparkles } = generateStars(
      12345678,
      circles,
      rects,
      180,
      22
    );
    const allStars = [...small, ...medium, ...large, ...sparkles];

    expect(allStars.length).toBeGreaterThanOrEqual(150);

    for (const p of allStars) {
      for (const c of circles) {
        const d = Math.hypot(p.x - c.cx, p.y - c.cy);
        expect(d).toBeGreaterThanOrEqual(c.r);
      }
      const inCenterRect =
        p.x >= rects[0].x1 &&
        p.x <= rects[0].x2 &&
        p.y >= rects[0].y1 &&
        p.y <= rects[0].y2;
      expect(inCenterRect).toBe(false);
    }
  });

  it('space scenes contain no blur or backdrop-filter and static SVG is not animated', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const spaceRules = css.match(/\.(?:space|game-solar|review-solar)-[^{]*\{([^}]*)\}/g);
    expect(spaceRules).not.toBeNull();

    for (const rule of spaceRules!) {
      expect(rule).not.toContain('backdrop-filter');
      expect(rule).not.toMatch(/filter:\s*blur/);
    }

    const staticRules = css.match(/\.(?:space-static-svg|space-constellations|space-asteroid-track|space-sun-cluster|space-planet-cluster)[^{]*\{([^}]*)\}/g);
    expect(staticRules).not.toBeNull();
    for (const rule of staticRules!) {
      expect(rule).not.toMatch(/\banimation:/);
    }
  });

  it('review scene is first child of review-overlay and differs from game scene', () => {
    const reviewOverlay = document.getElementById('review-overlay');
    expect(reviewOverlay).not.toBeNull();

    const firstChild = reviewOverlay!.firstElementChild as HTMLElement;
    expect(firstChild).not.toBeNull();
    expect(firstChild.id).toBe('review-solar-scene');
    expect(firstChild.classList.contains('review-solar-scene')).toBe(true);

    const gameSceneMarkup = buildGameScene();
    const reviewSceneMarkup = buildReviewScene();
    expect(gameSceneMarkup).not.toBe(reviewSceneMarkup);
    expect(reviewSceneMarkup).toContain('space-eclipse-cluster');
    expect(reviewSceneMarkup).toContain('space-comet-cluster');
  });

  it('game-solar-bg is hidden when review overlay opens and restored on close', () => {
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

    const gameSolarBg = document.getElementById('game-solar-bg');
    expect(gameSolarBg).not.toBeNull();
    expect(gameSolarBg!.style.display).toBe('block');

    // Fool's mate
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    // Open review overlay
    const reviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    expect(reviewBtn).not.toBeNull();
    reviewBtn.click();

    // In Stage A2c-7, game-solar-bg is explicitly hidden under review overlay
    expect(gameSolarBg!.style.display).toBe('none');

    // Close review overlay
    const closeBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    // Restored to block on game screen
    expect(gameSolarBg!.style.display).toBe('block');
  });

  it('light theme space variables differ from dark theme in CSS', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
    const lightMatch = css.match(/\[data-theme='light'\]\s*\{([^}]*)\}/);
    expect(rootMatch).not.toBeNull();
    expect(lightMatch).not.toBeNull();

    const rootConstellation = rootMatch![1].match(/--constellation-line:\s*([^;]+);/);
    const lightConstellation = lightMatch![1].match(/--constellation-line:\s*([^;]+);/);

    expect(rootConstellation).not.toBeNull();
    expect(lightConstellation).not.toBeNull();
    expect(rootConstellation![1].trim()).not.toBe(lightConstellation![1].trim());

    // Verify all requested variable categories exist on :root
    expect(rootMatch![1]).toMatch(/--star-/);
    expect(rootMatch![1]).toMatch(/--constellation-/);
    expect(rootMatch![1]).toMatch(/--sun-/);
    expect(rootMatch![1]).toMatch(/--planet-/);
    expect(rootMatch![1]).toMatch(/--comet-/);
    expect(rootMatch![1]).toMatch(/--nebula-/);
    expect(rootMatch![1]).toMatch(/--eclipse-/);
  });

  it('gap-lg is declared with at least 20px desktop and review panels have no negative margins', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Check --gap-lg: 22px
    const gapMatch = css.match(/--gap-lg:\s*(\d+)px/);
    expect(gapMatch).not.toBeNull();
    const gapVal = parseInt(gapMatch![1], 10);
    expect(gapVal).toBeGreaterThanOrEqual(20);

    // Check review-panel, review-results-section, review-overlay-side-col use gap: var(--gap-lg)
    expect(css).toMatch(/\.review-panel\s*\{[^}]*gap:\s*var\(--gap-lg\);/);
    expect(css).toMatch(/\.review-results-section\s*\{[^}]*gap:\s*var\(--gap-lg\);/);
    expect(css).toMatch(/\.review-overlay-side-col\s*\{[^}]*gap:\s*var\(--gap-lg\);/);

    // Check accuracies and classes gap is 16px
    expect(css).toMatch(/\.review-accuracies\s*\{[^}]*gap:\s*16px;/);
    expect(css).toMatch(/\.review-classes-grid\s*\{[^}]*gap:\s*16px;/);

    // Check section titles have margin-bottom: 12px
    expect(css).toMatch(/review-subtitle\s*\{[^}]*margin-bottom:\s*12px;/);
    expect(css).toMatch(/\.classes-col-header\s*\{[^}]*margin-bottom:\s*12px;/);

    // Verify no negative margins in review panel rules
    const reviewRules = css.match(/\.(?:review|accuracy|classes|key-moment)[^{]*\{([^}]*)\}/g);
    expect(reviewRules).not.toBeNull();
    for (const rule of reviewRules!) {
      expect(rule).not.toMatch(/margin(?:-[a-z]+)?:\s*-\d+/);
    }
  });

  it('space scene markups contain no emoji characters', () => {
    const gameMarkup = buildGameScene();
    const reviewMarkup = buildReviewScene();

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(gameMarkup)).toBe(false);
    expect(emojiRegex.test(reviewMarkup)).toBe(false);
  });
});

