/**
 * Web Worker entry point for running AI search off the main thread.
 */
import type { GameState, Move } from '@/core';
import { findBestMove, LEVELS, type LevelConfig, type LevelId } from './levels';

export type WorkerRequest =
  | {
      type: 'search';
      id: number;
      state: GameState;
      level: LevelId | LevelConfig;
      timeMs?: number;
    }
  | {
      type: 'cancel';
      id?: number;
    };

export type WorkerResponse =
  | {
      type: 'result';
      id: number;
      move: Move | null;
      elapsedMs: number;
    }
  | {
      type: 'error';
      id: number;
      message: string;
    };

let cancelledUpToId = 0;

export function handleWorkerMessage(
  msg: WorkerRequest,
  reply: (res: WorkerResponse) => void,
): void {
  if (msg.type === 'cancel') {
    if (msg.id !== undefined) {
      cancelledUpToId = Math.max(cancelledUpToId, msg.id);
    } else {
      cancelledUpToId = Number.MAX_SAFE_INTEGER;
    }
    return;
  }

  if (msg.type === 'search') {
    if (msg.id <= cancelledUpToId && cancelledUpToId !== Number.MAX_SAFE_INTEGER) {
      return;
    }
    if (cancelledUpToId === Number.MAX_SAFE_INTEGER) {
      cancelledUpToId = msg.id - 1;
    }

    const start = Date.now();
    try {
      const baseCfg = typeof msg.level === 'string' ? LEVELS[msg.level] : msg.level;
      const cfg: LevelConfig =
        msg.timeMs !== undefined ? { ...baseCfg, timeMs: msg.timeMs } : baseCfg;
      const move = findBestMove(msg.state, cfg);
      const elapsedMs = Date.now() - start;

      if (msg.id <= cancelledUpToId) return;
      reply({ type: 'result', id: msg.id, move, elapsedMs });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown worker error';
      reply({ type: 'error', id: msg.id, message });
    }
  }
}

// Attach to Web Worker global scope when running inside a real worker
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const msg = event.data;
    handleWorkerMessage(msg, (res) => {
      if (msg.type === 'search' && res.type === 'result') {
        const levelId = typeof msg.level === 'string' ? msg.level : msg.level.id;
        const isWeakLevel = levelId === 'novice' || levelId === 'student' || levelId === 'amateur' || levelId === 'club';
        if (isWeakLevel) {
          const targetDelay = 300 + Math.floor(Math.random() * 301); // 300..600 ms
          const remaining = targetDelay - res.elapsedMs;
          if (remaining > 0) {
            setTimeout(() => {
              if (msg.id <= cancelledUpToId) return;
              self.postMessage(res);
            }, remaining);
            return;
          }
        }
      }
      self.postMessage(res);
    });
  };
}

