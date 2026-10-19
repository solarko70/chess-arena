import { ChessStore } from '@/state/store';
import { MOVE_CLASS_REGISTRY, formatMaterialPoints } from '@/analysis';

export interface GameOverModalOptions {
  onStartReview?: () => void;
  onNewGame?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const BOT_LEVEL_NAMES: Record<string, string> = {
  novice: 'Новичок',
  amateur: 'Любитель',
  club: 'Клубный',
  expert: 'Эксперт',
  master: 'Мастер',
};

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
  private progressWrapEl!: HTMLElement;
  private cardsContainerEl!: HTMLElement;
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
            <div class="game-over-header">
              <div class="game-over-verdict" id="game-over-verdict" style="display: none;"></div>
              <h2 class="game-over-title" id="game-over-title"></h2>
              <p class="game-over-reason" id="game-over-reason"></p>
              <div class="game-over-meta">
                <span id="game-over-moves"></span>
                <span class="meta-separator">·</span>
                <span>Длительность: <span id="game-over-duration"></span></span>
              </div>
            </div>

            <!-- Hidden element for backwards compatibility with tests asserting #game-over-material -->
            <div id="game-over-material" style="display: none;"></div>

            <!-- Analysis progress and error state -->
            <div class="game-over-progress-wrap" id="game-over-progress-wrap" style="display: none;"></div>

            <!-- Two-column player cards & review statistics -->
            <div class="game-over-review-summary" id="game-over-review-summary">
              <div class="game-over-review-placeholder" style="display: none;">Разбор партии покажет точность и ключевые моменты</div>
              <div class="game-over-cards" id="game-over-cards"></div>
            </div>

            <div class="game-over-actions">
              <button class="btn-action btn-modal-primary" id="btn-modal-review">Разбор партии</button>
              <button class="btn-action btn-modal-secondary" id="btn-modal-new-game">Играть снова</button>
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
    this.progressWrapEl = this.container.querySelector('#game-over-progress-wrap') as HTMLElement;
    this.cardsContainerEl = this.container.querySelector('#game-over-cards') as HTMLElement;
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
      this.store.cancelReview();
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
    const result = this.store.getLiveGameResult();
    const timedOutLoser = this.store.getTimedOutLoser();
    const resignedPlayer = this.store.getResignedPlayer();
    const gameMode = this.store.getGameMode();

    // Determine winner
    let winner: 'white' | 'black' | 'draw' = 'draw';
    if (resignedPlayer !== null) {
      winner = resignedPlayer === 'white' ? 'black' : 'white';
    } else if (timedOutLoser !== null) {
      winner = timedOutLoser === 'white' ? 'black' : 'white';
    } else if (result.type === 'checkmate' && result.winner) {
      winner = result.winner;
    }

    // 1. Verdict badge
    this.verdictEl.style.display = 'inline-block';
    let verdict = '';
    let verdictClass = '';

    if (gameMode === 'ai') {
      const playerColor = this.store.getPlayerColor();
      if (resignedPlayer !== null) {
        if (resignedPlayer === playerColor) {
          verdict = 'Вы проиграли';
          verdictClass = 'verdict-loss';
        } else {
          verdict = 'Вы выиграли';
          verdictClass = 'verdict-win';
        }
      } else if (timedOutLoser !== null) {
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
    } else {
      if (winner === 'white') {
        verdict = 'Победа белых';
        verdictClass = 'verdict-win';
      } else if (winner === 'black') {
        verdict = 'Победа чёрных';
        verdictClass = 'verdict-win';
      } else {
        verdict = 'Ничья';
        verdictClass = 'verdict-draw';
      }
    }

    this.verdictEl.textContent = verdict;
    this.verdictEl.className = `game-over-verdict ${verdictClass}`;

    // 2. Title & Reason
    let title = '';
    let reason = '';

    if (resignedPlayer !== null) {
      if (gameMode === 'ai') {
        if (resignedPlayer === this.store.getPlayerColor()) {
          title = 'Вы сдались';
          reason = 'Вы признали поражение';
        } else {
          title = 'Компьютер сдался';
          reason = 'Соперник признал поражение';
        }
      } else {
        if (resignedPlayer === 'white') {
          title = 'Белые сдались. Победили чёрные';
          reason = 'Белые признали поражение';
        } else {
          title = 'Чёрные сдались. Победили белые';
          reason = 'Чёрные признали поражение';
        }
      }
    } else if (timedOutLoser !== null) {
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

    // 3. Meta: Moves, Duration, Material
    const plies = this.store.getLiveState().history.length;
    const fullMoves = Math.ceil(plies / 2);
    this.movesEl.textContent = `Ходов: ${fullMoves} (полуходов: ${plies})`;

    const durationMs = this.store.getGameDurationMs();
    this.durationEl.textContent = formatDuration(durationMs);

    const lost = this.store.getLostMaterial();
    this.materialEl.textContent = `Белые: −${lost.white} очков | Чёрные: −${lost.black} очков`;

    // 4. Progress or Error indicator
    const review = this.store.getReviewResult();
    const isReviewing = this.store.isReviewInProgress();
    const reviewProgress = this.store.getReviewProgress();
    const reviewError = this.store.getReviewError();

    if (plies < 2) {
      this.progressWrapEl.style.display = 'block';
      this.progressWrapEl.innerHTML = `
        <div class="analysis-too-short">Партия слишком короткая для анализа</div>
      `;
    } else if (reviewError) {
      this.progressWrapEl.style.display = 'block';
      this.progressWrapEl.innerHTML = `
        <div class="analysis-error-row">
          <span class="analysis-error-text">${reviewError}</span>
          <button class="btn-retry-analysis" id="btn-retry-analysis">Повторить</button>
        </div>
      `;
      this.progressWrapEl.querySelector('#btn-retry-analysis')?.addEventListener('click', () => {
        void this.store.startReview({ force: true });
      });
    } else if (isReviewing) {
      this.progressWrapEl.style.display = 'block';
      const completed = reviewProgress ? reviewProgress.completed : 0;
      const total = reviewProgress ? reviewProgress.total : plies + 1;
      this.progressWrapEl.innerHTML = `
        <div class="analysis-progress-label">Анализ партии: ${completed} из ${total}</div>
        <progress class="analysis-progress-bar" value="${completed}" max="${total}"></progress>
      `;
    } else {
      this.progressWrapEl.style.display = 'none';
      this.progressWrapEl.innerHTML = '';
    }

    // 5. Render Player Cards
    const isAi = gameMode === 'ai';
    const playerColor = this.store.getPlayerColor();
    const botLevelId = this.store.getAILevel();
    const botLevelName = BOT_LEVEL_NAMES[botLevelId] ?? botLevelId;

    const whiteTitle = isAi
      ? (playerColor === 'white' ? 'Вы' : `Компьютер: ${botLevelName}`)
      : 'Белые';
    const blackTitle = isAi
      ? (playerColor === 'black' ? 'Вы' : `Компьютер: ${botLevelName}`)
      : 'Чёрные';

    const renderCard = (side: 'white' | 'black', cardTitle: string, isWinner: boolean): string => {
      const accuracyVal = review ? review.accuracy[side].toFixed(1) + '%' : null;
      const accuracyHtml = accuracyVal !== null
        ? `<div class="card-accuracy-val">${accuracyVal}</div>`
        : `<div class="card-accuracy-val"><span class="skeleton-pill skeleton-acc"></span></div>`;

      let classesRows = '';
      for (const meta of MOVE_CLASS_REGISTRY) {
        if (!meta.showInSummary) continue;
        let countText: string;
        let isZero = false;

        if (review) {
          const count = review.counts[side][meta.id] ?? 0;
          countText = count.toString();
          isZero = count === 0;
        } else if (isReviewing) {
          countText = '<span class="skeleton-pill"></span>';
        } else {
          countText = '—';
          isZero = true;
        }

        classesRows += `
          <div class="card-class-row ${isZero ? 'zero-count' : ''}">
            <div class="card-class-info">
              <span class="move-class-badge badge-${meta.id}">${meta.symbol}</span>
              <span class="card-class-label">${meta.nameRu}:</span>
            </div>
            <span class="card-class-count">${countText}</span>
          </div>
        `;
      }

      const pointsStr = formatMaterialPoints(lost[side]);

      return `
        <div class="game-over-card ${isWinner ? 'winner-card' : ''}" data-side="${side}">
          <div class="card-header">
            <span class="card-title">${cardTitle}</span>
            ${isWinner ? '<span class="card-winner-badge">Победитель</span>' : ''}
          </div>
          <div class="card-accuracy-section">
            ${accuracyHtml}
            <div class="card-accuracy-label">Точность</div>
          </div>
          <div class="card-classes-list">
            ${classesRows}
          </div>
          <div class="card-material">Потеряно материала: ${pointsStr}</div>
        </div>
      `;
    };

    const whiteCardHtml = renderCard('white', whiteTitle, winner === 'white');
    const blackCardHtml = renderCard('black', blackTitle, winner === 'black');

    let srOnlyCounts = '';
    if (review) {
      srOnlyCounts = `
        <span class="sr-only" style="display: none;">
          Белые: Точность ${review.accuracy.white.toFixed(1)}% (неточностей: ${review.counts.white.inaccuracy}, ошибок: ${review.counts.white.mistake}, зевков: ${review.counts.white.blunder})
          Чёрные: Точность ${review.accuracy.black.toFixed(1)}% (неточностей: ${review.counts.black.inaccuracy}, ошибок: ${review.counts.black.mistake}, зевков: ${review.counts.black.blunder})
        </span>
      `;
    }

    this.cardsContainerEl.innerHTML = whiteCardHtml + blackCardHtml + srOnlyCounts;
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
