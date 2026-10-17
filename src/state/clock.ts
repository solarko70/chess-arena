import type { Color } from '@/core';

export type TimeControlMode = 'none' | 'bullet-1-0' | 'blitz-3-2' | 'blitz-5-0' | 'rapid-10-0' | 'rapid-15-10';

export interface TimeControlConfig {
  initialMs: number;
  incrementMs: number;
}

export const TIME_CONTROLS: Record<TimeControlMode, TimeControlConfig> = {
  'none': { initialMs: 0, incrementMs: 0 },
  'bullet-1-0': { initialMs: 60 * 1000, incrementMs: 0 },
  'blitz-3-2': { initialMs: 3 * 60 * 1000, incrementMs: 2 * 1000 },
  'blitz-5-0': { initialMs: 5 * 60 * 1000, incrementMs: 0 },
  'rapid-10-0': { initialMs: 10 * 60 * 1000, incrementMs: 0 },
  'rapid-15-10': { initialMs: 15 * 60 * 1000, incrementMs: 10 * 1000 },
};

export class ChessClock {
  private mode: TimeControlMode = 'none';
  private whiteMs: number = 0;
  private blackMs: number = 0;
  private activeColor: Color | null = null;
  private lastTickTime: number = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private onTimeout?: (loser: Color) => void;
  private onTick?: () => void;
  private hasStarted: boolean = false;

  constructor(onTimeout?: (loser: Color) => void, onTick?: () => void) {
    this.onTimeout = onTimeout;
    this.onTick = onTick;
  }

  setMode(mode: TimeControlMode): void {
    this.mode = mode;
    const config = TIME_CONTROLS[mode];
    this.whiteMs = config.initialMs;
    this.blackMs = config.initialMs;
    this.activeColor = null;
    this.hasStarted = false;
    this.stopInterval();
  }

  getMode(): TimeControlMode {
    return this.mode;
  }

  getTime(color: Color): number {
    return color === 'white' ? this.whiteMs : this.blackMs;
  }

  setTime(whiteMs: number, blackMs: number): void {
    this.whiteMs = whiteMs;
    this.blackMs = blackMs;
  }

  isActive(): boolean {
    return this.activeColor !== null && this.mode !== 'none';
  }

  start(turn: Color): void {
    if (this.mode === 'none') return;
    this.activeColor = turn;
    this.lastTickTime = Date.now();
    this.hasStarted = true;
    this.startInterval();
  }

  switchTurn(nextTurn: Color): void {
    if (this.mode === 'none') return;
    const now = Date.now();
    if (this.activeColor !== null) {
      const elapsed = now - this.lastTickTime;
      if (this.activeColor === 'white') {
        this.whiteMs = Math.max(0, this.whiteMs - elapsed);
      } else {
        this.blackMs = Math.max(0, this.blackMs - elapsed);
      }

      // Add increment if game has started
      if (this.hasStarted) {
        const config = TIME_CONTROLS[this.mode];
        if (this.activeColor === 'white') {
          this.whiteMs += config.incrementMs;
        } else {
          this.blackMs += config.incrementMs;
        }
      }
    }

    // Check timeouts
    if (this.whiteMs <= 0) {
      this.stopInterval();
      this.onTimeout?.('white');
      return;
    }
    if (this.blackMs <= 0) {
      this.stopInterval();
      this.onTimeout?.('black');
      return;
    }

    this.activeColor = nextTurn;
    this.lastTickTime = now;
    this.startInterval();
  }

  pause(): void {
    this.updateTime();
    this.activeColor = null;
    this.stopInterval();
  }

  resume(turn: Color): void {
    if (this.mode === 'none') return;
    this.activeColor = turn;
    this.lastTickTime = Date.now();
    this.startInterval();
  }

  reset(): void {
    this.setMode(this.mode);
  }

  public tick(): void {
    if (this.activeColor === null || this.mode === 'none') return;
    const now = Date.now();
    const elapsed = now - this.lastTickTime;
    this.lastTickTime = now;

    if (this.activeColor === 'white') {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed);
      if (this.whiteMs === 0) {
        this.stopInterval();
        this.onTimeout?.('white');
      }
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed);
      if (this.blackMs === 0) {
        this.stopInterval();
        this.onTimeout?.('black');
      }
    }
    this.onTick?.();
  }

  private updateTime(): void {
    if (this.activeColor === null || this.mode === 'none') return;
    const now = Date.now();
    const elapsed = now - this.lastTickTime;
    this.lastTickTime = now;

    if (this.activeColor === 'white') {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed);
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed);
    }
  }

  private startInterval(): void {
    this.stopInterval();
    if (this.mode === 'none') return;
    this.timerId = setInterval(() => {
      this.tick();
    }, 100);
  }

  private stopInterval(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
