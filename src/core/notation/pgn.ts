import type { GameState } from '../types';
import { moveToSAN } from './san';
import { applyMove } from '../moves/apply';
import { classicalRuleSet } from '../rules/classical';

export function exportPGN(state: GameState, metadata?: Record<string, string>): string {
  const headers: Record<string, string> = {
    Event: metadata?.Event ?? 'Casual Game',
    Site: metadata?.Site ?? 'Chess Arena',
    Date: metadata?.Date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: metadata?.Round ?? '1',
    White: metadata?.White ?? 'Player 1',
    Black: metadata?.Black ?? 'Player 2',
    Result: metadata?.Result ?? '*',
    ...metadata,
  };

  let pgn = '';
  for (const [key, val] of Object.entries(headers)) {
    pgn += `[${key} "${val}"]\n`;
  }
  pgn += '\n';

  // Replay history from initial state
  let currentState = classicalRuleSet.getInitialState();
  const movesText: string[] = [];
  let moveNum = 1;

  for (let i = 0; i < state.history.length; i++) {
    const move = state.history[i];
    const san = moveToSAN(currentState, move);

    if (i % 2 === 0) {
      movesText.push(`${moveNum}. ${san}`);
    } else {
      movesText[movesText.length - 1] += ` ${san}`;
      moveNum++;
    }

    currentState = applyMove(currentState, move);
  }

  const resultStr = headers['Result'] ?? '*';
  movesText.push(resultStr);

  pgn += movesText.join(' ') + '\n';
  return pgn;
}
