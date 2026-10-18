import { describe, it, expect } from 'vitest';
import { parseFEN, applyMove, isCheckmate } from '@/core';
import { findBestMove, LEVELS, type LevelConfig } from '@/ai';

describe('AI difficulty levels: Novice tactical bounds', () => {
  it('Novice plays mate in 1 when no blunder is rolled, and does not see mate in 2', () => {
    const mateIn1 = parseFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    // Roll > blunderChance so no blunder occurs -> Novice must play Ra8#
    const nonBlunderMove = findBestMove(mateIn1, 'novice', { rng: () => 0.99 });
    expect(nonBlunderMove).not.toBeNull();
    expect(isCheckmate(applyMove(mateIn1, nonBlunderMove!))).toBe(true);

    // Legal's mate (mate in 2): Novice (depth 1, no quiescence) does not see the sacrifice Bxf7+
    const mateIn2 = parseFEN('rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6');
    const noviceNoNoise: LevelConfig = {
      ...LEVELS.novice,
      topMoves: 1,
      temperature: 0,
      blunderChance: 0,
    };
    const m2Move = findBestMove(mateIn2, noviceNoNoise, { rng: () => 0.99 });
    expect(m2Move).not.toBeNull();
    // On depth 1 without quiescence, capturing the queen on d1 (Kxd1 / Nxd1) looks much better than sacrificing on f7
    const after = applyMove(mateIn2, m2Move!);
    expect(isCheckmate(after)).toBe(false);
  });
});
