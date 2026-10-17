import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessClock } from '@/state/clock';

describe('ChessClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with correct time for blitz 3+2', () => {
    const clock = new ChessClock();
    clock.setMode('blitz-3-2');
    expect(clock.getTime('white')).toBe(3 * 60 * 1000);
    expect(clock.getTime('black')).toBe(3 * 60 * 1000);
  });

  it('counts down time for active color', () => {
    let timedOutColor: string | null = null;
    const clock = new ChessClock((loser) => {
      timedOutColor = loser;
    });
    clock.setMode('bullet-1-0'); // 1 minute = 60000ms
    clock.start('white');

    vi.advanceTimersByTime(5000); // advance 5 seconds
    expect(clock.getTime('white')).toBe(55000);
    expect(clock.getTime('black')).toBe(60000);
    expect(timedOutColor).toBeNull();

    // Advance remaining time
    vi.advanceTimersByTime(55000);
    expect(clock.getTime('white')).toBe(0);
    expect(timedOutColor).toBe('white');
  });

  it('adds increment when switching turn', () => {
    const clock = new ChessClock();
    clock.setMode('blitz-3-2'); // 3 mins, 2s increment
    clock.start('white');

    vi.advanceTimersByTime(10000); // 10s elapsed
    expect(clock.getTime('white')).toBe(3 * 60 * 1000 - 10000);

    clock.switchTurn('black'); // white gets +2s increment
    expect(clock.getTime('white')).toBe(3 * 60 * 1000 - 10000 + 2000);
    expect(clock.isActive()).toBe(true);
  });

  it('pauses and resumes correctly', () => {
    const clock = new ChessClock();
    clock.setMode('blitz-5-0');
    clock.start('white');

    vi.advanceTimersByTime(4000);
    clock.pause();
    expect(clock.isActive()).toBe(false);

    const timeAfterPause = clock.getTime('white');
    vi.advanceTimersByTime(10000);
    expect(clock.getTime('white')).toBe(timeAfterPause); // should not tick while paused

    clock.resume('white');
    vi.advanceTimersByTime(2000);
    expect(clock.getTime('white')).toBe(timeAfterPause - 2000);
  });
});
