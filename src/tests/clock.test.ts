import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessStore } from '@/state/store';

describe('Chess Clock Integration in Store', () => {
  let store: ChessStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ChessStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('time ticks after move and freezes after checkmate', () => {
    const scholarsMateFen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    store.loadFEN(scholarsMateFen);
    store.setClockMode('blitz-3-2');

    expect(store.getGameResult().type).toBe('checkmate');

    const frozenWhiteTime = store.getTime('white');
    const frozenBlackTime = store.getTime('black');

    vi.advanceTimersByTime(10000);

    expect(store.getTime('white')).toBe(frozenWhiteTime);
    expect(store.getTime('black')).toBe(frozenBlackTime);
  });

  it('undo restores time snapshot before the move', () => {
    store.setClockMode('blitz-5-0');
    const startBlackTime = store.getTime('black');

    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // white e4

    vi.advanceTimersByTime(3000); // 3s elapsed for black thinking
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3)); // black e5
    store.undo(); // undo black move

    expect(store.getTime('black')).toBe(startBlackTime);
  });

  it('viewing history does not change clock and returning resumes it', () => {
    store.setClockMode('blitz-3-2');
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    vi.advanceTimersByTime(3000);
    const timeDuringGame = store.getTime('black');

    store.setViewIndex(0);
    vi.advanceTimersByTime(10000);

    store.setViewIndex(null);
    expect(store.getTime('black')).toBe(timeDuringGame);
  });

  it('undoing from checkmate makes clock resume', () => {
    const pgn = `
[Event "Scholar's Mate"]
[Site "Chess Arena"]
[Date "2026.10.17"]
[Round "1"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    `;
    store.loadPGN(pgn);
    store.setClockMode('blitz-3-2');

    expect(store.getGameResult().type).toBe('checkmate');
    expect(store.isClockActive()).toBe(false);

    store.undo();
    expect(store.getGameResult().type).toBe('ongoing');
    expect(store.isClockActive()).toBe(true);
  });

  it('timeout ends game and stops clock', () => {
    let timedOut: string | null = null;
    store.setClockMode('bullet-1-0', (loser) => {
      timedOut = loser;
    });
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));

    vi.advanceTimersByTime(61000);
    expect(timedOut).toBe('black');
    expect(store.isClockActive()).toBe(false);
  });
});
