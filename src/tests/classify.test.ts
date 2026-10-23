// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  classifyMove,
  computeMateProlongationLoss,
  extractMateDistanceBefore,
  extractMateDistanceAfter,
} from '@/analysis';

describe('Stage 8c: Strict mate evaluation & missed wins', () => {
  it('move turning mate in 2 into mate in 10 is classified as miss', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      evalBefore: { type: 'mate', value: 2 },
      evalAfter: { type: 'mate', value: 10 },
      moverColor: 'white',
    });

    expect(['miss', 'missed']).toContain(res.moveClass);
    expect(res.loss).toBe(25);
    expect(res.moveClass).not.toBe('best');
    expect(res.moveClass).not.toBe('excellent');
    expect(res.moveClass).not.toBe('good');
  });

  it('move turning mate in 1 into mate in 2 is classified as good (not best)', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      evalBefore: { type: 'mate', value: 1 },
      evalAfter: { type: 'mate', value: 2 },
      moverColor: 'white',
    });

    expect(res.moveClass).toBe('good');
    expect(res.moveClass).not.toBe('best');
    expect(res.moveClass).not.toBe('excellent');
    expect(res.loss).toBe(10);
  });

  it('move keeping shortest mate (mate in 2 -> mate in 2) is classified as best', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      evalBefore: { type: 'mate', value: 2 },
      evalAfter: { type: 'mate', value: 2 },
      moverColor: 'white',
    });

    expect(res.moveClass).toBe('best');
    expect(res.loss).toBe(0);
  });

  it('missed mate in 1 dropped into non-mate CP endgame is classified as miss', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 99.5,
      evalBefore: { type: 'mate', value: 1 },
      evalAfter: { type: 'cp', value: 700 },
      moverColor: 'white',
    });

    expect(['miss', 'missed']).toContain(res.moveClass);
    expect(res.loss).toBe(25);
  });

  it('delivering checkmate on board is always best with 0 loss', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      isCheckmateMove: true,
      evalBefore: { type: 'mate', value: 1 },
      evalAfter: { type: 'mate', value: 0 },
      moverColor: 'white',
    });

    expect(res.moveClass).toBe('best');
    expect(res.loss).toBe(0);
  });

  it('distant mate N=8 delayed to M=9 retains best classification', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      evalBefore: { type: 'mate', value: 8 },
      evalAfter: { type: 'mate', value: 9 },
      moverColor: 'white',
    });

    expect(res.moveClass).toBe('best');
    expect(res.loss).toBe(0);
  });

  it('distant mate N=8 delayed to M=11 cannot be best', () => {
    const res = classifyMove({
      winBefore: 100,
      winAfter: 100,
      evalBefore: { type: 'mate', value: 8 },
      evalAfter: { type: 'mate', value: 11 },
      moverColor: 'white',
    });

    expect(res.moveClass).not.toBe('best');
    expect(res.moveClass).not.toBe('excellent');
  });

  it('extractMateDistanceBefore handles plies and moves for both colors', () => {
    expect(extractMateDistanceBefore({ type: 'mate', value: 1 }, 'white')).toBe(1);
    expect(extractMateDistanceBefore({ type: 'mate', value: 3 }, 'white')).toBe(2);
    expect(extractMateDistanceBefore({ type: 'mate', value: 2 }, 'white')).toBe(2);
    expect(extractMateDistanceBefore({ type: 'mate', value: -1 }, 'black')).toBe(1);
    expect(extractMateDistanceBefore({ type: 'mate', value: -3 }, 'black')).toBe(2);
    expect(extractMateDistanceBefore({ type: 'cp', value: 500 }, 'white')).toBeNull();
  });

  it('extractMateDistanceAfter detects delivery of mate and delayed mates', () => {
    expect(extractMateDistanceAfter({ type: 'mate', value: 0 }, 'white', 1, true)).toBe(0);
    expect(extractMateDistanceAfter({ type: 'mate', value: 2 }, 'white', 1, false)).toBe(2);
    expect(extractMateDistanceAfter({ type: 'mate', value: 10 }, 'white', 2, false)).toBe(10);
    expect(extractMateDistanceAfter({ type: 'cp', value: 700 }, 'white', 2, false)).toBeNull();
  });

  it('computeMateProlongationLoss returns calibrated penalties for all cases', () => {
    expect(computeMateProlongationLoss(2, 10)).toBe(25);
    expect(computeMateProlongationLoss(1, 2)).toBe(10);
    expect(computeMateProlongationLoss(1, 3)).toBe(10);
    expect(computeMateProlongationLoss(1, 4)).toBe(25);
    expect(computeMateProlongationLoss(1, null)).toBe(25);
    expect(computeMateProlongationLoss(2, 2)).toBe(0);
    expect(computeMateProlongationLoss(2, 1)).toBe(0);
    expect(computeMateProlongationLoss(2, 0)).toBe(0);
    expect(computeMateProlongationLoss(8, 9)).toBe(0);
    expect(computeMateProlongationLoss(8, 11)).toBeGreaterThanOrEqual(9);
  });
});
