import type { TimeControlMode, GameMode, PlayerColorChoice } from '@/state/store';
import { TIME_CONTROLS } from '@/state/store';
import { LEVELS, type LevelId } from '@/ai';
import { getPieceSvg } from '@/ui/pieces';
import { createSolarDecorLayer, type SolarDecorElement } from '@/ui/solar-decor';

export const LOCAL_SETUP_STORAGE_KEY = 'chess_arena_setup_local';
export const BOT_SETUP_STORAGE_KEY = 'chess_arena_setup_bot';

export interface StartGameParams {
  mode: GameMode;
  timeControl: TimeControlMode;
  level?: LevelId;
  playerColor?: PlayerColorChoice;
}

export interface TimeCardOption {
  id: TimeControlMode;
  title: string;
  subtitle: string;
}

export interface TimeGroup {
  groupTitle: string;
  options: TimeCardOption[];
}

export const TIME_GROUPS: TimeGroup[] = [
  {
    groupTitle: 'Без часов',
    options: [
      { id: 'none', title: 'Без часов', subtitle: 'Без ограничения времени' },
    ],
  },
  {
    groupTitle: 'Пуля 1+0',
    options: [
      { id: 'bullet-1-0', title: '1+0', subtitle: '1 мин на партию' },
    ],
  },
  {
    groupTitle: 'Блиц 3+2 и 5+0',
    options: [
      { id: 'blitz-3-2', title: '3+2', subtitle: '3 мин + 2 с/ход' },
      { id: 'blitz-5-0', title: '5+0', subtitle: '5 мин на партию' },
    ],
  },
  {
    groupTitle: 'Рапид 10+0 и 15+10',
    options: [
      { id: 'rapid-10-0', title: '10+0', subtitle: '10 мин на партию' },
      { id: 'rapid-15-10', title: '15+10', subtitle: '15 мин + 10 с/ход' },
    ],
  },
];

export interface BotLevelOption {
  id: LevelId;
  name: string;
  desc: string;
}

export const BOT_LEVELS: BotLevelOption[] = [
  { id: 'novice', name: 'Новичок', desc: 'часто ошибается' },
  { id: 'amateur', name: 'Любитель', desc: 'ошибается реже' },
  { id: 'club', name: 'Клубный', desc: 'играет уверенно' },
  { id: 'expert', name: 'Эксперт', desc: 'играет сильно' },
  { id: 'master', name: 'Мастер', desc: 'полная сила движка' },
];

export interface LocalSetupState {
  timeControl: TimeControlMode;
}

export interface BotSetupState {
  timeControl: TimeControlMode;
  level: LevelId;
  playerColor: PlayerColorChoice;
}

export function loadSavedLocalSetup(): LocalSetupState {
  try {
    const raw = localStorage.getItem(LOCAL_SETUP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.timeControl && parsed.timeControl in TIME_CONTROLS) {
        return { timeControl: parsed.timeControl };
      }
    }
  } catch {
    // Ignore JSON errors
  }
  return { timeControl: 'rapid-10-0' };
}

export function saveLocalSetup(state: LocalSetupState): void {
  try {
    localStorage.setItem(LOCAL_SETUP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedBotSetup(): BotSetupState {
  try {
    const raw = localStorage.getItem(BOT_SETUP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validTime = parsed.timeControl && parsed.timeControl in TIME_CONTROLS;
      const validLevel = parsed.level && parsed.level in LEVELS;
      const validColor = ['white', 'black', 'random'].includes(parsed.playerColor);
      if (validTime && validLevel && validColor) {
        return {
          timeControl: parsed.timeControl,
          level: parsed.level,
          playerColor: parsed.playerColor,
        };
      }
    }
  } catch {
    // Ignore JSON errors
  }
  return {
    timeControl: 'rapid-10-0',
    level: 'club',
    playerColor: 'white',
  };
}

export function saveBotSetup(state: BotSetupState): void {
  try {
    localStorage.setItem(BOT_SETUP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export class GameSetupModalUI {
  private container: HTMLElement;
  private onStart: (params: StartGameParams) => void;
  private isOpenState = false;
  private currentMode: 'local' | 'bot' = 'local';
  private triggerElement: HTMLElement | null = null;

  // Selected values
  private selectedTimeControl: TimeControlMode = 'rapid-10-0';
  private selectedLevel: LevelId = 'club';
  private selectedColor: PlayerColorChoice = 'white';

  // DOM Elements
  private overlay!: HTMLElement;
  private dialog!: HTMLElement;
  private closeBtn!: HTMLButtonElement;
  private titleEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private startBtn!: HTMLButtonElement;
  private solarDecor: SolarDecorElement | null = null;

  constructor(container: HTMLElement, onStart: (params: StartGameParams) => void) {
    this.container = container;
    this.onStart = onStart;

    this.renderSkeleton();
    this.attachEvents();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="setup-modal-overlay" id="setup-modal-overlay" style="display: none;">
        <div class="setup-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-modal-title">
          <button class="setup-modal-close" id="btn-setup-close" aria-label="Закрыть">✕</button>
          <div class="setup-modal-header">
            <h2 class="setup-modal-title" id="setup-modal-title"></h2>
          </div>
          <div class="setup-modal-body" id="setup-modal-body"></div>
          <div class="setup-modal-footer">
            <button class="btn-action btn-setup-start" id="btn-setup-start">Начать игру</button>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.container.querySelector('#setup-modal-overlay') as HTMLElement;
    this.dialog = this.container.querySelector('.setup-modal-dialog') as HTMLElement;
    this.closeBtn = this.container.querySelector('#btn-setup-close') as HTMLButtonElement;
    this.titleEl = this.container.querySelector('#setup-modal-title') as HTMLElement;
    this.bodyEl = this.container.querySelector('#setup-modal-body') as HTMLElement;
    this.startBtn = this.container.querySelector('#btn-setup-start') as HTMLButtonElement;
  }

  private attachEvents(): void {
    this.closeBtn.addEventListener('click', () => {
      this.close();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    this.startBtn.addEventListener('click', () => {
      this.handleStartClick();
    });

    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpenState) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = Array.from(
        this.dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !this.dialog.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !this.dialog.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  public open(mode: 'local' | 'bot', triggerElement?: HTMLElement): void {
    this.currentMode = mode;
    this.triggerElement = triggerElement ?? (document.activeElement as HTMLElement | null);

    if (mode === 'local') {
      const saved = loadSavedLocalSetup();
      this.selectedTimeControl = saved.timeControl;
    } else {
      const saved = loadSavedBotSetup();
      this.selectedTimeControl = saved.timeControl;
      this.selectedLevel = saved.level;
      this.selectedColor = saved.playerColor;
    }

    this.renderForm();

    if (this.solarDecor) {
      this.solarDecor.destroy();
      this.solarDecor = null;
    }
    this.solarDecor = createSolarDecorLayer({ withAnimatedPieces: true });
    this.dialog.prepend(this.solarDecor);

    this.overlay.style.display = 'flex';
    this.isOpenState = true;

    try {
      this.startBtn.focus();
    } catch {
      // Ignore
    }

    setTimeout(() => {
      if (this.isOpenState) {
        this.startBtn.focus();
      }
    }, 0);
  }

  public close(): void {
    if (this.solarDecor) {
      this.solarDecor.destroy();
      this.solarDecor = null;
    }

    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.overlay.style.display = 'none';

    if (this.triggerElement && typeof this.triggerElement.focus === 'function') {
      try {
        this.triggerElement.focus();
      } catch {
        // Ignore focus errors
      }
    }
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  private handleStartClick(): void {
    if (this.currentMode === 'local') {
      saveLocalSetup({ timeControl: this.selectedTimeControl });
      this.close();
      this.onStart({
        mode: 'pvp',
        timeControl: this.selectedTimeControl,
      });
    } else {
      saveBotSetup({
        timeControl: this.selectedTimeControl,
        level: this.selectedLevel,
        playerColor: this.selectedColor,
      });
      this.close();
      this.onStart({
        mode: 'ai',
        timeControl: this.selectedTimeControl,
        level: this.selectedLevel,
        playerColor: this.selectedColor,
      });
    }
  }

  private renderForm(): void {
    this.titleEl.textContent = this.currentMode === 'local' ? 'Играть локально' : 'Играть с ботом';

    let html = '';

    // 1. Time Control Section
    html += `
      <div class="setup-section setup-time-section">
        <label class="setup-section-label">Контроль времени</label>
        <div class="setup-time-groups">
    `;

    for (const group of TIME_GROUPS) {
      html += `
        <div class="setup-time-group">
          <div class="setup-time-group-title">${group.groupTitle}</div>
          <div class="setup-time-cards">
      `;
      for (const opt of group.options) {
        const isSelected = opt.id === this.selectedTimeControl;
        html += `
          <button type="button" class="setup-time-card ${isSelected ? 'selected' : ''}" data-time-id="${opt.id}">
            <span class="setup-card-title">${opt.title}</span>
            <span class="setup-card-desc">${opt.subtitle}</span>
          </button>
        `;
      }
      html += `
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    // 2. Bot Options (Level & Color)
    if (this.currentMode === 'bot') {
      html += `
        <div class="setup-section setup-level-section">
          <label class="setup-section-label">Уровень сложности</label>
          <div class="setup-level-cards">
      `;
      for (const lvl of BOT_LEVELS) {
        const isSelected = lvl.id === this.selectedLevel;
        html += `
          <button type="button" class="setup-level-card ${isSelected ? 'selected' : ''}" data-level-id="${lvl.id}">
            <div class="setup-level-header">
              <span class="setup-level-name">${lvl.name}</span>
            </div>
            <span class="setup-level-desc">${lvl.desc}</span>
          </button>
        `;
      }
      html += `
          </div>
        </div>

        <div class="setup-section setup-color-section">
          <label class="setup-section-label">Цвет фигур</label>
          <div class="setup-color-options">
            <button type="button" class="setup-color-card ${this.selectedColor === 'white' ? 'selected' : ''}" data-color-id="white">
              <span class="setup-color-icon">${getPieceSvg('king', 'white')}</span>
              <span class="setup-color-label">Белые</span>
            </button>
            <button type="button" class="setup-color-card ${this.selectedColor === 'random' ? 'selected' : ''}" data-color-id="random">
              <span class="setup-color-icon setup-color-random">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="40" fill="#f8fafc" stroke="#334155" stroke-width="4"/>
                  <path d="M 50 10 A 40 40 0 0 1 50 90 Z" fill="#1e293b"/>
                </svg>
              </span>
              <span class="setup-color-label">Случайно</span>
            </button>
            <button type="button" class="setup-color-card ${this.selectedColor === 'black' ? 'selected' : ''}" data-color-id="black">
              <span class="setup-color-icon">${getPieceSvg('king', 'black')}</span>
              <span class="setup-color-label">Чёрные</span>
            </button>
          </div>
        </div>
      `;
    }

    this.bodyEl.innerHTML = html;

    // Attach card click handlers
    this.bodyEl.querySelectorAll<HTMLButtonElement>('.setup-time-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-time-id') as TimeControlMode;
        if (id) {
          this.selectedTimeControl = id;
          this.bodyEl.querySelectorAll('.setup-time-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });

    if (this.currentMode === 'bot') {
      this.bodyEl.querySelectorAll<HTMLButtonElement>('.setup-level-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-level-id') as LevelId;
          if (id) {
            this.selectedLevel = id;
            this.bodyEl.querySelectorAll('.setup-level-card').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
          }
        });
      });

      this.bodyEl.querySelectorAll<HTMLButtonElement>('.setup-color-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-color-id') as PlayerColorChoice;
          if (id) {
            this.selectedColor = id;
            this.bodyEl.querySelectorAll('.setup-color-card').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
          }
        });
      });
    }
  }

  public destroy(): void {
    this.close();
    document.removeEventListener('keydown', this.handleKeyDown);
    this.container.innerHTML = '';
  }
}
