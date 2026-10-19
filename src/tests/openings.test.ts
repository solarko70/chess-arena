import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  OPENING_DATABASE,
  identifyOpening,
  extractSanList,
  classifyMove,
  MOVE_CLASS_REGISTRY,
  getMoveClassMeta,
  type GameReviewResult,
} from '@/analysis';
import { ChessStore } from '@/state/store';
import { GameOverModalUI } from '@/ui/gameovermodal';
import { ReviewPanelUI } from '@/ui/reviewpanel';
import { HistoryUI } from '@/ui/history';

describe('Stage 4d-2: Opening book, ECO identification, and opening move class', () => {
  it('opening database contains at least 120 standard variations', () => {
    expect(OPENING_DATABASE.length).toBeGreaterThanOrEqual(120);
    for (const op of OPENING_DATABASE) {
      expect(op.eco).toMatch(/^[A-E]\d{2}$/);
      expect(op.name.length).toBeGreaterThan(0);
      expect(op.moves.length).toBeGreaterThan(0);
    }
  });

  it('extractSanList parses string array into SAN list', () => {
    expect(extractSanList(['e4', 'e5'])).toEqual(['e4', 'e5']);
  });

  it('MOVE_CLASS_REGISTRY includes opening class at order 0', () => {
    expect(MOVE_CLASS_REGISTRY[0].id).toBe('opening');
    expect(MOVE_CLASS_REGISTRY[0].order).toBe(0);
  });

  it('identifies Italian game from SAN move sequence', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
    const opening = identifyOpening(moves);
    expect(opening).not.toBeNull();
    expect(opening?.eco).toBe('C50');
    expect(opening?.name).toBe('Итальянская партия');
    expect(opening?.plies).toBe(6);
  });

  it('identifies Sicilian Najdorf variation from SAN moves', () => {
    const moves = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'];
    const opening = identifyOpening(moves);
    expect(opening).not.toBeNull();
    expect(opening?.eco).toBe('B90');
    expect(opening?.name).toContain('Найдорф');
    expect(opening?.plies).toBe(10);
  });

  it('returns deepest matched opening when played moves extend beyond book', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'h3', 'd6'];
    const opening = identifyOpening(moves);
    expect(opening).not.toBeNull();
    expect(opening?.eco).toBe('C50');
    expect(opening?.name).toBe('Итальянская партия');
    expect(opening?.plies).toBe(6);
  });

  it('returns null for empty moves or non-standard first move', () => {
    expect(identifyOpening([])).toBeNull();
    expect(identifyOpening(['h4', 'h5'])).toBeNull();
    expect(identifyOpening(['a4'])).toBeNull();
  });

  it('identifies opening from GameState history with Move objects', () => {
    const store = new ChessStore();
    // 1. e4 e5
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    // 2. Nf3 Nc6
    store.makeMove(store.coordsToSquare(6, 7), store.coordsToSquare(5, 5));
    store.makeMove(store.coordsToSquare(1, 0), store.coordsToSquare(2, 2));
    // 3. Bc4 Bc5
    store.makeMove(store.coordsToSquare(5, 7), store.coordsToSquare(2, 4));
    store.makeMove(store.coordsToSquare(5, 0), store.coordsToSquare(2, 3));

    const opening = identifyOpening(store.getLiveState().history);
    expect(opening).not.toBeNull();
    expect(opening?.eco).toBe('C50');
    expect(opening?.name).toBe('Итальянская партия');
    expect(opening?.plies).toBe(6);
  });

  it('classifyMove returns opening class with zero loss when isBookMove is true', () => {
    const res = classifyMove({
      winBefore: 50,
      winAfter: 48,
      isBookMove: true,
    });
    expect(res.moveClass).toBe('opening');
    expect(res.label).toBe('дебютный ход');
    expect(res.loss).toBe(0);
    expect(res.onlyMove).toBe(false);
  });

  it('classifyMove classifies move normally when isBookMove is false', () => {
    const res = classifyMove({
      winBefore: 50,
      winAfter: 49.8,
      isBookMove: false,
    });
    expect(res.moveClass).toBe('best');
    expect(res.loss).toBeCloseTo(0.2, 1);
  });

  it('opening metadata in registry has valid SVG vector icon without emojis', () => {
    const meta = getMoveClassMeta('opening');
    expect(meta).toBeDefined();
    expect(meta.id).toBe('opening');
    expect(meta.nameRu).toBe('Дебютный ход');
    expect(meta.shortRu).toBe('Дебют');
    expect(meta.cssVar).toBe('--class-opening');
    expect(meta.color).toBe('#94723c');
    expect(meta.order).toBe(0);
    expect(meta.showInSummary).toBe(true);

    // SVG icon must be clean vector without emojis
    expect(meta.svg).toMatch(/^<svg\b/);
    expect(meta.svg).toMatch(/<\/svg>$/);
    expect(meta.svg).toContain('viewBox="0 0 24 24"');
    expect(meta.svg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

    const parser = new DOMParser();
    const doc = parser.parseFromString(meta.svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('path')).not.toBeNull();
  });

  describe('UI components rendering opening badge', () => {
    let container: HTMLElement;
    let store: ChessStore;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      store = new ChessStore();
    });

    afterEach(() => {
      container.remove();
    });

    it('GameOverModalUI displays opening badge with ECO and name', () => {
      const modal = new GameOverModalUI(container, store);
      expect(modal).toBeDefined();

      // Play 1. e4 e5
      store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
      store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));

      modal.show();
      const badge = container.querySelector('#game-over-opening-badge') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.style.display).not.toBe('none');
      expect(badge.textContent).toContain('C20');
      expect(badge.textContent).toContain('Открытый дебют');
    });

    it('ReviewPanelUI displays opening badge in resultsSection', () => {
      const panel = new ReviewPanelUI(container, store);
      expect(panel).toBeDefined();

      const mockReview: GameReviewResult = {
        engineName: 'MockEngine',
        reanalyzed: 0,
        accuracy: { white: 95, black: 90 },
        counts: {
          white: { opening: 3, best: 2, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
          black: { opening: 3, best: 1, excellent: 1, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        },
        keyMoments: [],
        evalHistory: [],
        opening: {
          eco: 'C50',
          name: 'Итальянская партия',
          plies: 6,
        },
        moves: [],
      };

      store.setReviewResult(mockReview);
      store.setReviewMode(true);

      const badge = container.querySelector('#review-opening-badge') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.style.display).not.toBe('none');
      expect(badge.textContent).toContain('C50');
      expect(badge.textContent).toContain('Итальянская партия');
    });

    it('HistoryUI displays history-opening-badge during review mode', () => {
      const historyUI = new HistoryUI(container, store);
      expect(historyUI).toBeDefined();

      // Play 1. e4 e5
      store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
      store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));

      const mockReview: GameReviewResult = {
        engineName: 'MockEngine',
        reanalyzed: 0,
        accuracy: { white: 90, black: 90 },
        counts: {
          white: { opening: 1, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
          black: { opening: 1, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        },
        keyMoments: [],
        evalHistory: [],
        opening: {
          eco: 'C20',
          name: 'Открытый дебют',
          plies: 2,
        },
        moves: [],
      };

      store.setReviewResult(mockReview);
      store.setReviewMode(true);

      const badge = container.querySelector('#history-opening-badge') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.style.display).not.toBe('none');
      expect(badge.textContent).toContain('C20');
      expect(badge.textContent).toContain('Открытый дебют');
    });
  });
});

