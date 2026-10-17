import { ChessStore, TimeControlMode } from '@/state/store';
import type { Color } from '@/core';

export class ClockWidget {
  private container: HTMLElement;
  private store: ChessStore;
  private whiteTimerEl!: HTMLElement;
  private blackTimerEl!: HTMLElement;
  private selectEl!: HTMLSelectElement;

  constructor(container: HTMLElement, store: ChessStore, onTimeout?: (loser: Color) => void) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="clock-panel" id="clock-panel" style="display: none;">
        <div class="clock-box white-clock" id="white-clock-box">
          <span class="clock-label">Белые</span>
          <span class="clock-time" id="white-time">--:--</span>
        </div>
        <div class="clock-controls">
          <select id="time-control-select" class="clock-select">
            <option value="none">Без часов</option>
            <option value="bullet-1-0">Bullet 1+0</option>
            <option value="blitz-3-2">Blitz 3+2</option>
            <option value="blitz-5-0">Blitz 5+0</option>
            <option value="rapid-10-0">Rapid 10+0</option>
            <option value="rapid-15-10">Rapid 15+10</option>
          </select>
        </div>
        <div class="clock-box black-clock" id="black-clock-box">
          <span class="clock-label">Чёрные</span>
          <span class="clock-time" id="black-time">--:--</span>
        </div>
      </div>
    `;

    this.whiteTimerEl = this.container.querySelector('#white-time') as HTMLElement;
    this.blackTimerEl = this.container.querySelector('#black-time') as HTMLElement;
    this.selectEl = this.container.querySelector('#time-control-select') as HTMLSelectElement;

    this.initEvents(onTimeout);
    this.store.subscribe(() => this.render());
  }

  private initEvents(onTimeout?: (loser: Color) => void): void {
    this.selectEl.addEventListener('change', () => {
      const mode = this.selectEl.value as TimeControlMode;
      this.store.setClockMode(mode, onTimeout);
      this.render();
    });
  }

  public render(): void {
    const mode = this.store.getClockMode();
    const panelEl = this.container.querySelector('#clock-panel') as HTMLElement;

    if (mode === 'none') {
      panelEl.style.display = 'none';
      return;
    }

    panelEl.style.display = 'flex';
    const whiteMs = this.store.getTime('white');
    const blackMs = this.store.getTime('black');

    this.whiteTimerEl.textContent = formatMs(whiteMs);
    this.blackTimerEl.textContent = formatMs(blackMs);
  }
}

function formatMs(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
