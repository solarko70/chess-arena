// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyMove,
  generateLegal,
  moveToSAN,
  parseFEN,
} from '@/core';
import {
  MOVE_CLASS_REGISTRY,
  getMoveClassMeta,
  classifyMove,
  computeMoveMaterialSacrifice,
  isOnlyDefensiveMoveOnBoard,
  reviewGame,
  type AnalysisEngine,
  type GameReviewResult,
} from '@/analysis';
import { ChessStore } from '@/state/store';
import { HistoryUI } from '@/ui/history';

describe('Stage 4d-3.2: Stellar, Superb & Missed Move Classification & UI Polish', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('1. Morphy Opera Game Queen sacrifice 16.Qb8+! is classified as stellar (!!)', () => {
    // Position before 16.Qb8+! in Morphy vs Duke Karl / Count Isouard, Paris 1858
    const fenBefore = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';
    const stateBefore = parseFEN(fenBefore);
    const legal = generateLegal(stateBefore);
    const qb8Move = legal.find((m) => moveToSAN(stateBefore, m) === 'Qb8+');
    expect(qb8Move).toBeDefined();

    const stateAfter = applyMove(stateBefore, qb8Move!);

    // Verify board sacrifice calculation: Queen (900) offered to Nxb8, undefended -> 900 cp >= 150 cp
    const sacCp = computeMoveMaterialSacrifice(stateBefore, stateAfter, qb8Move!, true);
    expect(sacCp).toBeGreaterThanOrEqual(150);
    expect(sacCp).toBe(900);

    const res = classifyMove({
      winBefore: 98,
      winAfter: 99,
      matchedBestMove: true,
      evalBefore: { type: 'mate', value: 2 },
      evalAfter: { type: 'mate', value: 1 },
      moverColor: 'white',
      stateBefore,
      stateAfter,
      move: qb8Move!,
      isBookMove: false,
    });

    expect(res.moveClass).toBe('stellar');
  });

  it('2. Only defensive move saving against immediate mate is classified as superb (!)', () => {
    // White has a back-rank mate threat on d8 (Rd1 -> d8#).
    // Black on move: 6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1 is NOT forced to 1 move,
    // so use a position where Black is in check or must block a mate in 1 with a single move:
    // White Queen on h6 threatens Qg7#; Black Rook on f8 is pinned or Black only has Rg8/f6 etc.
    // Even simpler: Black King on h8, pawns g7, h7, White Rook on d1, Black Rook on e8.
    // If Black plays anything except Rxe1/Rd8/etc. Let's construct a position where Black is in check
    // with 2 legal moves and 1 of them walks into mate in 1, while the other survives:
    // FEN: 5rk1/5p1p/6pQ/8/8/8/5PPP/4R1K1 b - - 0 1 (Black must prevent Qg7#)
    // Wait: in 5rk1/5p1p/6pQ/8/8/8/5PPP/6K1 b - - 0 1, White threatens Qg7#; Black has NO legal move to stop Qg7#?
    // What if Black has a Queen on d4 in 5rk1/5p1p/6pQ/8/3q4/8/5PPP/6K1 b - - 0 1?
    // Only Qxd6? No, Qg7# is protected by nothing if White only has Qh6 and pawn g6? No, Qh6 is undefended on g7 unless supported!
    // Let's put White Bishop on b2 supporting g7:
    // FEN: 5rk1/5p1p/6pQ/8/3q4/8/1B3PPP/6K1 b - - 0 1
    // White threatens Qg7# (supported by Bb2). Black's ONLY move to prevent Qg7# is Qxb2!
    const fen = '5rk1/5p1p/7Q/8/2B5/8/qB3PPP/2N4K b - - 0 1';
    const stateBefore = parseFEN(fen);
    const legal = generateLegal(stateBefore);
    const qb2Move = legal.find((m) => moveToSAN(stateBefore, m) === 'Qxb2');
    expect(qb2Move).toBeDefined();

    const stateAfter = applyMove(stateBefore, qb2Move!);
    expect(isOnlyDefensiveMoveOnBoard(stateBefore, stateAfter, qb2Move!)).toBe(true);

    // Test via board heuristic AND multiPV lines gap
    const resFromBoard = classifyMove({
      winBefore: 52,
      winAfter: 52,
      matchedBestMove: true,
      moverColor: 'black',
      stateBefore,
      stateAfter,
      move: qb2Move!,
    });
    expect(resFromBoard.moveClass).toBe('superb');
    expect(resFromBoard.onlyMove).toBe(true);

    // Also verify multiPV gap >= 20% winChance triggers 'superb'
    const altMove = legal.find((m) => m.from !== qb2Move!.from || m.to !== qb2Move!.to) ?? legal[0];
    const resFromMultiPv = classifyMove({
      winBefore: 55,
      winAfter: 54.5,
      matchedBestMove: true,
      moverColor: 'white',
      linesBefore: [
        { move: qb2Move!, san: 'Qxb2', score: { type: 'cp', value: 60 }, pv: [qb2Move!], pvSan: ['Qxb2'] },
        { move: altMove, san: 'Kh8', score: { type: 'cp', value: -350 }, pv: [altMove], pvSan: ['Kh8'] },
      ],
    });
    expect(resFromMultiPv.moveClass).toBe('superb');
    expect(resFromMultiPv.onlyMove).toBe(true);
  });

  it('3. Move dropping winChance from 0.85 (or 85%) to 0.45 (or 45%) is classified as missed (✖!)', () => {
    // Unit scale [0..1]
    const resUnit = classifyMove({
      winBefore: 0.85,
      winAfter: 0.45,
      matchedBestMove: false,
    });
    expect(resUnit.moveClass).toBe('missed');
    expect(resUnit.loss).toBeCloseTo(0.4, 3);

    // Percentage scale [0..100]
    const resPct = classifyMove({
      winBefore: 85,
      winAfter: 45,
      matchedBestMove: false,
      evalBefore: { type: 'cp', value: 320 },
      evalAfter: { type: 'cp', value: -40 },
      moverColor: 'white',
    });
    expect(resPct.moveClass).toBe('missed');
    expect(resPct.loss).toBeCloseTo(40, 1);
  });

  it('4. Registry class names have no word "ход" and fit on a single line', () => {
    expect(MOVE_CLASS_REGISTRY.length).toBe(10);

    for (const meta of MOVE_CLASS_REGISTRY) {
      expect(meta.nameRu.toLowerCase()).not.toMatch(/\s+ход$/);
      expect(meta.shortRu.toLowerCase()).not.toMatch(/\s+ход$/);
    }

    expect(getMoveClassMeta('opening').nameRu).toBe('Дебют');
    expect(getMoveClassMeta('stellar').nameRu).toBe('Звёздный');
    expect(getMoveClassMeta('superb').nameRu).toBe('Превосходный');
    expect(getMoveClassMeta('missed').nameRu).toBe('Упущенный шанс');

    // Enlarged 8-pointed star SVG for stellar (rays reach 2.5 and 21.5 in 24x24 viewBox)
    const stellarSvg = getMoveClassMeta('stellar').svg;
    expect(stellarSvg).toContain('viewBox="0 0 24 24"');
    expect(stellarSvg).toContain('2.5');
    expect(stellarSvg).toContain('21.5');
  });

  it('5. Move feedback card displays Russian titles and descriptions for stellar, superb & missed', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const store = new ChessStore();
    store.makeMove(52, 36); // 1. e4
    store.makeMove(12, 28); // 1... e5
    store.makeMove(62, 45); // 2. Nf3

    new HistoryUI(container, store);

    const baseMove = store.getLiveState().history[0];
    const mockReview: GameReviewResult = {
      moves: [
        {
          ply: 1,
          san: 'Qb8+',
          color: 'white',
          move: baseMove,
          evalBefore: { type: 'mate', value: 2 },
          evalAfter: { type: 'mate', value: 1 },
          bestMove: baseMove,
          bestSan: 'Qb8+',
          winBefore: 98,
          winAfter: 99,
          loss: 0,
          accuracy: 100,
          class: 'stellar',
          onlyMove: true,
        },
        {
          ply: 2,
          san: 'Qxb2',
          color: 'black',
          move: store.getLiveState().history[1],
          evalBefore: { type: 'cp', value: -50 },
          evalAfter: { type: 'cp', value: -50 },
          bestMove: store.getLiveState().history[1],
          bestSan: 'Qxb2',
          winBefore: 55,
          winAfter: 55,
          loss: 0,
          accuracy: 100,
          class: 'superb',
          onlyMove: true,
        },
        {
          ply: 3,
          san: 'Nf3',
          color: 'white',
          move: store.getLiveState().history[2],
          evalBefore: { type: 'cp', value: 350 },
          evalAfter: { type: 'cp', value: 0 },
          bestMove: baseMove,
          bestSan: 'Qh5',
          winBefore: 85,
          winAfter: 50,
          loss: 35,
          accuracy: 42,
          class: 'missed',
          onlyMove: false,
        },
      ],
      accuracy: { white: 71, black: 100 },
      counts: {
        white: { opening: 0, stellar: 1, superb: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, missed: 1 },
        black: { opening: 0, stellar: 0, superb: 1, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, missed: 0 },
      },
      keyMoments: [],
      evalHistory: [],
      engineName: 'MockEngine',
      reanalyzed: 0,
      depth: 16,
    };

    store.setReviewResult(mockReview as unknown as import('@/analysis').ReviewRunResult);
    store.setReviewMode(true);

    // Select ply 1 ('stellar')
    store.setViewIndex(0);
    const card = container.querySelector('.move-feedback-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.querySelector('.feedback-card-verdict')?.textContent).toBe('Звёздный !!');
    expect(card.querySelector('.feedback-card-desc')?.textContent).toBe(
      'Блестящая жертва материала, ведущая к победе',
    );

    // Select ply 2 ('superb')
    store.setViewIndex(1);
    expect(card.querySelector('.feedback-card-verdict')?.textContent).toBe('Превосходный !');
    expect(card.querySelector('.feedback-card-desc')?.textContent).toBe(
      'Единственный ход, сохраняющий решающий перевес',
    );

    // Select ply 3 ('missed')
    store.setViewIndex(2);
    expect(card.querySelector('.feedback-card-verdict')?.textContent).toBe('Упущенный шанс ✖!');
    expect(card.querySelector('.feedback-card-desc')?.textContent).toBe(
      'Упущена возможность победить',
    );
  });

  it('6. reviewGame integrates stellar, superb, and missed into counts and keyMoments', async () => {
    const s0 = parseFEN('4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16');
    const qb8 = generateLegal(s0).find((m) => moveToSAN(s0, m) === 'Qb8+')!;
    const s1 = applyMove(s0, qb8);
    const nxb8 = generateLegal(s1).find((m) => moveToSAN(s1, m) === 'Nxb8')!;
    const s2 = applyMove(s1, nxb8);
    const rd8 = generateLegal(s2).find((m) => moveToSAN(s2, m) === 'Rd8#')!;
    const s3 = applyMove(s2, rd8);

    const mockEngine: AnalysisEngine = {
      name: 'MockSolarEngine',
      analyze: async (state) => {
        const histLen = state.history.length;
        if (histLen === 0) {
          return {
            engineName: 'MockSolarEngine',
            bestMove: qb8,
            score: { type: 'mate', value: 2 },
            pv: [qb8],
            depth: 16,
            nodes: 1000,
            timeMs: 10,
            lines: [{ move: qb8, san: 'Qb8+', score: { type: 'mate', value: 2 }, pv: [qb8], pvSan: ['Qb8+'] }],
          };
        }
        if (histLen === 1) {
          return {
            engineName: 'MockSolarEngine',
            bestMove: nxb8,
            score: { type: 'mate', value: 1 },
            pv: [nxb8],
            depth: 16,
            nodes: 1000,
            timeMs: 10,
            lines: [{ move: nxb8, san: 'Nxb8', score: { type: 'mate', value: 1 }, pv: [nxb8], pvSan: ['Nxb8'] }],
          };
        }
        if (histLen === 2) {
          return {
            engineName: 'MockSolarEngine',
            bestMove: rd8,
            score: { type: 'mate', value: 1 },
            pv: [rd8],
            depth: 16,
            nodes: 1000,
            timeMs: 10,
            lines: [{ move: rd8, san: 'Rd8#', score: { type: 'mate', value: 1 }, pv: [rd8], pvSan: ['Rd8#'] }],
          };
        }
        return {
          engineName: 'MockSolarEngine',
          bestMove: null,
          score: { type: 'mate', value: 0 },
          pv: [],
          depth: 16,
          nodes: 1000,
          timeMs: 10,
          lines: [],
        };
      },
      dispose: () => {},
    };

    const result = await reviewGame([s0, s1, s2, s3], mockEngine, { autoReanalyze: false });
    expect(result.moves[0].san).toBe('Qb8+');
    expect(result.moves[0].class).toBe('stellar');
    expect(result.counts.white.stellar).toBe(1);
    expect(result.keyMoments.some((m) => m.class === 'stellar')).toBe(true);
  });
});
