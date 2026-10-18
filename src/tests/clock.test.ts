import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessStore } from '@/state/store';
import { ClockWidget } from '@/ui/clockwidget';

describe('Chess Clock Integration & Navigation Tests', () => {
  let store: ChessStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ChessStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('viewing history does not pause clock; time continues ticking', () => {
    store.setClockMode('blitz-3-2');
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // 1. e4
    vi.advanceTimersByTime(2000);

    const timeBeforeViewing = store.getTime('black');
    store.setViewIndex(0); // view past position

    vi.advanceTimersByTime(5000); // 5s elapse while viewing history
    const timeAfterViewing = store.getTime('black');
    expect(timeAfterViewing).toBeLessThan(timeBeforeViewing);

    store.setViewIndex(null); // return to live
    const timeAfterReturn = store.getTime('black');
    expect(timeAfterReturn).toBe(timeAfterViewing);
  });

  it('Home and End navigation do not pause or reset clock', () => {
    store.setClockMode('blitz-3-2');
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    vi.advanceTimersByTime(1000);

    const t1 = store.getTime('black');
    store.setViewIndex(-1); // Home
    vi.advanceTimersByTime(4000);
    const t2 = store.getTime('black');
    expect(t2).toBeLessThan(t1);

    store.setViewIndex(null); // End
    const t3 = store.getTime('black');
    expect(t3).toBe(t2);
  });

  it('undo at active clock restores time snapshot and clock keeps ticking', () => {
    store.setClockMode('blitz-5-0');
    const startBlackTime = store.getTime('black');

    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // white e4
    vi.advanceTimersByTime(3000); // black thinking

    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3)); // black e5
    store.undo(); // undo black move

    expect(store.getTime('black')).toBe(startBlackTime);

    vi.advanceTimersByTime(4000);
    expect(store.getTime('black')).toBe(startBlackTime - 4000);
  });

  it('undo is forbidden after checkmate and clock stays stopped', () => {
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
    expect(store.isGameOver()).toBe(true);
    expect(store.canUndo()).toBe(false);
    expect(store.isClockActive()).toBe(false);

    const undone = store.undo();
    expect(undone).toBe(false);
    expect(store.getGameResult().type).toBe('checkmate');
    expect(store.isClockActive()).toBe(false);
  });

  it('time freezes after checkmate and viewing history after mate does not start clock', () => {
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
    const w1 = store.getTime('white');

    vi.advanceTimersByTime(10000);
    expect(store.getTime('white')).toBe(w1);

    store.setViewIndex(2); // view history of finished game
    vi.advanceTimersByTime(5000);
    expect(store.getTime('white')).toBe(w1);
    expect(store.isClockActive()).toBe(false);
  });

  it('updates black clock text automatically after move and time advance (Widget test)', () => {
    store.setClockMode('blitz-3-2');
    const container = document.createElement('div');
    const widget = new ClockWidget(container, store);
    widget.render();

    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // 1. e4
    const blackTimeEl = container.querySelector('#black-time') as HTMLElement;
    const initialText = blackTimeEl.textContent;

    vi.advanceTimersByTime(5000); // 5s elapse
    widget.render();

    expect(blackTimeEl.textContent).not.toBe(initialText);
    widget.destroy();
  });

  it('bullet 1+0 triggers timeout automatically after 60s without user action', () => {
    let timedOutColor: string | null = null;
    store.setClockMode('bullet-1-0', (loser) => {
      timedOutColor = loser;
    });
    const container = document.createElement('div');
    const widget = new ClockWidget(container, store, (loser) => {
      timedOutColor = loser;
    });
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));

    vi.advanceTimersByTime(60000);
    widget.render();
    expect(timedOutColor).toBe('black');
    widget.destroy();
  });

  it('clock widget destroy stops internal interval', () => {
    store.setClockMode('blitz-3-2');
    const container = document.createElement('div');
    const widget = new ClockWidget(container, store);
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));

    const blackTimeBefore = store.getTime('black');
    widget.destroy();

    vi.advanceTimersByTime(5000);
    expect(store.getTime('black')).toBeLessThan(blackTimeBefore);
  });
});
