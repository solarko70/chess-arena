import { describe, it, expect } from 'vitest';
import {
  estimatePerformanceRating,
  getSidePerformanceRating,
  formatPerformanceRating,
} from '@/analysis/performance-rating';

describe('Performance Rating Module (Stage A3.1)', () => {
  it('returns null when total moves is less than 6', () => {
    // 0 to 5 moves must return null
    for (let moves = 0; moves < 6; moves++) {
      const res = estimatePerformanceRating({
        accuracy: 95,
        totalMoves: moves,
        blunderCount: 0,
        isWin: true,
        isDraw: false,
      });
      expect(res).toBeNull();
    }
  });

  it('high accuracy 95%+ with 0 blunders gives rating in 2300-2500 range', () => {
    const res95 = estimatePerformanceRating({
      accuracy: 95,
      totalMoves: 12,
      blunderCount: 0,
      isWin: false,
      isDraw: false,
    });
    expect(res95).not.toBeNull();
    expect(res95!).toBeGreaterThanOrEqual(2300);
    expect(res95!).toBeLessThanOrEqual(2500);

    const res99 = estimatePerformanceRating({
      accuracy: 99,
      totalMoves: 20,
      blunderCount: 0,
      isWin: true,
      isDraw: false,
    });
    expect(res99).not.toBeNull();
    expect(res99!).toBeGreaterThanOrEqual(2700);
  });

  it('medium accuracy 70% produces rating in 1200 to 1250 range', () => {
    const res70 = estimatePerformanceRating({
      accuracy: 70,
      totalMoves: 15,
      blunderCount: 0,
      isWin: false,
      isDraw: false,
    });
    expect(res70).not.toBeNull();
    expect(res70!).toBeGreaterThanOrEqual(1200);
    expect(res70!).toBeLessThanOrEqual(1250);
  });

  it('low accuracy 35% with multiple blunders gives rating below 800', () => {
    const res35 = estimatePerformanceRating({
      accuracy: 35,
      totalMoves: 16,
      blunderCount: 3,
      isWin: false,
      isDraw: false,
    });
    expect(res35).not.toBeNull();
    expect(res35!).toBeLessThan(800);
  });

  it('blunder penalty strictly and monotonically decreases rating', () => {
    const r0 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 0,
      isWin: false,
      isDraw: false,
    })!;
    const r1 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 1,
      isWin: false,
      isDraw: false,
    })!;
    const r2 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 2,
      isWin: false,
      isDraw: false,
    })!;

    expect(r0).toBeGreaterThan(r1);
    expect(r1).toBeGreaterThan(r2);
  });

  it('mistake penalty strictly and monotonically decreases rating', () => {
    const m0 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 0,
      mistakeCount: 0,
      isWin: false,
      isDraw: false,
    })!;
    const m1 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 0,
      mistakeCount: 1,
      isWin: false,
      isDraw: false,
    })!;
    const m2 = estimatePerformanceRating({
      accuracy: 80,
      totalMoves: 15,
      blunderCount: 0,
      mistakeCount: 2,
      isWin: false,
      isDraw: false,
    })!;

    expect(m0).toBeGreaterThan(m1);
    expect(m1).toBeGreaterThan(m2);
  });

  it('rates 86.9% accuracy with 2 blunders and 2 mistakes in 1300-1450 range', () => {
    const res = estimatePerformanceRating({
      accuracy: 86.9,
      totalMoves: 20,
      blunderCount: 2,
      mistakeCount: 2,
      isWin: false,
      isDraw: false,
    });
    expect(res).not.toBeNull();
    expect(res!).toBe(1390);
    expect(res!).toBeGreaterThanOrEqual(1300);
    expect(res!).toBeLessThanOrEqual(1450);
  });

  it('rates 92.6% accuracy with 0 blunders in 2050-2150 range', () => {
    const res = estimatePerformanceRating({
      accuracy: 92.6,
      totalMoves: 20,
      blunderCount: 0,
      mistakeCount: 0,
      isWin: false,
      isDraw: false,
    });
    expect(res).not.toBeNull();
    expect(res!).toBe(2120);
    expect(res!).toBeGreaterThanOrEqual(2050);
    expect(res!).toBeLessThanOrEqual(2150);
  });

  it('rating is rounded to tens and clamped to 180-2900 bounds', () => {
    const testCases = [
      { accuracy: 10, totalMoves: 10, blunderCount: 8, isWin: false, isDraw: false },
      { accuracy: 100, totalMoves: 25, blunderCount: 0, isWin: true, isDraw: false },
      { accuracy: 73.4, totalMoves: 18, blunderCount: 1, isWin: false, isDraw: false },
    ];

    for (const tc of testCases) {
      const res = estimatePerformanceRating(tc);
      expect(res).not.toBeNull();
      expect(res! % 10).toBe(0);
      expect(res!).toBeGreaterThanOrEqual(180);
      expect(res!).toBeLessThanOrEqual(2900);
    }
  });

  it('getSidePerformanceRating extracts correct side stats from review', () => {
    const mockReview = {
      accuracy: { white: 88, black: 62 },
      counts: {
        white: { blunder: 0 },
        black: { blunder: 2 },
      },
      moves: [
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
        { color: 'white' as const },
        { color: 'black' as const },
      ],
    };

    const whiteRating = getSidePerformanceRating(mockReview, 'white', 'white');
    const blackRating = getSidePerformanceRating(mockReview, 'black', 'white');

    expect(whiteRating).not.toBeNull();
    expect(blackRating).not.toBeNull();
    expect(whiteRating!).toBeGreaterThan(blackRating!);
  });

  it('formatPerformanceRating returns expected string representations', () => {
    expect(formatPerformanceRating(null)).toBe('мало ходов');
    expect(formatPerformanceRating(1850)).toBe('~1850');
    expect(formatPerformanceRating(2400)).toBe('~2400');
  });
});

