import { ChessClock, TimeControlMode } from '@/state/clock';
import { ChessStore } from '@/state/store';

export class ClockWidget {
  private container: HTMLElement;
  private store: ChessStore;
  private clock: ChessClock;
  private whiteTimerEl!: HTMLElement;
  private blackTimerEl!: HTMLElement;
  private selectEl!: HTMLSelectElement;

  constructor(container: HTMLElement, store: ChessStore, clock: ChessClock) {
    this.container = container;
    this.store = store;
    this.clock = clock;

    this.container.innerHTML = `
      <div class="clock-panel">
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

    this.initEvents();
  }

  private initEvents(): void {
    this.selectEl.addEventListener('change', () => {
      const mode = this.selectEl.value as TimeControlMode;
      this.clock.setMode(mode);
      this.renderTimes();
    });

    // Whenever store state changes (move made, undo, new game)
    let prevHistoryLen = 0;
    this.store.subscribe((state) => {
      const mode = this.clock.getMode();
      if (mode === 'none') {
        this.container.style.display = 'none';
        return;
      } else {
        this.container.style.display = 'flex';
      }

      const historyLen = state.history.length;
      if (historyLen === 0) {
        // Reset clock
        this.clock.reset();
        this.renderTimes();
        prevHistoryLen = 0;
      } else if (historyLen > prevHistoryLen) {
        // Move made -> switch turn in clock
        this.clock.switchTurn(state.turn);
        prevHistoryLen = historyLen;
      } else if (historyLen < prevHistoryLen) {
        // Undo -> reset or adjust
        this.clock.reset(); // simplified reset on undo for robustness
        prevHistoryLen = historyLen;
      }

      if (!this.clock.isActive() && historyLen > 0) {
        this.clock.start(state.turn);
      }

      this.renderTimes();
    });
  }

  public renderTimes(): void {
    const mode = this.clock.getMode();
    if (mode === 'none') {
      this.whiteTimerEl.textContent = '--:--';
      this.blackTimerEl.textContent = '--:--';
      return;
    }

    const whiteMs = this.clock.getTime('white');
    const blackMs = this.clock.getTime('black');

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
