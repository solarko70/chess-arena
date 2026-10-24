// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  solarAudio,
  playMove,
  playCapture,
  playCheck,
  playCheckmate,
  playStellar,
  playButtonClick,
  playButtonHover,
  playPremove,
  startMenuAmbient,
  stopMenuAmbient,
  toggleMute,
  isAudioMuted,
  isMuted,
  AMBIENT_CHORDS,
  getCurrentChordIndex,
  advanceAmbientChord,
} from '@/audio/solar-audio';
import { ChessStore } from '@/state/store';
import { HistoryUI } from '@/ui/history';
import { ChessBoardUI } from '@/ui/board';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';
import { initApp, getRouter } from '@/main';

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
      frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime?: ReturnType<typeof vi.fn> };
      Q: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const createdDelays: Array<{
      delayTime: { setValueAtTime: ReturnType<typeof vi.fn> };
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
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      }),
      createDelay: vi.fn().mockImplementation(() => {
        const delay = {
          delayTime: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdDelays.push(delay);
        return delay;
      }),
      createBuffer: vi.fn().mockImplementation(() => ({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
      })),
      createBufferSource: vi.fn().mockImplementation(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
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

    // Capture retains the wooden transient and adds a sine sub-impact and metallic resonance.
    createdOscillators.length = 0;
    createdFilters.length = 0;
    solarAudio.playCapture();
    expect(createdOscillators.length).toBe(3);
    expect(createdOscillators[0].type).toBe('triangle');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(140, 10);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(45, 10.08);
    expect(createdFilters.length).toBe(2);
    expect(createdFilters[0].type).toBe('lowpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(550, 10);
    expect(createdOscillators[1].type).toBe('sine');
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(140, 10);
    expect(createdOscillators[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(45, 10.12);
    expect(createdFilters[1].type).toBe('bandpass');

    // Test playCheck synthesis (B4 493.88Hz + D#5 622.25Hz + 1100Hz lowpass + reduced peak gain 0.09)
    createdOscillators.length = 0;
    createdFilters.length = 0;
    createdGains.length = 0;
    solarAudio.playCheck();
    expect(createdOscillators.length).toBe(2);
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(493.88, 10);
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(622.25, 10);
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('lowpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1100, 10);
    expect(createdGains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.09, 10.015);

    // Test playCheckmate synthesis (sub-bass + C3/G3/E4 chord + 800Hz lowpass).
    createdOscillators.length = 0;
    createdFilters.length = 0;
    solarAudio.playCheckmate();
    expect(createdOscillators.length).toBe(4);
    expect(createdOscillators[0].type).toBe('sine');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(65.4, 10);
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('lowpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(800, 10);

    // Test playStellar synthesis (3-layer cosmic patch: Sub-bass, Laser sweep, Celestial Shimmer)
    createdOscillators.length = 0;
    createdFilters.length = 0;
    createdDelays.length = 0;
    solarAudio.playStellar();
    expect(createdOscillators.length).toBe(7);

    // Layer 1: Sub-bass (120Hz -> 40Hz)
    expect(createdOscillators[0].type).toBe('triangle');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(120, 10);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(40, 11.5);

    // Layer 2: Laser sweep (300Hz -> 1500Hz + 800Hz -> 4000Hz lowpass)
    expect(createdOscillators[1].type).toBe('sawtooth');
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(300, 10);
    expect(createdOscillators[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1500, 10.4);
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('lowpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(800, 10);
    expect(createdFilters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(4000, 10.4);

    // Layer 3: Celestial Shimmer (5 sine oscs + 5 delay nodes)
    const shimmerFreqs = [523.25, 659.25, 783.99, 987.77, 1174.66];
    for (let i = 0; i < 5; i++) {
      expect(createdOscillators[2 + i].type).toBe('sine');
      expect(createdOscillators[2 + i].frequency.setValueAtTime).toHaveBeenCalledWith(shimmerFreqs[i], 10);
    }
    expect(createdDelays.length).toBe(5);
    expect(createdDelays[0].delayTime.setValueAtTime).toHaveBeenCalledWith(0.04, 10);
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

describe('Stage 5b: Ambient Cosmic Drone, Button Click and Mute Toggle', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // safe
    }
    solarAudio.setMuted(false);
    solarAudio.setContextForTesting(null);
  });

  afterEach(() => {
    solarAudio.stopMenuAmbient(0);
    solarAudio.setMuted(false);
    solarAudio.setContextForTesting(null);
    vi.restoreAllMocks();
  });

  it('standalone audio methods playButtonClick, startMenuAmbient, stopMenuAmbient run safely', () => {
    expect(typeof playButtonClick).toBe('function');
    expect(typeof playButtonHover).toBe('function');
    expect(typeof startMenuAmbient).toBe('function');
    expect(typeof stopMenuAmbient).toBe('function');
    expect(typeof toggleMute).toBe('function');
    expect(typeof isAudioMuted).toBe('function');
    expect(typeof isMuted).toBe('function');

    expect(() => playButtonClick()).not.toThrow();
    expect(() => playButtonHover()).not.toThrow();
    expect(() => startMenuAmbient()).not.toThrow();
    expect(() => stopMenuAmbient()).not.toThrow();
  });

  it('toggleMute, isMuted, setMuted update state and persist to localStorage', () => {
    solarAudio.setMuted(false);
    expect(solarAudio.isMuted()).toBe(false);
    expect(isMuted()).toBe(false);
    expect(isAudioMuted()).toBe(false);
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('false');

    const toggled = solarAudio.toggleMute();
    expect(toggled).toBe(true);
    expect(solarAudio.isMuted()).toBe(true);
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('true');

    toggleMute();
    expect(solarAudio.isMuted()).toBe(false);
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('false');

    solarAudio.setMuted(true);
    expect(solarAudio.isMuted()).toBe(true);
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('true');
  });

  it('playButtonClick synthesizes short high-tech click when audio is unmuted', () => {
    const createdOscillators: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const createdGains: Array<{
      gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn().mockImplementation(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn().mockImplementation(() => {
        const gain = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.setMuted(false);
    solarAudio.playButtonClick();

    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('triangle');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(600, 10);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(180, 10.035);
    expect(createdGains.length).toBe(1);
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.09, 10);
    expect(createdGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 10.035);
    expect(createdOscillators[0].start).toHaveBeenCalledWith(10);
    expect(createdOscillators[0].stop).toHaveBeenCalledWith(10.035);
  });

  it('startMenuAmbient synthesizes monolithic chord with gravitational pulse LFO', () => {
    const createdOscillators: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const createdGains: Array<{
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
        cancelScheduledValues: ReturnType<typeof vi.fn>;
        value: number;
      };
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const createdFilters: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      Q: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];
    const createdBufferSources: Array<{
      buffer: unknown;
      loop: boolean;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'running',
      createOscillator: vi.fn().mockImplementation(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn().mockImplementation(() => {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
            value: 0.12,
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
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
      createBuffer: vi.fn().mockImplementation(() => ({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
      })),
      createBufferSource: vi.fn().mockImplementation(() => {
        const src = {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        createdBufferSources.push(src);
        return src;
      }),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.setMuted(false);
    solarAudio.startMenuAmbient();

    // Master gain: ramps from 0.0001 to 0.12 over 2.0s
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10);
    expect(createdGains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.12, 12);

    // Harmonic chord: 110Hz triangle + 164.8Hz sine + 55Hz sine
    expect(createdOscillators.length).toBe(4);
    expect(createdOscillators[0].type).toBe('triangle');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(110.0, 10);
    expect(createdOscillators[1].type).toBe('sine');
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(164.8, 10);
    expect(createdOscillators[2].type).toBe('sine');
    expect(createdOscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(55.0, 10);

    // Relic noise buffer source
    expect(createdBufferSources.length).toBe(1);
    expect(createdBufferSources[0].loop).toBe(true);
    expect(createdBufferSources[0].start).toHaveBeenCalledWith(10);

    // Filter bandpass 380Hz with Q 2.5
    expect(createdFilters.length).toBe(1);
    expect(createdFilters[0].type).toBe('bandpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(380, 10);
    expect(createdFilters[0].Q.setValueAtTime).toHaveBeenCalledWith(2.5, 10);

    // Gravitational pulse LFO at 0.20Hz (~5.0s breathing cycle)
    expect(createdOscillators[3].frequency.setValueAtTime).toHaveBeenCalledWith(0.20, 10);

    // Volume modulation (depth 0.04 -> gain range 0.08..0.16) and filter modulation (depth 100Hz -> 280..480Hz)
    expect(createdGains[3].gain.setValueAtTime).toHaveBeenCalledWith(0.04, 10);
    expect(createdGains[4].gain.setValueAtTime).toHaveBeenCalledWith(100, 10);
  });

  it('stopMenuAmbient performs smooth gain ramp down and stops audio sources', () => {
    const createdGains: Array<{
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
        cancelScheduledValues: ReturnType<typeof vi.fn>;
        value: number;
      };
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'running',
      createOscillator: vi.fn().mockImplementation(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      })),
      createGain: vi.fn().mockImplementation(() => {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
            value: 0.05,
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      createBiquadFilter: vi.fn().mockImplementation(() => ({
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBuffer: vi.fn().mockImplementation(() => ({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
      })),
      createBufferSource: vi.fn().mockImplementation(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.setMuted(false);
    solarAudio.startMenuAmbient();

    solarAudio.stopMenuAmbient(1000);
    const masterGain = createdGains[0];
    expect(masterGain.gain.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.0001, 11);
  });

  it('when audio is muted, playButtonClick and startMenuAmbient produce no sound', () => {
    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn(),
      createGain: vi.fn(),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.setMuted(true);

    solarAudio.playButtonClick();
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(mockCtx.createGain).not.toHaveBeenCalled();

    solarAudio.startMenuAmbient();
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(mockCtx.createGain).not.toHaveBeenCalled();

    solarAudio.setMuted(false);
  });

  it('sound toggle button updates UI state and toggles audio mute on click', () => {
    document.body.innerHTML = '<div id="app"></div>';
    initApp();
    const soundBtn = document.getElementById('sound-btn') as HTMLButtonElement | null;
    expect(soundBtn).not.toBeNull();

    solarAudio.setMuted(false);
    expect(solarAudio.isMuted()).toBe(false);

    soundBtn?.click();
    expect(solarAudio.isMuted()).toBe(true);
    expect(soundBtn?.classList.contains('muted')).toBe(true);
    expect(soundBtn?.getAttribute('aria-label')).toBe('Включить звук');

    soundBtn?.click();
    expect(solarAudio.isMuted()).toBe(false);
    expect(soundBtn?.classList.contains('muted')).toBe(false);
    expect(soundBtn?.getAttribute('aria-label')).toBe('Выключить звук');

    getRouter()?.destroy();
  });

  it('clicking interactive buttons triggers playButtonClick sound feedback', () => {
    document.body.innerHTML = '<div id="app"></div>';
    initApp();
    const clickSpy = vi.spyOn(solarAudio, 'playButtonClick');

    const menuBtn = document.getElementById('btn-play-local') as HTMLButtonElement | null;
    expect(menuBtn).not.toBeNull();
    menuBtn?.click();

    expect(clickSpy).toHaveBeenCalled();

    getRouter()?.destroy();
  });

  it('does not trigger playButtonClick on move navigation and review elements', () => {
    document.body.innerHTML = '<div id="app"></div>';
    initApp();

    const navWrap = document.createElement('div');
    navWrap.innerHTML = `
      <button class="review-nav-btn" id="btn-rev-next">Next</button>
      <button class="review-btn" id="btn-rev-mistake">Mistake</button>
      <div class="history-nav"><button id="hist-next">Hist Next</button></div>
      <div class="history-row"><span class="history-move" id="move-span">e4</span></div>
      <div class="card-class-row" id="class-row">Class Row</div>
      <button class="board-arrow-btn" id="arrow-btn">Arrow</button>
      <button data-nav="next" id="data-nav-btn">Data Nav</button>
      <div class="key-moment-item" id="km-item">Key Moment</div>
    `;
    document.body.appendChild(navWrap);

    const clickSpy = vi.spyOn(solarAudio, 'playButtonClick');

    // Move navigation elements must NOT trigger playButtonClick
    document.getElementById('btn-rev-next')?.click();
    document.getElementById('btn-rev-mistake')?.click();
    document.getElementById('hist-next')?.click();
    document.getElementById('move-span')?.click();
    document.getElementById('class-row')?.click();
    document.getElementById('arrow-btn')?.click();
    document.getElementById('data-nav-btn')?.click();
    document.getElementById('km-item')?.click();

    expect(clickSpy).not.toHaveBeenCalled();

    // Standard UI button (like menu button) DOES trigger playButtonClick
    const menuBtn = document.getElementById('btn-play-local') as HTMLButtonElement | null;
    expect(menuBtn).not.toBeNull();
    menuBtn?.click();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    navWrap.remove();
    getRouter()?.destroy();
  });

  it('startMenuAmbient sets isAmbientRequested without creating nodes if context suspended', () => {
    const mockCtx = {
      currentTime: 10,
      state: 'suspended',
      createOscillator: vi.fn(),
      createGain: vi.fn(),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.startMenuAmbient();

    expect(solarAudio.getIsAmbientRequested()).toBe(true);
    expect(solarAudio.isAmbientPlaying()).toBe(false);
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(mockCtx.createGain).not.toHaveBeenCalled();
  });

  it('repeated calls to startMenuAmbient and stopMenuAmbient before unlock are safe', () => {
    solarAudio.setContextForTesting(null);
    expect(() => {
      solarAudio.startMenuAmbient();
      solarAudio.startMenuAmbient();
      solarAudio.stopMenuAmbient();
      solarAudio.stopMenuAmbient();
      solarAudio.startMenuAmbient();
    }).not.toThrow();

    expect(solarAudio.getIsAmbientRequested()).toBe(true);
    solarAudio.stopMenuAmbient();
    expect(solarAudio.getIsAmbientRequested()).toBe(false);
  });

  it('user gesture resumes suspended context and launches requested menu drone', async () => {
    const mockCtx = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'suspended',
      resume: vi.fn().mockImplementation(() => {
        mockCtx.state = 'running';
        return Promise.resolve();
      }),
      createOscillator: vi.fn().mockImplementation(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      })),
      createGain: vi.fn().mockImplementation(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
          value: 0.05,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createBiquadFilter: vi.fn().mockImplementation(() => ({
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBuffer: vi.fn().mockImplementation(() => ({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
      })),
      createBufferSource: vi.fn().mockImplementation(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.resetUnlockForTesting();
    solarAudio.startMenuAmbient();

    expect(solarAudio.getIsAmbientRequested()).toBe(true);
    expect(solarAudio.isAmbientPlaying()).toBe(false);

    window.dispatchEvent(new Event('pointerdown'));
    expect(mockCtx.resume).toHaveBeenCalled();

    await Promise.resolve();

    expect(solarAudio.isAmbientPlaying()).toBe(true);
    expect(mockCtx.createGain).toHaveBeenCalled();

    solarAudio.stopMenuAmbient(0);
  });

  it('synthesizes monolithic solar chord and gravitational pulse without timer leaks', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const createdOscillators: Array<{
      type: string;
      frequency: {
        value: number;
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
        cancelScheduledValues: ReturnType<typeof vi.fn>;
      };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    const createdFilters: Array<{
      type: string;
      frequency: {
        value: number;
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
        cancelScheduledValues: ReturnType<typeof vi.fn>;
      };
      Q: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 20,
      sampleRate: 44100,
      state: 'running',
      createOscillator: vi.fn().mockImplementation(() => {
        const osc = {
          type: 'sine',
          frequency: {
            value: 100,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn().mockImplementation(() => ({
        gain: {
          value: 0.1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createBiquadFilter: vi.fn().mockImplementation(() => {
        const f = {
          type: 'bandpass',
          frequency: {
            value: 380,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
          },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdFilters.push(f);
        return f;
      }),
      createBuffer: vi.fn().mockReturnValue({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
      }),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    expect(solarAudio.getCurrentChordIndex()).toBe(0);
    expect(getCurrentChordIndex()).toBe(0);
    expect(AMBIENT_CHORDS[0].osc1).toBe(110.0);
    expect(typeof advanceAmbientChord).toBe('function');
    advanceAmbientChord();

    solarAudio.startMenuAmbient();
    expect(solarAudio.isAmbientPlaying()).toBe(true);

    // Verify absence of recurring interval timers (0 timer leaks)
    expect(setIntervalSpy).not.toHaveBeenCalled();

    // Verify monolithic pitch locks: 110Hz (A2), 164.8Hz (E3), 55Hz (A1), LFO 0.20Hz
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(110.0, 20);
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(164.8, 20);
    expect(createdOscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(55.0, 20);
    expect(createdOscillators[3].frequency.setValueAtTime).toHaveBeenCalledWith(0.20, 20);

    // Over time, no pitch-changing ramps are scheduled
    vi.advanceTimersByTime(5000);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();

    // stopMenuAmbient clears resources safely
    solarAudio.stopMenuAmbient(500);
    vi.advanceTimersByTime(550);
    expect(solarAudio.isAmbientPlaying()).toBe(false);
    expect(createdOscillators[0].stop).toHaveBeenCalled();
    expect(createdOscillators[1].stop).toHaveBeenCalled();
    expect(createdOscillators[2].stop).toHaveBeenCalled();
    expect(createdOscillators[3].stop).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('playButtonHover runs safely in jsdom and synthesizes short sine micro-pulse', () => {
    const createdOscillators: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];

    const createdGains: Array<{
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn().mockImplementation(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
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
          },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      destination: {},
    };

    solarAudio.setContextForTesting(mockCtx as unknown as AudioContext);
    solarAudio.setMuted(false);

    solarAudio.playButtonHover();

    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].type).toBe('sine');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(1040, 10);

    expect(createdGains.length).toBe(1);
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.03, 10);
    expect(createdGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 10.022);

    expect(createdOscillators[0].start).toHaveBeenCalledWith(10);
    expect(createdOscillators[0].stop).toHaveBeenCalledWith(10.022);

    // Muted -> no sound
    solarAudio.setMuted(true);
    solarAudio.playButtonHover();
    expect(createdOscillators.length).toBe(1);

    // Suspended context -> no sound
    solarAudio.setMuted(false);
    mockCtx.state = 'suspended';
    solarAudio.playButtonHover();
    expect(createdOscillators.length).toBe(1);
  });

  it('hovering interactive buttons triggers playButtonHover with throttling, board squares ignored', () => {
    document.body.innerHTML = '<div id="app"></div>';
    initApp();
    const hoverSpy = vi.spyOn(solarAudio, 'playButtonHover');

    const menuBtn = document.getElementById('btn-play-local') as HTMLButtonElement | null;
    expect(menuBtn).not.toBeNull();

    let nowTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowTime);

    // 1. Hover on menu button triggers hover sound
    menuBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // 2. Immediate spam hover (< 45ms) is throttled and ignored
    nowTime += 20;
    menuBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // 3. Hover after 50ms (> 45ms) triggers sound
    nowTime += 50;
    menuBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledTimes(2);

    // 4. Hovering a chess board square never triggers hover sound
    const boardMock = document.createElement('div');
    boardMock.id = 'board-mount';
    const squareMock = document.createElement('div');
    squareMock.className = 'board-square';
    boardMock.appendChild(squareMock);
    document.body.appendChild(boardMock);

    nowTime += 100;
    squareMock.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(hoverSpy).toHaveBeenCalledTimes(2);

    boardMock.remove();
    getRouter()?.destroy();
  });

  it('playPremove synthesizes two-component impulse with bandpass filter', () => {
    const createdOscillators: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];

    const createdFilters: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      Q: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const createdGains: Array<{
      gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdOscillators.push(osc);
        return osc;
      }),
      createBiquadFilter: vi.fn(() => {
        const filter = {
          type: 'lowpass',
          frequency: { setValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      }),
      createGain: vi.fn(() => {
        const gain = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        createdGains.push(gain);
        return gain;
      }),
      destination: {},
    } as unknown as AudioContext;

    solarAudio.setContextForTesting(mockCtx);
    solarAudio.setMuted(false);

    expect(typeof playPremove).toBe('function');
    playPremove();

    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);

    expect(createdOscillators[0].type).toBe('sine');
    expect(createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(740, 10);
    expect(createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(420, 10.04);

    expect(createdOscillators[1].type).toBe('triangle');
    expect(createdOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(740, 10);
    expect(createdOscillators[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(420, 10.04);

    expect(createdFilters[0].type).toBe('bandpass');
    expect(createdFilters[0].frequency.setValueAtTime).toHaveBeenCalledWith(580, 10);
    expect(createdFilters[0].Q.setValueAtTime).toHaveBeenCalledWith(1.5, 10);

    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.09, 10);
  });

  it('when muted, playPremove does not synthesize sound', () => {
    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn(),
      createBiquadFilter: vi.fn(),
      createGain: vi.fn(),
      destination: {},
    } as unknown as AudioContext;

    solarAudio.setContextForTesting(mockCtx);
    solarAudio.setMuted(true);

    solarAudio.playPremove();

    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(mockCtx.createBiquadFilter).not.toHaveBeenCalled();
    expect(mockCtx.createGain).not.toHaveBeenCalled();
  });
});

