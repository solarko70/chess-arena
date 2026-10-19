import { ChessStore } from '@/state/store';
import { MOVE_CLASS_REGISTRY, formatMaterialPoints, type ReviewRunResult } from '@/analysis';

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

// SVG icons for verdict badge without any text inside SVG
const CROWN_SVG =
  '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 12h11v1.5h-11V12zm1.2-1.5L2 4.5l3.8 2.5L8 3l2.2 4 3.8-2.5-1.7 6H3.7z"/></svg>';
const FLAG_SVG =
  '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 2v12h1.5V9.5h7.5l-1.5-3.5 1.5-3.5H4.5V2H3zm1.5 2h6.2l-1 2.5 1 2H4.5V4z"/></svg>';
const EQUALS_SVG =
  '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 5.5h10v1.8H3V5.5zm0 4.2h10v1.8H3V9.7z"/></svg>';

const RING_CIRCUMFERENCE = 175.93; // 2 * PI * 28

interface CardDomElements {
  cardEl: HTMLElement;
  headerEl: HTMLElement;
  titleEl: HTMLElement;
  winnerBadgeEl: HTMLElement;
  ringProgressEl: SVGCircleElement;
  accuracyValEl: HTMLElement;
  classRows: Map<
    string,
    {
      rowEl: HTMLElement;
      countEl: HTMLElement;
    }
  >;
  materialEl: HTMLElement;
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
  private progressWrapEl!: HTMLElement;
  private cardsContainerEl!: HTMLElement;
  private reviewBtn!: HTMLButtonElement;
  private newGameBtn!: HTMLButtonElement;

  // Card cache to prevent re-creating DOM nodes during progress updates
  private cardsBuilt = false;
  private whiteCardDom: CardDomElements | null = null;
  private blackCardDom: CardDomElements | null = null;
  private srOnlyEl: HTMLElement | null = null;

  // Progress throttling state (max ~10 fps)
  private lastProgressUpdate = 0;
  private progressThrottleTimer: ReturnType<typeof setTimeout> | null = null;

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
          <!-- Static Solar Decorative Layer (aria-hidden, pointer-events none) -->
          <div class="game-over-solar-decor" aria-hidden="true" style="pointer-events: none;">
            <svg width="100%" height="100%" viewBox="0 0 680 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <ellipse cx="340" cy="0" rx="140" ry="45" class="solar-modal-orbit" />
              <ellipse cx="340" cy="0" rx="220" ry="75" class="solar-modal-orbit" />
              <ellipse cx="340" cy="0" rx="300" ry="105" class="solar-modal-orbit" />
              <ellipse cx="340" cy="0" rx="380" ry="135" class="solar-modal-orbit" />
              <circle cx="120" cy="40" r="1.5" class="solar-modal-star" />
              <circle cx="180" cy="95" r="1" class="solar-modal-star" />
              <circle cx="260" cy="35" r="1.5" class="solar-modal-star" />
              <circle cx="420" cy="45" r="1" class="solar-modal-star" />
              <circle cx="490" cy="110" r="1.5" class="solar-modal-star" />
              <circle cx="560" cy="30" r="1" class="solar-modal-star" />
              <circle cx="610" cy="85" r="1.5" class="solar-modal-star" />
            </svg>
          </div>

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
        const isReviewing = this.store.isReviewInProgress();
        const hasResult = this.store.getReviewResult() !== null;
        const hasError = this.store.getReviewError() !== null;

        // Throttle progress updates during active background review to <= ~10 fps (100 ms)
        // Instant update when review completes, fails, or when not reviewing
        if (isReviewing && !hasResult && !hasError) {
          const now = Date.now();
          const elapsed = now - this.lastProgressUpdate;
          if (elapsed >= 100 || elapsed < 0) {
            if (this.progressThrottleTimer) {
              clearTimeout(this.progressThrottleTimer);
              this.progressThrottleTimer = null;
            }
            this.lastProgressUpdate = now;
            this.renderContent();
          } else if (!this.progressThrottleTimer) {
            const waitMs = Math.max(0, Math.min(100, 100 - elapsed));
            this.progressThrottleTimer = setTimeout(() => {
              this.progressThrottleTimer = null;
              this.lastProgressUpdate = Date.now();
              if (this.isOpenState) {
                this.renderContent();
              }
            }, waitMs);
          }
        } else {
          if (this.progressThrottleTimer) {
            clearTimeout(this.progressThrottleTimer);
            this.progressThrottleTimer = null;
          }
          this.lastProgressUpdate = 0;
          this.renderContent();
        }
      }
    } else {
      if (this.isOpenState) {
        this.hide(false);
      }
    }
  }

  public show(): void {
    this.previousActiveElement = document.activeElement as HTMLElement | null;

    // Reset card cache so re-opening the modal builds DOM once anew
    this.cardsBuilt = false;
    this.renderContent();

    // Trigger entrance animation once per open, cleaned up on animationend
    this.dialog.classList.remove('modal-anim-enter');
    // Force layout reflow so animation re-runs on re-open
    void this.dialog.offsetWidth;
    this.dialog.classList.add('modal-anim-enter');
    const onDialogAnimEnd = () => {
      this.dialog.classList.remove('modal-anim-enter');
      this.dialog.removeEventListener('animationend', onDialogAnimEnd);
    };
    this.dialog.addEventListener('animationend', onDialogAnimEnd);

    const cards = [this.whiteCardDom?.cardEl, this.blackCardDom?.cardEl];
    for (const card of cards) {
      if (card) {
        card.classList.remove('card-anim-enter');
        void card.offsetWidth;
        card.classList.add('card-anim-enter');
        const onCardAnimEnd = () => {
          card.classList.remove('card-anim-enter');
          card.removeEventListener('animationend', onCardAnimEnd);
        };
        card.addEventListener('animationend', onCardAnimEnd);
      }
    }

    this.overlay.style.display = 'flex';
    this.isOpenState = true;
    setTimeout(() => {
      if (this.isOpenState) {
        this.reviewBtn.focus();
      }
    }, 0);
  }

  public hide(dismiss = true): void {
    if (this.progressThrottleTimer) {
      clearTimeout(this.progressThrottleTimer);
      this.progressThrottleTimer = null;
    }

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

  private ensureCardsBuilt(): void {
    if (this.cardsBuilt && this.whiteCardDom && this.blackCardDom) {
      return;
    }

    this.cardsContainerEl.innerHTML = '';

    const buildCard = (side: 'white' | 'black'): CardDomElements => {
      const cardEl = document.createElement('div');
      cardEl.className = 'game-over-card';
      cardEl.setAttribute('data-side', side);

      const headerEl = document.createElement('div');
      headerEl.className = 'card-header';

      const titleEl = document.createElement('span');
      titleEl.className = 'card-title';
      headerEl.appendChild(titleEl);

      const winnerBadgeEl = document.createElement('span');
      winnerBadgeEl.className = 'card-winner-badge';
      winnerBadgeEl.textContent = 'Победитель';
      // Appended to headerEl only when side is winner

      cardEl.appendChild(headerEl);

      const accSectionEl = document.createElement('div');
      accSectionEl.className = 'card-accuracy-section';

      const ringWrapEl = document.createElement('div');
      ringWrapEl.className = 'card-accuracy-ring-wrap';

      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('class', 'accuracy-ring-svg');
      svgEl.setAttribute('viewBox', '0 0 72 72');
      svgEl.setAttribute('aria-hidden', 'true');

      const circleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circleBg.setAttribute('class', 'ring-bg');
      circleBg.setAttribute('cx', '36');
      circleBg.setAttribute('cy', '36');
      circleBg.setAttribute('r', '28');
      svgEl.appendChild(circleBg);

      const ringProgressEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ringProgressEl.setAttribute('class', 'ring-progress');
      ringProgressEl.setAttribute('cx', '36');
      ringProgressEl.setAttribute('cy', '36');
      ringProgressEl.setAttribute('r', '28');
      ringProgressEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      ringProgressEl.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
      svgEl.appendChild(ringProgressEl);

      ringWrapEl.appendChild(svgEl);

      const accuracyValEl = document.createElement('div');
      accuracyValEl.className = 'card-accuracy-val';
      accuracyValEl.innerHTML = '<span class="skeleton-pill skeleton-acc"></span>';
      ringWrapEl.appendChild(accuracyValEl);

      accSectionEl.appendChild(ringWrapEl);

      const accLabelEl = document.createElement('div');
      accLabelEl.className = 'card-accuracy-label';
      accLabelEl.textContent = 'Точность';
      accSectionEl.appendChild(accLabelEl);

      cardEl.appendChild(accSectionEl);

      const classesListEl = document.createElement('div');
      classesListEl.className = 'card-classes-list';

      const classRows = new Map<string, { rowEl: HTMLElement; countEl: HTMLElement }>();

      for (const meta of MOVE_CLASS_REGISTRY) {
        if (!meta.showInSummary) continue;

        const rowEl = document.createElement('div');
        rowEl.className = 'card-class-row zero-count';
        rowEl.setAttribute('data-class-id', meta.id);
        rowEl.setAttribute('title', meta.nameRu);

        const infoEl = document.createElement('div');
        infoEl.className = 'card-class-info';

        const badgeEl = document.createElement('span');
        badgeEl.className = `move-class-badge badge-${meta.id}`;
        badgeEl.textContent = meta.symbol;
        infoEl.appendChild(badgeEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'card-class-label';
        labelEl.textContent = `${meta.nameRu}:`;
        infoEl.appendChild(labelEl);

        rowEl.appendChild(infoEl);

        const countEl = document.createElement('span');
        countEl.className = 'card-class-count';
        countEl.textContent = '—';
        rowEl.appendChild(countEl);

        classesListEl.appendChild(rowEl);
        classRows.set(meta.id, { rowEl, countEl });
      }

      cardEl.appendChild(classesListEl);

      const materialEl = document.createElement('div');
      materialEl.className = 'card-material';
      materialEl.textContent = 'Потеряно материала: 0';
      cardEl.appendChild(materialEl);

      this.cardsContainerEl.appendChild(cardEl);

      return {
        cardEl,
        headerEl,
        titleEl,
        winnerBadgeEl,
        ringProgressEl,
        accuracyValEl,
        classRows,
        materialEl,
      };
    };

    this.whiteCardDom = buildCard('white');
    this.blackCardDom = buildCard('black');

    this.srOnlyEl = document.createElement('span');
    this.srOnlyEl.className = 'sr-only';
    this.srOnlyEl.style.display = 'none';
    this.cardsContainerEl.appendChild(this.srOnlyEl);

    this.cardsBuilt = true;
  }

  private updateCard(
    dom: CardDomElements,
    side: 'white' | 'black',
    cardTitle: string,
    isWinner: boolean,
    isLoser: boolean,
    review: ReviewRunResult | null,
    isReviewing: boolean,
    lostPoints: number,
  ): void {
    // 1. Header title & winner badge
    dom.titleEl.textContent = cardTitle;
    if (isWinner) {
      dom.cardEl.classList.add('winner-card');
      dom.cardEl.classList.remove('loser-card');
      if (!dom.headerEl.contains(dom.winnerBadgeEl)) {
        dom.headerEl.appendChild(dom.winnerBadgeEl);
      }
    } else {
      dom.cardEl.classList.remove('winner-card');
      if (isLoser) {
        dom.cardEl.classList.add('loser-card');
      } else {
        dom.cardEl.classList.remove('loser-card');
      }
      if (dom.winnerBadgeEl.parentElement) {
        dom.winnerBadgeEl.remove();
      }
    }

    // 2. Accuracy value & ring progress
    if (review) {
      const acc = review.accuracy[side];
      const accText = acc.toFixed(1) + '%';
      if (dom.accuracyValEl.textContent !== accText) {
        dom.accuracyValEl.textContent = accText;
        dom.accuracyValEl.classList.add('fade-in');
      }

      const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, acc)) / 100);
      dom.ringProgressEl.style.strokeDashoffset = offset.toFixed(2);
      dom.ringProgressEl.classList.remove('ring-high', 'ring-mid', 'ring-low');
      if (acc >= 85) {
        dom.ringProgressEl.classList.add('ring-high');
      } else if (acc >= 70) {
        dom.ringProgressEl.classList.add('ring-mid');
      } else {
        dom.ringProgressEl.classList.add('ring-low');
      }
    } else {
      if (!dom.accuracyValEl.querySelector('.skeleton-pill')) {
        dom.accuracyValEl.innerHTML = '<span class="skeleton-pill skeleton-acc"></span>';
        dom.accuracyValEl.classList.remove('fade-in');
      }
      dom.ringProgressEl.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
      dom.ringProgressEl.classList.remove('ring-high', 'ring-mid', 'ring-low');
    }

    // 3. Move class count rows
    for (const meta of MOVE_CLASS_REGISTRY) {
      if (!meta.showInSummary) continue;
      const rowEntry = dom.classRows.get(meta.id);
      if (!rowEntry) continue;

      if (review) {
        const count = review.counts[side][meta.id] ?? 0;
        const countStr = count.toString();
        if (rowEntry.countEl.textContent !== countStr) {
          rowEntry.countEl.textContent = countStr;
        }
        if (count === 0) {
          rowEntry.rowEl.classList.add('zero-count');
          rowEntry.rowEl.style.removeProperty('--row-class-bg');
        } else {
          rowEntry.rowEl.classList.remove('zero-count');
          rowEntry.rowEl.style.setProperty('--row-class-bg', `var(--class-${meta.id}-bg)`);
        }
      } else if (isReviewing) {
        if (!rowEntry.countEl.querySelector('.skeleton-pill')) {
          rowEntry.countEl.innerHTML = '<span class="skeleton-pill"></span>';
        }
        rowEntry.rowEl.classList.remove('zero-count');
        rowEntry.rowEl.style.removeProperty('--row-class-bg');
      } else {
        if (rowEntry.countEl.textContent !== '—') {
          rowEntry.countEl.textContent = '—';
        }
        rowEntry.rowEl.classList.add('zero-count');
        rowEntry.rowEl.style.removeProperty('--row-class-bg');
      }
    }

    // 4. Lost material points
    const pointsStr = formatMaterialPoints(lostPoints);
    dom.materialEl.textContent = `Потеряно материала: ${pointsStr}`;
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

    let iconSvg = '';
    if (verdictClass === 'verdict-win') {
      iconSvg = CROWN_SVG;
    } else if (verdictClass === 'verdict-loss') {
      iconSvg = FLAG_SVG;
    } else if (verdictClass === 'verdict-draw') {
      iconSvg = EQUALS_SVG;
    }

    // Set SVG icon and span; textContent strictly equals verdict because SVG has no text elements
    this.verdictEl.innerHTML = `${iconSvg}<span class="verdict-text">${verdict}</span>`;
    this.verdictEl.className = `game-over-verdict ${verdictClass}`;
    this.verdictEl.style.display = 'inline-flex';

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

      let labelEl = this.progressWrapEl.querySelector('.analysis-progress-label') as HTMLElement | null;
      let barEl = this.progressWrapEl.querySelector('.analysis-progress-bar') as HTMLProgressElement | null;
      if (!labelEl || !barEl) {
        this.progressWrapEl.innerHTML = `
          <div class="analysis-progress-label"></div>
          <progress class="analysis-progress-bar"></progress>
        `;
        labelEl = this.progressWrapEl.querySelector('.analysis-progress-label') as HTMLElement;
        barEl = this.progressWrapEl.querySelector('.analysis-progress-bar') as HTMLProgressElement;
      }
      labelEl.textContent = `Анализ партии: ${completed} из ${total}`;
      barEl.value = completed;
      barEl.max = total;
    } else {
      this.progressWrapEl.style.display = 'none';
      this.progressWrapEl.innerHTML = '';
    }

    // 5. Ensure cards DOM structure exists (created once on open)
    this.ensureCardsBuilt();

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

    const isWhiteWinner = winner === 'white';
    const isBlackWinner = winner === 'black';
    const isWhiteLoser = winner === 'black';
    const isBlackLoser = winner === 'white';

    if (this.whiteCardDom) {
      this.updateCard(
        this.whiteCardDom,
        'white',
        whiteTitle,
        isWhiteWinner,
        isWhiteLoser,
        review,
        isReviewing,
        lost.white,
      );
    }

    if (this.blackCardDom) {
      this.updateCard(
        this.blackCardDom,
        'black',
        blackTitle,
        isBlackWinner,
        isBlackLoser,
        review,
        isReviewing,
        lost.black,
      );
    }

    if (this.srOnlyEl) {
      if (review) {
        this.srOnlyEl.textContent = `Белые: Точность ${review.accuracy.white.toFixed(1)}% (неточностей: ${review.counts.white.inaccuracy}, ошибок: ${review.counts.white.mistake}, зевков: ${review.counts.white.blunder}) Чёрные: Точность ${review.accuracy.black.toFixed(1)}% (неточностей: ${review.counts.black.inaccuracy}, ошибок: ${review.counts.black.mistake}, зевков: ${review.counts.black.blunder})`;
      } else {
        this.srOnlyEl.textContent = '';
      }
    }
  }

  public destroy(): void {
    if (this.progressThrottleTimer) {
      clearTimeout(this.progressThrottleTimer);
      this.progressThrottleTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    document.removeEventListener('keydown', this.handleKeyDown);
    this.cardsBuilt = false;
    this.whiteCardDom = null;
    this.blackCardDom = null;
    this.srOnlyEl = null;
    this.container.innerHTML = '';
  }
}
