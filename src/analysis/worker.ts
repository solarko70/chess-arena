/**
 * Web Worker entry point for running game review with OwnEngine off the main thread.
 */
import type { GameState } from '@/core';
import { OwnEngine } from './engine';
import { reviewGame, type GameReviewResult, type ReviewProgress } from './review';

export interface ReviewWorkerRequest {
  type: 'review' | 'cancel';
  id: number;
  game?: GameState | readonly GameState[];
  options?: {
    depth?: number;
    multiPV?: number;
  };
}

export type ReviewWorkerResponse =
  | {
      type: 'progress';
      id: number;
      progress: ReviewProgress;
    }
  | {
      type: 'result';
      id: number;
      result: GameReviewResult;
    }
  | {
      type: 'error';
      id: number;
      message: string;
    };

let activeAbortController: AbortController | null = null;
let activeRequestId: number | null = null;

export async function handleReviewWorkerMessage(
  msg: ReviewWorkerRequest,
  reply: (res: ReviewWorkerResponse) => void,
): Promise<void> {
  if (msg.type === 'cancel') {
    if (activeRequestId === null || msg.id === undefined || msg.id === activeRequestId) {
      activeAbortController?.abort();
      activeAbortController = null;
      activeRequestId = null;
    }
    return;
  }

  if (msg.type === 'review') {
    if (!msg.game) {
      reply({ type: 'error', id: msg.id, message: 'No game state provided for review' });
      return;
    }

    activeAbortController?.abort();
    const controller = new AbortController();
    activeAbortController = controller;
    activeRequestId = msg.id;

    const engine = new OwnEngine();
    try {
      const result = await reviewGame(msg.game, engine, {
        depth: msg.options?.depth ?? 6,
        multiPV: msg.options?.multiPV ?? 2,
        signal: controller.signal,
        onProgress: (progress) => {
          if (controller.signal.aborted) return;
          reply({ type: 'progress', id: msg.id, progress });
        },
      });

      if (controller.signal.aborted) return;
      reply({ type: 'result', id: msg.id, result });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Unknown review worker error';
      reply({ type: 'error', id: msg.id, message });
    } finally {
      engine.dispose();
      if (activeRequestId === msg.id) {
        activeAbortController = null;
        activeRequestId = null;
      }
    }
  }
}

// Attach listener in real Web Worker environment
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<ReviewWorkerRequest>) => {
    void handleReviewWorkerMessage(event.data, (res) => {
      self.postMessage(res);
    });
  };
}

