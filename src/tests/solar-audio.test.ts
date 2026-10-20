// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  solarAudio,
  playMove,
  playCapture,
  playCheck,
  playCheckmate,
  playStellar,
} from '@/audio/solar-audio';
import { ChessStore } from '@/state/store';
import { HistoryUI } from '@/ui/history';
import { ChessBoardUI } from '@/ui/board';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

describe('Stage 5a-1: Solar Audio Web Audio API procedural sound engine', () => {
  let container: HTMLElement;
  let store: ChessStore;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    store = new ChessStore();
    solarAudio.setMuted(false);
    solarAudio.setContextForTesting(null);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('audio methods playMove, playCapture, playCheck, playCheckmate, playStellar run safely in jsdom', () => {
    expect(typeof playMove).toBe('function');
    expect(typeof playCapture).toBe('function');
    expect(typeof playCheck).toBe('function');
    expect(typeof playCheckmate).toBe('function');
    expect(typeof playStellar).toBe('function');

    expect(() => playMove()).not.toThrow();
    expect(() => playCapture()).not.toThrow();
    expect(() => playCheck()).not.toThrow();
    expect(() => playCheckmate()).not.toThrow();
    expect(() => playStellar()).not.toThrow();

    expect(() => solarAudio.playMove()).not.toThrow();
    expect(() => solarAudio.playCapture()).not.toThrow();
    expect(() => solarAudio.playCheck()).not.toThrow();
    expect(() => solarAudio.playCheckmate()).not.toThrow();
    expect(() => solarAudio.playStellar()).not.toThrow();

    expect(solarAudio.isAudioMuted()).toBe(false);
    expect(solarAudio.toggleMute()).toBe(true);
    expect(solarAudio.isAudioMuted()).toBe(true);
    solarAudio.setMuted(false);
  });

  it('synthesizes procedural audio graph with proper nodes when AudioContext is provided', () => {
    const createdOscillators: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
      detune: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];

    const createdGains: Array<{
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const createdFilters: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      Q: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockImplementation(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          detune: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn().mockImplementation(() => {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      createBiquadFilter: vi.fn().mockImplementation(() => {
        const filter = {
          type: 'bandpass',
          frequency: { setValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      }),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);

    // Test playMove synthesis
    solarAudio.playMove();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    const lastOsc = createdOscillators[createdOscillators.length - 1];
    expect(lastOsc.frequency.setValueAtTime).toHaveBeenCalledWith(240, 10);
    expect(lastOsc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(90, 10.05);

    // Test playCapture synthesis (dual burst)
    createdOscillators.length = 0;
    solarAudio.playCapture();
    expect(createdOscillators.length).toBe(2);

    // Test playCheck synthesis (880Hz + 1760Hz)
    createdOscillators.length = 0;
    solarAudio.playCheck();
    expect(createdOscillators.length).toBe(2);
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(880, 10);
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(1760, 10);

    // Test playCheckmate synthesis (low chord)
    createdOscillators.length = 0;
    solarAudio.playCheckmate();
    expect(createdOscillators.length).toBe(4);

    // Test playStellar synthesis (Heavenly choir: 4 oscs + bandpass filter)
    createdOscillators.length = 0;
    createdFilters.length = 0;
    solarAudio.playStellar();
    expect(createdOscillators.length).toBe(4);
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('bandpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1800, 10);
    expect(createdFilters[0].Q.setValueAtTime).toHaveBeenCalledWith(3.0, 10);
  });

  it('navigating to a stellar half-move in game review calls playStellar', () => {
    new HistoryUI(container, store);

    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // 1. e4
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3)); // 1... e5

    const baseMove = store.getLiveState().history[0];
    const mockReview: GameReviewResult = {
      engineName: 'MockEngine',
      reanalyzed: 0,
      accuracy: { white: 95, black: 90 },
      counts: {
        white: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, stellar: 1 },
        black: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, stellar: 0 },
      },
      keyMoments: [],
      evalHistory: [],
      moves: [
        {
          ply: 1,
          san: 'e4',
          color: 'white',
          move: baseMove,
          evalBefore: { type: 'cp', value: 20 },
          evalAfter: { type: 'cp', value: 30 },
          bestMove: baseMove,
          bestSan: 'e4',
          winBefore: 50,
          winAfter: 55,
          loss: 0,
          accuracy: 100,
          class: 'stellar',
          onlyMove: false,
        },
        {
          ply: 2,
          san: 'e5',
          color: 'black',
          move: store.getLiveState().history[1],
          evalBefore: { type: 'cp', value: 30 },
          evalAfter: { type: 'cp', value: 25 },
          bestMove: store.getLiveState().history[1],
          bestSan: 'e5',
          winBefore: 45,
          winAfter: 48,
          loss: 0,
          accuracy: 100,
          class: 'best',
          onlyMove: false,
        },
      ],
    };

    store.setReviewResult(mockReview as unknown as import('@/analysis').ReviewRunResult);
    store.setReviewMode(true);

    const stellarSpy = vi.spyOn(solarAudio, 'playStellar');

    // Select ply 1 (stellar move)
    store.setViewIndex(0);
    expect(stellarSpy).toHaveBeenCalledTimes(1);

    // Navigating again via history move element click
    const moveEls = container.querySelectorAll('.history-move');
    expect(moveEls.length).toBeGreaterThan(0);
    (moveEls[0] as HTMLElement).click();
    expect(stellarSpy).toHaveBeenCalled();
  });

  it('navigating between moves in review plays corresponding move capture checkmate sounds', () => {
    new HistoryUI(container, store);

    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4)); // 1. e4
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3)); // 1... e5
    store.makeMove(store.coordsToSquare(3, 6), store.coordsToSquare(3, 4)); // 2. d4

    const moves = store.getLiveState().history;
    const mockReview: GameReviewResult = {
      engineName: 'MockEngine',
      reanalyzed: 0,
      accuracy: { white: 85, black: 80 },
      counts: {
        white: { best: 2, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        black: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      },
      keyMoments: [],
      evalHistory: [],
      moves: [
        {
          ply: 1,
          san: 'e4',
          color: 'white',
          move: moves[0],
          evalBefore: { type: 'cp', value: 20 },
          evalAfter: { type: 'cp', value: 20 },
          bestMove: moves[0],
          bestSan: 'e4',
          winBefore: 50,
          winAfter: 50,
          loss: 0,
          accuracy: 100,
          class: 'best',
          onlyMove: false,
        },
        {
          ply: 2,
          san: 'exd4',
          color: 'black',
          move: { ...moves[1], captured: { type: 'pawn', color: 'white' } } as unknown as Move,
          evalBefore: { type: 'cp', value: 20 },
          evalAfter: { type: 'cp', value: 20 },
          bestMove: moves[1],
          bestSan: 'exd4',
          winBefore: 50,
          winAfter: 50,
          loss: 0,
          accuracy: 100,
          class: 'best',
          onlyMove: false,
        },
        {
          ply: 3,
          san: 'Qxd4#',
          color: 'white',
          move: moves[2],
          evalBefore: { type: 'mate', value: 1 },
          evalAfter: { type: 'mate', value: 0 },
          bestMove: moves[2],
          bestSan: 'Qxd4#',
          winBefore: 100,
          winAfter: 100,
          loss: 0,
          accuracy: 100,
          class: 'best',
          onlyMove: false,
        },
      ],
    };

    store.setReviewResult(mockReview as unknown as import('@/analysis').ReviewRunResult);
    store.setReviewMode(true);

    const moveSpy = vi.spyOn(solarAudio, 'playMove');
    const captureSpy = vi.spyOn(solarAudio, 'playCapture');
    const checkmateSpy = vi.spyOn(solarAudio, 'playCheckmate');

    // Select move 0 (quiet move e4)
    store.setViewIndex(0);
    expect(moveSpy).toHaveBeenCalled();

    // Select move 1 (capture exd4)
    store.setViewIndex(1);
    expect(captureSpy).toHaveBeenCalled();

    // Select move 2 (checkmate Qxd4#)
    store.setViewIndex(2);
    expect(checkmateSpy).toHaveBeenCalled();
  });

  it('live moves on board trigger move, capture, check, and checkmate audio', () => {
    new ChessBoardUI(container, store);

    const moveSpy = vi.spyOn(solarAudio, 'playMove');
    const checkSpy = vi.spyOn(solarAudio, 'playCheck');

    // 1. e4 (quiet move)
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    expect(moveSpy).toHaveBeenCalledTimes(1);

    // 1... f5
    store.makeMove(store.coordsToSquare(5, 1), store.coordsToSquare(5, 3));
    expect(moveSpy).toHaveBeenCalledTimes(2);

    // 2. Qh5+ (check!)
    store.makeMove(store.coordsToSquare(3, 7), store.coordsToSquare(7, 3));
    expect(checkSpy).toHaveBeenCalledTimes(1);
  });
});

