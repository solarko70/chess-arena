import { describe, it, expect } from 'vitest';
import { parseFEN, applyMove, classicalRuleSet, isCheckmate } from '@/core';
import type { GameState, PieceType } from '@/core';
import { findBestMove, LEVELS, seededRandom, type LevelConfig, type LevelId } from '@/ai';

/**
 * 10 short opening lines (after 2-4 plies) to diversify tournament games.
 */
const OPENING_FENS: string[] = [
  // 1. e4 e5 2. Nf3 Nc6 (Open Game)
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  // 1. e4 c5 2. Nf3 d6 (Sicilian Defence)
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
  // 1. e4 e6 2. d4 d5 (French Defence)
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
  // 1. e4 c6 2. d4 d5 (Caro-Kann Defence)
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
  // 1. d4 d5 2. c4 e6 (Queen's Gambit Declined)
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
  // 1. d4 Nf6 2. c4 g6 (King's Indian Defence)
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
  // 1. c4 e5 2. Nc3 Nf6 (English Opening)
  'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq - 2 3',
  // 1. e4 d5 2. exd5 Qxd5 (Scandinavian Defence)
  'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
  // 1. e4 e5 2. Nf3 Nf6 (Petrov's Defence)
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  // 1. e4 e5 2. Bc4 Bc5 (Bishop's Opening)
  'rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
];

const MATERIAL_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

/** Material balance from White's perspective in centipawns. */
function materialBalance(state: GameState): number {
  let diff = 0;
  for (const p of state.board.pieces) {
    if (!p) continue;
    const v = MATERIAL_VALUES[p.type];
    diff += p.color === 'white' ? v : -v;
  }
  return diff;
}

/**
 * Resolve level config for fast tournament testing:
 * Master keeps full strength (full quiescence, zero temperature/blunders, topMoves=1),
 * with depth 4 and 12000 maxNodes so 40 master games finish well within the 60s test budget.
 */
function tournamentConfig(id: LevelId): LevelConfig {
  const base = LEVELS[id];
  if (id === 'master') {
    return { ...base, depth: 4, maxNodes: 12000 };
  }
  return base;
}

interface MatchSummary {
  weakerId: LevelId;
  strongerId: LevelId;
  games: number;
  weakerWins: number;
  strongerWins: number;
  draws: number;
  weakerScore: number;
  strongerScore: number;
  weakerRatio: number;
  strongerWinRate: number;
}

/**
 * Play 20 games (10 as White, 10 as Black across the 10 opening positions)
 * between `weakerId` and `strongerId` with a max of 150 plies per game.
 */
function playMatch(weakerId: LevelId, strongerId: LevelId, baseSeed: number): MatchSummary {
  const weakerCfg = tournamentConfig(weakerId);
  const strongerCfg = tournamentConfig(strongerId);

  let weakerWins = 0;
  let strongerWins = 0;
  let draws = 0;

  for (let i = 0; i < OPENING_FENS.length; i++) {
    for (const weakerPlaysWhite of [true, false]) {
      const seed = baseSeed + i * 2 + (weakerPlaysWhite ? 0 : 1);
      const rng = seededRandom(seed);
      let state = parseFEN(OPENING_FENS[i]);
      let plies = 0;
      let result = classicalRuleSet.getGameResult(state);

      while (result.type === 'ongoing' && plies < 150) {
        const whiteTurn = state.turn === 'white';
        const isWeakerTurn = whiteTurn === weakerPlaysWhite;
        const cfg = isWeakerTurn ? weakerCfg : strongerCfg;
        const move = findBestMove(state, cfg, { rng });
        if (!move) break;
        state = applyMove(state, move);
        plies++;
        result = classicalRuleSet.getGameResult(state);
      }

      let whiteOutcome = 0.5; // 1 = White wins, 0 = Black wins, 0.5 = draw
      if (result.type === 'checkmate') {
        whiteOutcome = result.winner === 'white' ? 1 : 0;
      } else if (result.type === 'ongoing') {
        // Adjudicate unfinished game at 150 plies by material
        const mat = materialBalance(state);
        if (mat >= 100) whiteOutcome = 1;
        else if (mat <= -100) whiteOutcome = 0;
        else whiteOutcome = 0.5;
      }

      const weakerOutcome = weakerPlaysWhite ? whiteOutcome : 1 - whiteOutcome;
      if (weakerOutcome === 1) weakerWins++;
      else if (weakerOutcome === 0) strongerWins++;
      else draws++;
    }
  }

  const games = OPENING_FENS.length * 2;
  const weakerScore = weakerWins + draws * 0.5;
  const strongerScore = strongerWins + draws * 0.5;

  return {
    weakerId,
    strongerId,
    games,
    weakerWins,
    strongerWins,
    draws,
    weakerScore,
    strongerScore,
    weakerRatio: weakerScore / games,
    strongerWinRate: strongerWins / games,
  };
}

describe('AI difficulty levels & calibration matches', () => {
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

  it('calibrates strength hierarchy across 20-game matches (10 White + 10 Black)', () => {
    const mNoviceAmateur = playMatch('novice', 'amateur', 100);
    const mAmateurClub = playMatch('amateur', 'club', 200);
    const mClubExpert = playMatch('club', 'expert', 300);
    const mExpertMaster = playMatch('expert', 'master', 400);
    const mNoviceMaster = playMatch('novice', 'master', 500);

    const summaries = [mNoviceAmateur, mAmateurClub, mClubExpert, mExpertMaster, mNoviceMaster];
    for (const s of summaries) {
      console.log(
        `[match] ${LEVELS[s.weakerId].name} vs ${LEVELS[s.strongerId].name}: ` +
          `${s.weakerScore} - ${s.strongerScore} ` +
          `(+${s.weakerWins} =${s.draws} -${s.strongerWins}, weaker=${(s.weakerRatio * 100).toFixed(1)}%, strongerWins=${(s.strongerWinRate * 100).toFixed(1)}%)`,
      );
    }

    // Novice scores <= 20% against Amateur
    expect(mNoviceAmateur.weakerRatio).toBeLessThanOrEqual(0.2);
    // Amateur scores <= 35% against Club
    expect(mAmateurClub.weakerRatio).toBeLessThanOrEqual(0.35);
    // Club scores <= 35% against Expert
    expect(mClubExpert.weakerRatio).toBeLessThanOrEqual(0.35);
    // Expert scores <= 40% against Master
    expect(mExpertMaster.weakerRatio).toBeLessThanOrEqual(0.4);
    // Master wins >= 95% of games against Novice
    expect(mNoviceMaster.strongerWinRate).toBeGreaterThanOrEqual(0.95);
  }, 60000);
});

