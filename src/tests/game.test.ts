import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMove, classicalRuleSet, generateLegal, parseFEN, positionKey, undoMove } from '@/core';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { GameOverModalUI } from '@/ui/gameovermodal';
import { solarAudio } from '@/audio/solar-audio';

const cycle = [[62, 45], [6, 21], [45, 62], [21, 6]] as const;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('Threefold repetition', () => {
  it('ends the third occurrence as a draw with a modal and one draw sound', () => {
    const store = new ChessStore();
    store.setClockMode('blitz-3-2');
    store.newGame();
    const boardMount = document.createElement('div');
    const modalMount = document.createElement('div');
    document.body.append(boardMount, modalMount);
    new ChessBoardUI(boardMount, store);
    const modal = new GameOverModalUI(modalMount, store);
    const end = vi.spyOn(solarAudio, 'playGameEnd').mockImplementation(() => {});
    const initialKey = positionKey(store.getLiveState());
    try {
      for (const [from, to] of cycle) expect(store.makeMove(from, to)).toBe(true);
      expect(store.getLiveState().positionCounts.get(initialKey)).toBe(2);
      expect(store.getGameResult().type).toBe('ongoing');
      expect(modal.isOpen()).toBe(false);
      expect(end).not.toHaveBeenCalled();
      for (const [from, to] of cycle) expect(store.makeMove(from, to)).toBe(true);
      expect(store.getGameResult()).toEqual({
        type: 'threefoldRepetition', status: 'draw', reason: 'threefold-repetition',
      });
      expect(store.getLiveState().positionCounts.get(initialKey)).toBe(3);
      expect(store.isGameOver()).toBe(true);
      expect(store.isClockActive()).toBe(false);
      expect(modal.isOpen()).toBe(true);
      expect(modalMount.querySelector('#game-over-title')?.textContent)
        .toBe('Ничья: Троекратное повторение позиции');
      expect(end.mock.calls).toEqual([['draw']]);
      store.selectSquare(null);
      expect(end).toHaveBeenCalledOnce();
      expect(store.makeMove(52, 36)).toBe(false);
      expect(store.undo()).toBe(false);
      store.setViewIndex(0);
      expect(store.isGameOver()).toBe(true);
      expect(end).toHaveBeenCalledOnce();
      store.newGame();
      expect(store.getLiveState().positionCounts.size).toBe(1);
      expect(store.getLiveState().positionCounts.get(initialKey)).toBe(1);
      expect(store.isGameOver()).toBe(false);
    } finally {
      modal.destroy();
    }
  });

  it('preserves occurrence counts across immutable moves and restores them on undo', () => {
    let state = classicalRuleSet.getInitialState();
    const initial = state;
    const initialKey = positionKey(state);
    for (const [from, to] of cycle) {
      const move = generateLegal(state).find((candidate) => candidate.from === from && candidate.to === to)!;
      const previous = state;
      state = applyMove(state, move);
      expect(undoMove(state).positionCounts).toEqual(previous.positionCounts);
    }
    expect(initial.positionCounts.get(initialKey)).toBe(1);
    expect(state.positionCounts.get(initialKey)).toBe(2);
    const pawn = generateLegal(state).find((move) => move.from === 52 && move.to === 36)!;
    const next = applyMove(state, pawn);
    expect(next.positionCounts.get(initialKey)).toBe(2);
    expect(next.positionCounts.get(positionKey(next))).toBe(1);
    expect(undoMove(next).positionCounts).toEqual(state.positionCounts);
  });

  it('distinguishes turn, castling and available en passant while ignoring move counters', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR';
    const base = parseFEN(`${fen} b KQkq e3 0 3`);
    expect(positionKey(base)).toBe(`${fen} b KQkq e3`);
    expect(positionKey(parseFEN(`${fen} b KQkq e3 12 9`))).toBe(positionKey(base));
    for (const suffix of ['w KQkq e3', 'b KQk e3', 'b KQkq -']) {
      expect(positionKey(parseFEN(`${fen} ${suffix} 0 3`))).not.toBe(positionKey(base));
    }
    expect(base.positionCounts.get(positionKey(base))).toBe(1);
  });

  it('routes a live checking move to the selected classic playCheck method', () => {
    const store = new ChessStore();
    store.newGame(parseFEN('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1'));
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    solarAudio.setSoundTheme('classic');
    new ChessBoardUI(mount, store);
    const check = vi.spyOn(solarAudio.themes.classic, 'playCheck').mockImplementation(() => {});
    expect(store.makeMove(51, 43)).toBe(true);
    expect(store.makeMove(4, 12)).toBe(true);
    expect(store.makeMove(43, 44)).toBe(true);
    expect(check).toHaveBeenCalledOnce();
    solarAudio.setSoundTheme('cosmic');
  });
});
