import type { GameState } from '../types';
import { moveToSAN, sanToMove } from './san';
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

  const fullMovesStr = movesText.join(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const token of fullMovesStr.split(/\s+/)) {
    if ((currentLine + ' ' + token).trim().length > 80) {
      lines.push(currentLine.trim());
      currentLine = token;
    } else {
      currentLine = currentLine ? currentLine + ' ' + token : token;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  pgn += lines.join('\n') + '\n';
  return pgn;
}

export function parsePGN(pgnText: string): { headers: Record<string, string>; state: GameState } {
  const headers: Record<string, string> = {};
  const headerRegex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgnText)) !== null) {
    headers[match[1]] = match[2];
  }

  let text = pgnText.replace(/\[[\s\S]*?\]/g, '');
  text = text.replace(/\{[\s\S]*?\}/g, '');
  text = text.replace(/\([^)]*\)/g, '');
  text = text.replace(/\d+\.(\.\.)?/g, '');
  text = text.replace(/(1-0|0-1|1\/2-1\/2|\*)/g, '');

  const tokens = text.trim().split(/\s+/).filter(Boolean);

  let state = classicalRuleSet.getInitialState();
  for (const token of tokens) {
    const move = sanToMove(state, token);
    if (!move) {
      throw new Error(`Failed to parse SAN move in PGN: "${token}"`);
    }
    state = applyMove(state, move);
  }

  return { headers, state };
}

