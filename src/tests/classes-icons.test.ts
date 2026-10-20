import * as path from 'node:path';
import * as fs from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MOVE_CLASS_REGISTRY, getMoveClassMeta, getMoveClassSvg } from '@/analysis';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { HistoryUI } from '@/ui/history';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

describe('Stage A3.2: Move class SVG icons geometry and board integration', () => {
  it('all classes from registry return valid svg markup with viewbox', () => {
    expect(MOVE_CLASS_REGISTRY.length).toBe(10);

    const EXPECTED_COLORS: Record<string, { color: string; cssVar: string }> = {
      opening: { color: '#94723c', cssVar: '--class-opening' },
      stellar: { color: '#c026d3', cssVar: '--class-stellar' },
      superb: { color: '#ec4899', cssVar: '--class-superb' },
      best: { color: '#f59e0b', cssVar: '--class-best' },
      excellent: { color: '#06b6d4', cssVar: '--class-excellent' },
      good: { color: '#10b981', cssVar: '--class-good' },
      inaccuracy: { color: '#eab308', cssVar: '--class-inaccuracy' },
      mistake: { color: '#f97316', cssVar: '--class-mistake' },
      blunder: { color: '#ef4444', cssVar: '--class-blunder' },
      missed: { color: '#e11d48', cssVar: '--class-missed' },
    };

    for (const meta of MOVE_CLASS_REGISTRY) {
      const svg = meta.svg;
      expect(svg).toMatch(/^<svg\b/);
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(svg).toContain('aria-hidden="true"');

      // No emojis in SVG markup
      expect(svg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

      // Verify colors and CSS variable mapping
      const exp = EXPECTED_COLORS[meta.id];
      expect(exp).toBeDefined();
      expect(meta.color).toBe(exp.color);
      expect(meta.cssVar).toBe(exp.cssVar);

      // Verify SVG can be parsed by DOMParser without error
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      expect(parserError).toBeNull();

      const svgEl = doc.querySelector('svg');
      expect(svgEl).not.toBeNull();
      expect(svgEl?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svgEl?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    }
  });

  it('good and excellent markups have stroke round caps and fill none', () => {
    const goodSvg = getMoveClassSvg('good');
    expect(goodSvg).toContain('fill="none"');
    expect(goodSvg).toContain('stroke-linecap="round"');
    expect(goodSvg).toContain('stroke-linejoin="round"');
    expect(goodSvg).toMatch(/stroke-width="(2\.[4-9]|3(\.0)?)"/);

    const excellentSvg = getMoveClassSvg('excellent');
    expect(excellentSvg).toContain('fill="none"');
    expect(excellentSvg).toContain('stroke-linecap="round"');
    expect(excellentSvg).toContain('stroke-linejoin="round"');
    expect(excellentSvg).toMatch(/stroke-width="(2\.[4-6])"/);

    // Parse excellent SVG and verify two parallel strokes
    const parser = new DOMParser();
    const doc = parser.parseFromString(excellentSvg, 'image/svg+xml');
    const paths = doc.querySelectorAll('path, polyline');
    expect(paths.length).toBe(2);

    for (let i = 0; i < paths.length; i++) {
      expect(paths[i].getAttribute('fill')).toBe('none');
      expect(paths[i].getAttribute('stroke-linecap')).toBe('round');
      expect(paths[i].getAttribute('stroke-linejoin')).toBe('round');
    }
  });

  it('mistake inaccuracy blunder symbols are centered with weight 900', () => {
    const parser = new DOMParser();

    for (const id of ['mistake', 'inaccuracy', 'blunder'] as const) {
      const meta = getMoveClassMeta(id);
      const doc = parser.parseFromString(meta.svg, 'image/svg+xml');
      const textEl = doc.querySelector('text');

      expect(textEl).not.toBeNull();
      expect(textEl?.getAttribute('text-anchor')).toBe('middle');
      expect(textEl?.getAttribute('font-weight')).toBe('900');
      expect(textEl?.getAttribute('x')).toBe('12');

      const fontSize = parseFloat(textEl?.getAttribute('font-size') || '0');
      // Height should be 60-65% of circle diameter (fontSize between 15 and 20)
      expect(fontSize).toBeGreaterThanOrEqual(15);
      expect(fontSize).toBeLessThanOrEqual(20);

      // Verify no syntax artifacts
      const content = textEl?.textContent?.trim();
      if (id === 'mistake') expect(content).toBe('?');
      if (id === 'inaccuracy') expect(content).toBe('?!');
      if (id === 'blunder') expect(content).toBe('??');
    }
  });


  it('stellar, superb and missed icons have valid vector geometry', () => {
    const stellarSvg = getMoveClassSvg('stellar');
    expect(stellarSvg).toContain('viewBox="0 0 24 24"');
    expect(stellarSvg).toContain('fill="white"');
    expect(stellarSvg).toContain('12 2'); // Top tip

    const superbSvg = getMoveClassSvg('superb');
    expect(superbSvg).toContain('viewBox="0 0 24 24"');
    expect(superbSvg).toContain('fill="white"');
    expect(superbSvg).toContain('4 4'); // Diagonal ray

    const missedSvg = getMoveClassSvg('missed');
    expect(missedSvg).toContain('viewBox="0 0 24 24"');
    expect(missedSvg).toContain('<circle');
    expect(missedSvg).toContain('<path');
  });

  it('inaccuracy and blunder use separate tspans with clear spacing', () => {
    const parser = new DOMParser();

    // Inaccuracy has two tspans (? and !)
    const inaccSvg = getMoveClassSvg('inaccuracy');
    const inaccDoc = parser.parseFromString(inaccSvg, 'image/svg+xml');
    const inaccTspans = inaccDoc.querySelectorAll('tspan');
    expect(inaccTspans.length).toBe(2);
    expect(inaccTspans[0].textContent).toBe('?');
    expect(inaccTspans[1].textContent).toBe('!');
    const xQ = parseFloat(inaccTspans[0].getAttribute('x') || '0');
    const xEx = parseFloat(inaccTspans[1].getAttribute('x') || '0');
    // Distance between centers is ~7.6px giving a clear ~2.9px gap between symbols
    expect(xEx - xQ).toBeGreaterThanOrEqual(7);
    expect(xEx - xQ).toBeLessThanOrEqual(8.5);

    // Blunder has two symmetric tspans (? and ?)
    const blunderSvg = getMoveClassSvg('blunder');
    const blunderDoc = parser.parseFromString(blunderSvg, 'image/svg+xml');
    const blunderTspans = blunderDoc.querySelectorAll('tspan');
    expect(blunderTspans.length).toBe(2);
    expect(blunderTspans[0].textContent).toBe('?');
    expect(blunderTspans[1].textContent).toBe('?');
    const xB1 = parseFloat(blunderTspans[0].getAttribute('x') || '0');
    const xB2 = parseFloat(blunderTspans[1].getAttribute('x') || '0');
    // Symmetrical around 12 (7 and 17)
    expect((xB1 + xB2) / 2).toBe(12);
    expect(xB2 - xB1).toBe(10);
  });

  it('board move badge styles use 100% width and overflow visible', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toMatch(/\.board-move-badge\s*\{[^}]*padding:\s*0;/);
    expect(css).toMatch(/width:\s*100%;\s*height:\s*100%;\s*display:\s*block;\s*overflow:\s*visible;/);
  });

  describe('UI integration', () => {
    let container: HTMLElement;
    let store: ChessStore;
    let board: ChessBoardUI;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      store = new ChessStore();
      board = new ChessBoardUI(container, store);
      expect(board).toBeDefined();
    });

    afterEach(() => {
      container.remove();
    });

    it('board badge renders registry svg with preserve aspect ratio', () => {
      const mockReview: GameReviewResult = {
        engineName: 'MockEngine',
        reanalyzed: 0,
        accuracy: { white: 90, black: 75 },
        counts: {
          white: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
          black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        },
        keyMoments: [],
        evalHistory: [],
        moves: [
          {
            ply: 1,
            san: 'e4',
            color: 'white',
            move: { from: 52, to: 36 } as unknown as Move,
            evalBefore: { type: 'cp', value: 20 },
            evalAfter: { type: 'cp', value: 30 },
            bestMove: null,
            bestSan: null,
            winBefore: 50,
            winAfter: 52,
            loss: 0,
            accuracy: 100,
            class: 'best',
            onlyMove: false,
          },
        ],
      };

      store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
      store.setReviewResult(mockReview);
      store.setReviewMode(true);
      store.setViewIndex(0);

      const badge = container.querySelector('.board-move-badge') as HTMLElement;
      expect(badge).not.toBeNull();

      const svg = badge.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('history moves render review-move-badge with registry svg icon', () => {
      const historyContainer = document.createElement('div');
      document.body.appendChild(historyContainer);
      const historyUI = new HistoryUI(historyContainer, store);
      expect(historyUI).toBeDefined();

      const mockReview: GameReviewResult = {
        engineName: 'MockEngine',
        reanalyzed: 0,
        accuracy: { white: 90, black: 75 },
        counts: {
          white: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
          black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        },
        keyMoments: [],
        evalHistory: [],
        moves: [
          {
            ply: 1,
            san: 'e4',
            color: 'white',
            move: { from: 52, to: 36 } as unknown as Move,
            evalBefore: { type: 'cp', value: 20 },
            evalAfter: { type: 'cp', value: 30 },
            bestMove: null,
            bestSan: null,
            winBefore: 50,
            winAfter: 52,
            loss: 0,
            accuracy: 100,
            class: 'best',
            onlyMove: false,
          },
        ],
      };

      store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
      store.setReviewResult(mockReview);
      store.setReviewMode(true);

      const reviewBadge = historyContainer.querySelector('.review-move-badge') as HTMLElement;
      expect(reviewBadge).not.toBeNull();
      expect(reviewBadge.dataset.class).toBe('best');

      const svg = reviewBadge.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');

      historyContainer.remove();
    });
  });
});
