import type { Color, GameResult, GameState, Move } from '../types';

export interface RuleSet {
  getInitialState(): GameState;
  generateLegalMoves(state: GameState): Move[];
  generateMoves(state: GameState): Move[];
  applyMove(state: GameState, move: Move): GameState;
  undoMove(state: GameState): GameState;
  getGameResult(state: GameState): GameResult;
  isInCheck(state: GameState, color: Color): boolean;
}
