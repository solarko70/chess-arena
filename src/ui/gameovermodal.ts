import { ChessStore } from '@/state/store';

export interface GameOverModalOptions {
  onStartReview?: () => void;
  onNewGame?: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1 с';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} с`;
  return `${min} мин ${sec} с`;
}

export class GameOverModalUI {
  private container: HTMLElement;
  private store: ChessStore;
  private options?: GameOverModalOptions;
  private unsubscribe: (() => void) | null = null;
  private isOpenState = false;
  private previousActiveElement: HTMLElement | null = null;

  // DOM Elements
  private overlay!: HTMLElement;
  private dialog!: HTMLElement;
  private closeBtn!: HTMLButtonElement;
  private verdictEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private reasonEl!: HTMLElement;
  private movesEl!: HTMLElement;
  private durationEl!: HTMLElement;
  private materialEl!: HTMLElement;
  private reviewSummaryEl!: HTMLElement;
  private reviewBtn!: HTMLButtonElement;
  private newGameBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, store: ChessStore, options?: GameOverModalOptions) {
    this.container = container;
    this.store = store;
    this.options = options;

    this.renderSkeleton();
    this.attachEvents();

    this.unsubscribe = this.store.subscribe(() => {
      this.handleStoreUpdate();
    });
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="game-over-overlay" id="game-over-overlay" style="display: none;">
        <div class="game-over-dialog" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <button class="game-over-close-btn" id="game-over-close-btn" aria-label="Закрыть">✕</button>
          <div class="game-over-content">
            <div class="game-over-verdict" id="game-over-verdict" style="display: none;"></div>
            <h2 class="game-over-title" id="game-over-title"></h2>
            <p class="game-over-reason" id="game-over-reason"></p>

            <div class="game-over-stats">
              <div class="game-over-stat-item">
                <span class="stat-label">Ходов:</span>
                <span class="stat-value" id="game-over-moves"></span>
              </div>
              <div class="game-over-stat-item">
                <span class="stat-label">Длительность:</span>
                <span class="stat-value" id="game-over-duration"></span>
              </div>
              <div class="game-over-stat-item">
                <span class="stat-label">Потери материала:</span>
                <span class="stat-value" id="game-over-material"></span>
              </div>
            </div>

            <div class="game-over-review-summary" id="game-over-review-summary"></div>

            <div class="game-over-actions">
              <button class="btn-action btn-modal-primary" id="btn-modal-review">Разбор партии</button>
              <button class="btn-action btn-modal-secondary" id="btn-modal-new-game">Новая партия</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.overlay = this.container.querySelector('#game-over-overlay') as HTMLElement;
    this.dialog = this.container.querySelector('.game-over-dialog') as HTMLElement;
    this.closeBtn = this.container.querySelector('#game-over-close-btn') as HTMLButtonElement;
    this.verdictEl = this.container.querySelector('#game-over-verdict') as HTMLElement;
    this.titleEl = this.container.querySelector('#game-over-title') as HTMLElement;
    this.reasonEl = this.container.querySelector('#game-over-reason') as HTMLElement;
    this.movesEl = this.container.querySelector('#game-over-moves') as HTMLElement;
    this.durationEl = this.container.querySelector('#game-over-duration') as HTMLElement;
    this.materialEl = this.container.querySelector('#game-over-material') as HTMLElement;
    this.reviewSummaryEl = this.container.querySelector('#game-over-review-summary') as HTMLElement;
    this.reviewBtn = this.container.querySelector('#btn-modal-review') as HTMLButtonElement;
    this.newGameBtn = this.container.querySelector('#btn-modal-new-game') as HTMLButtonElement;
  }

  private attachEvents(): void {
    this.closeBtn.addEventListener('click', () => {
      this.hide(true);
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide(true);
      }
    });

    this.reviewBtn.addEventListener('click', () => {
      this.hide(true);
      if (this.options?.onStartReview) {
        this.options.onStartReview();
      } else {
        const startReviewBtn = document.getElementById('btn-start-review') as HTMLButtonElement | null;
        startReviewBtn?.click();
      }
    });

    this.newGameBtn.addEventListener('click', () => {
      this.hide(true);
      if (this.options?.onNewGame) {
        this.options.onNewGame();
      } else {
        const mainNewGameBtn = document.getElementById('btn-new-game') as HTMLButtonElement | null;
        mainNewGameBtn?.click();
      }
    });

    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpenState) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide(true);
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = Array.from(
        this.dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

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

  private handleStoreUpdate(): void {
    if (this.store.canShowGameOverModal()) {
      if (!this.isOpenState) {
        this.show();
      } else {
        this.renderContent();
      }
    } else {
      if (this.isOpenState) {
        this.hide(false);
      }
    }
  }

  public show(): void {
    this.previousActiveElement = document.activeElement as HTMLElement | null;
    this.renderContent();
    this.overlay.style.display = 'flex';
    this.isOpenState = true;
    setTimeout(() => {
      if (this.isOpenState) {
        this.reviewBtn.focus();
      }
    }, 0);
  }

  public hide(dismiss = true): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.overlay.style.display = 'none';

    if (dismiss) {
      this.store.setGameOverModalDismissed(true);
    }

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch {
        // Ignore focus restore errors
      }
    }
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public renderContent(): void {
    const result = this.store.getGameResult();
    const timedOutLoser = this.store.getTimedOutLoser();
    const gameMode = this.store.getGameMode();

    // 1. AI Verdict banner
    if (gameMode === 'ai') {
      const playerColor = this.store.getPlayerColor();
      this.verdictEl.style.display = 'block';

      let verdict = '';
      let verdictClass = '';

      if (timedOutLoser !== null) {
        if (timedOutLoser !== playerColor) {
          verdict = 'Вы выиграли';
          verdictClass = 'verdict-win';
        } else {
          verdict = 'Вы проиграли';
          verdictClass = 'verdict-loss';
        }
      } else if (result.type === 'checkmate') {
        if (result.winner === playerColor) {
          verdict = 'Вы выиграли';
          verdictClass = 'verdict-win';
        } else {
          verdict = 'Вы проиграли';
          verdictClass = 'verdict-loss';
        }
      } else if (result.type !== 'ongoing') {
        verdict = 'Ничья';
        verdictClass = 'verdict-draw';
      }

      this.verdictEl.textContent = verdict;
      this.verdictEl.className = `game-over-verdict ${verdictClass}`;
    } else {
      this.verdictEl.style.display = 'none';
    }

    // 2. Title & Reason
    let title = '';
    let reason = '';

    if (timedOutLoser !== null) {
      if (timedOutLoser === 'black') {
        title = 'Время чёрных истекло. Победили белые';
        reason = 'У чёрных закончилось время на обдумывание';
      } else {
        title = 'Время белых истекло. Победили чёрные';
        reason = 'У белых закончилось время на обдумывание';
      }
    } else if (result.type === 'checkmate') {
      if (result.winner === 'white') {
        title = 'Мат. Победили белые';
        reason = 'Король чёрных атакован и не имеет защиты';
      } else {
        title = 'Мат. Победили чёрные';
        reason = 'Король белых атакован и не имеет защиты';
      }
    } else if (result.type === 'stalemate') {
      title = 'Ничья: пат';
      reason = 'У стороны нет возможных ходов, и король не находится под шахом';
    } else if (result.type === 'threefoldRepetition') {
      title = 'Ничья: троекратное повторение';
      reason = 'Одна и та же позиция повторилась на доске трижды';
    } else if (result.type === 'fiftyMoveRule') {
      title = 'Ничья: правило 50 ходов';
      reason = 'За последние 50 ходов не было сделано взятий и движений пешек';
    } else if (result.type === 'insufficientMaterial') {
      title = 'Ничья: недостаточно материала';
      reason = 'Оставшихся фигур недостаточно для постановки мата';
    }

    this.titleEl.textContent = title;
    this.reasonEl.textContent = reason;

    // 3. Stats: Moves, Duration, Material
    const plies = this.store.getLiveState().history.length;
    const fullMoves = Math.ceil(plies / 2);
    this.movesEl.textContent = `${fullMoves} (полуходов: ${plies})`;

    const durationMs = this.store.getGameDurationMs();
    this.durationEl.textContent = formatDuration(durationMs);

    const lost = this.store.getLostMaterial();
    this.materialEl.textContent = `Белые: −${lost.white} очков | Чёрные: −${lost.black} очков`;

    // 4. Review summary
    const review = this.store.getReviewResult();
    if (review) {
      this.reviewSummaryEl.innerHTML = `
        <div class="game-over-review-data">
          <div class="review-stat-row">
            <span class="review-side">Белые:</span>
            <span class="review-acc">Точность ${review.accuracy.white.toFixed(1)}%</span>
            <span class="review-counts">(неточностей: ${review.counts.white.inaccuracy}, ошибок: ${review.counts.white.mistake}, зевков: ${review.counts.white.blunder})</span>
          </div>
          <div class="review-stat-row">
            <span class="review-side">Чёрные:</span>
            <span class="review-acc">Точность ${review.accuracy.black.toFixed(1)}%</span>
            <span class="review-counts">(неточностей: ${review.counts.black.inaccuracy}, ошибок: ${review.counts.black.mistake}, зевков: ${review.counts.black.blunder})</span>
          </div>
        </div>
      `;
    } else {
      this.reviewSummaryEl.innerHTML = `
        <div class="game-over-review-placeholder">Разбор партии покажет точность и ключевые моменты</div>
      `;
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    document.removeEventListener('keydown', this.handleKeyDown);
    this.container.innerHTML = '';
  }
}

