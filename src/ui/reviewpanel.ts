import { ChessStore } from '@/state/store';
import {
  runGameReview,
  exportReviewedPGN,
  MOVE_CLASS_LABELS,
  type MoveClass,
  type GameReviewResult,
} from '@/analysis';

export class ReviewPanelUI {
  private container: HTMLElement;
  private store: ChessStore;
  private abortController: AbortController | null = null;

  // DOM elements
  private startBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private deepCheckbox!: HTMLInputElement;
  private progressSection!: HTMLElement;
  private progressBar!: HTMLProgressElement;
  private progressText!: HTMLElement;
  private resultsSection!: HTMLElement;
  private fallbackBanner!: HTMLElement;
  private engineInfoEl!: HTMLElement;
  private accWhiteEl!: HTMLElement;
  private accBlackEl!: HTMLElement;
  private classesTableEl!: HTMLElement;
  private graphSvgEl!: SVGElement;
  private keyMomentsListEl!: HTMLElement;
  private copyPgnBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="review-panel">
        <div class="review-toolbar">
          <div class="review-toolbar-left">
            <button class="btn-action btn-review" id="btn-start-review">🔍 Разбор партии</button>
            <label class="review-deep-label" for="review-deep-toggle">
              <input type="checkbox" id="review-deep-toggle" />
              <span>Глубокий анализ</span>
            </label>
          </div>
          <button class="btn-action btn-close-review" id="btn-close-review" style="display: none;">✕ Закрыть разбор</button>
        </div>

        <div class="review-progress-section" id="review-progress-section" style="display: none;">
          <div class="review-progress-header">
            <span class="review-progress-text" id="review-progress-text">Проанализировано 0 из 0 позиций (0%)</span>
            <button class="btn-cancel" id="btn-cancel-review">Отмена</button>
          </div>
          <progress class="review-progress-bar" id="review-progress-bar" value="0" max="100"></progress>
        </div>

        <div class="review-results-section" id="review-results-section" style="display: none;">
          <div class="review-fallback-banner" id="review-fallback-note" style="display: none;"></div>

          <div class="review-engine-info" id="review-engine-info"></div>

          <div class="review-accuracies">
            <div class="accuracy-card white">
              <span class="accuracy-label">Точность белых</span>
              <strong class="accuracy-value" id="review-acc-white">0%</strong>
            </div>
            <div class="accuracy-card black">
              <span class="accuracy-label">Точность чёрных</span>
              <strong class="accuracy-value" id="review-acc-black">0%</strong>
            </div>
          </div>

          <div class="review-classes-table-wrap">
            <div class="review-subtitle">Классификация ходов</div>
            <div class="review-classes-table" id="review-classes-table"></div>
          </div>

          <div class="review-graph-wrap">
            <div class="review-subtitle">График шанса на выигрыш (белые)</div>
            <svg class="review-eval-graph" id="review-eval-graph" viewBox="0 0 500 120"></svg>
          </div>

          <div class="review-key-moments-wrap">
            <div class="review-subtitle">Ключевые моменты</div>
            <div class="review-key-moments-list" id="review-key-moments-list"></div>
          </div>

          <div class="review-actions">
            <button class="btn-action" id="btn-copy-reviewed-pgn">📋 Копировать PGN с оценками</button>
          </div>
        </div>
      </div>
    `;

    this.startBtn = this.container.querySelector('#btn-start-review') as HTMLButtonElement;
    this.closeBtn = this.container.querySelector('#btn-close-review') as HTMLButtonElement;
    this.cancelBtn = this.container.querySelector('#btn-cancel-review') as HTMLButtonElement;
    this.deepCheckbox = this.container.querySelector('#review-deep-toggle') as HTMLInputElement;
    this.progressSection = this.container.querySelector('#review-progress-section') as HTMLElement;
    this.progressBar = this.container.querySelector('#review-progress-bar') as HTMLProgressElement;
    this.progressText = this.container.querySelector('#review-progress-text') as HTMLElement;
    this.resultsSection = this.container.querySelector('#review-results-section') as HTMLElement;
    this.fallbackBanner = this.container.querySelector('#review-fallback-note') as HTMLElement;
    this.engineInfoEl = this.container.querySelector('#review-engine-info') as HTMLElement;
    this.accWhiteEl = this.container.querySelector('#review-acc-white') as HTMLElement;
    this.accBlackEl = this.container.querySelector('#review-acc-black') as HTMLElement;
    this.classesTableEl = this.container.querySelector('#review-classes-table') as HTMLElement;
    this.graphSvgEl = this.container.querySelector('#review-eval-graph') as SVGElement;
    this.keyMomentsListEl = this.container.querySelector('#review-key-moments-list') as HTMLElement;
    this.copyPgnBtn = this.container.querySelector('#btn-copy-reviewed-pgn') as HTMLButtonElement;

    this.initEvents();
    this.store.subscribe(() => this.render());
  }

  private initEvents(): void {
    this.startBtn.addEventListener('click', () => {
      void this.startReview();
    });

    this.cancelBtn.addEventListener('click', () => {
      this.cancelReview();
    });

    this.closeBtn.addEventListener('click', () => {
      this.store.setReviewMode(false);
    });

    this.deepCheckbox.addEventListener('change', () => {
      this.store.setReviewDepth(this.deepCheckbox.checked ? 20 : 16);
    });

    this.copyPgnBtn.addEventListener('click', () => {
      void this.copyReviewedPGN();
    });
  }

  public async startReview(): Promise<void> {
    if (!this.store.canReview() || this.store.isReviewInProgress()) return;

    this.abortController = new AbortController();
    this.store.setReviewInProgress(true);
    this.store.setReviewMode(true);

    const isDeep = this.deepCheckbox.checked || this.store.getReviewDepth() === 20;
    const historyLen = this.store.getLiveState().history.length;
    this.store.setReviewProgress({ completed: 0, total: historyLen + 1, ply: 0 });

    try {
      const result = await runGameReview(this.store.getLiveState(), {
        mode: isDeep ? 'deep' : 'standard',
        signal: this.abortController.signal,
        onProgress: (progress) => {
          this.store.setReviewProgress(progress);
        },
        workerFactory: this.store.getReviewWorkerFactory(),
        engine: this.store.getReviewEngine(),
      });
      this.store.setReviewResult(result, result.fallbackNote);
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError' || this.abortController.signal.aborted;
      if (!isAbort) {
        console.error('Game review failed:', err);
      }
    } finally {
      this.abortController = null;
      this.store.setReviewProgress(null);
      this.store.setReviewInProgress(false);
    }
  }

  public cancelReview(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.store.setReviewProgress(null);
    this.store.setReviewInProgress(false);
  }

  private async copyReviewedPGN(): Promise<void> {
    const review = this.store.getReviewResult();
    if (!review) return;

    const pgn = exportReviewedPGN(this.store.getLiveState(), review);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pgn);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = pgn;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      const prevText = this.copyPgnBtn.textContent;
      this.copyPgnBtn.textContent = 'Скопировано!';
      setTimeout(() => {
        this.copyPgnBtn.textContent = prevText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy PGN:', err);
    }
  }

  private render(): void {
    const canReview = this.store.canReview();
    const isReviewing = this.store.isReviewInProgress();
    const isReviewMode = this.store.isReviewMode();
    const reviewResult = this.store.getReviewResult();
    const progress = this.store.getReviewProgress();
    const fallbackNote = this.store.getReviewFallbackNote() || reviewResult?.fallbackNote;

    this.startBtn.disabled = !canReview || isReviewing;
    this.deepCheckbox.disabled = isReviewing;
    this.deepCheckbox.checked = this.store.getReviewDepth() === 20;

    // Close button visibility
    this.closeBtn.style.display = isReviewMode ? 'inline-block' : 'none';

    // Progress section
    if (isReviewing && progress) {
      this.progressSection.style.display = 'block';
      const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      this.progressBar.max = progress.total;
      this.progressBar.value = progress.completed;
      this.progressText.textContent = `Проанализировано ${progress.completed} из ${progress.total} позиций (${pct}%)`;
    } else {
      this.progressSection.style.display = 'none';
    }

    // Results section
    if (isReviewMode && reviewResult) {
      this.resultsSection.style.display = 'block';

      // Fallback note
      if (fallbackNote) {
        this.fallbackBanner.style.display = 'block';
        this.fallbackBanner.textContent = `«${fallbackNote}»`;
      } else {
        this.fallbackBanner.style.display = 'none';
        this.fallbackBanner.textContent = '';
      }

      // Engine info
      const depth = reviewResult.depth ?? this.store.getReviewDepth();
      this.engineInfoEl.innerHTML = `
        <span class="engine-badge">Движок: <strong>${reviewResult.engineName}</strong></span>
        <span class="engine-depth">Глубина: <strong>${depth}</strong></span>
        <span class="engine-reanalyzed">Пересчитано: <strong>${reviewResult.reanalyzed}</strong></span>
      `;

      // Accuracies
      this.accWhiteEl.textContent = `${reviewResult.accuracy.white.toFixed(1)}%`;
      this.accBlackEl.textContent = `${reviewResult.accuracy.black.toFixed(1)}%`;

      // Classes table
      this.renderClassesTable(reviewResult);

      // SVG graph
      this.renderEvalGraph(reviewResult);

      // Key moments
      this.renderKeyMoments(reviewResult);
    } else {
      this.resultsSection.style.display = 'none';
    }
  }

  private renderClassesTable(review: GameReviewResult): void {
    const classOrder: MoveClass[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

    let html = `
      <table class="classes-table">
        <thead>
          <tr>
            <th>Класс</th>
            <th style="text-align: center;">Белые</th>
            <th style="text-align: center;">Чёрные</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const cls of classOrder) {
      const label = MOVE_CLASS_LABELS[cls];
      const wCount = review.counts.white[cls] ?? 0;
      const bCount = review.counts.black[cls] ?? 0;
      html += `
        <tr>
          <td><span class="move-class-badge badge-${cls}">${label}</span></td>
          <td style="text-align: center;"><strong>${wCount}</strong></td>
          <td style="text-align: center;"><strong>${bCount}</strong></td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
    this.classesTableEl.innerHTML = html;
  }

  private renderEvalGraph(review: GameReviewResult): void {
    const points = review.evalHistory;
    if (!points || points.length === 0) {
      this.graphSvgEl.innerHTML = '';
      return;
    }

    const n = points.length - 1;
    const width = 500;
    const padX = 20;
    const innerW = width - padX * 2;

    const getX = (ply: number) => padX + (n > 0 ? (ply / n) * innerW : 0);
    const getY = (chance: number) => {
      const clamped = Math.max(0, Math.min(100, chance));
      return 110 - (clamped / 100) * 100; // 100% -> y=10, 50% -> y=60, 0% -> y=110
    };

    const polyPoints = points.map((p, i) => `${getX(i).toFixed(1)},${getY(p.whiteWinChance).toFixed(1)}`).join(' ');

    const viewIndex = this.store.getViewIndex();
    let currentPly = 0;
    if (viewIndex === null) {
      currentPly = n;
    } else if (viewIndex >= 0) {
      currentPly = Math.min(viewIndex + 1, n);
    }
    const cursorX = getX(currentPly);

    let circlesHtml = '';
    for (let i = 0; i < points.length; i++) {
      const cx = getX(i);
      const cy = getY(points[i].whiteWinChance);
      circlesHtml += `<circle class="graph-point" data-ply="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="#38bdf8" />`;
    }

    this.graphSvgEl.innerHTML = `
      <!-- Midline (50% equality) -->
      <line x1="${padX}" y1="60" x2="${width - padX}" y2="60" stroke="#64748b" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padX - 4}" y="63" fill="#64748b" font-size="9" text-anchor="end">50%</text>

      <!-- Advantage polyline -->
      <polyline points="${polyPoints}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Clickable circles -->
      ${circlesHtml}

      <!-- Current move cursor -->
      <line class="graph-cursor" x1="${cursorX.toFixed(1)}" y1="10" x2="${cursorX.toFixed(1)}" y2="110" stroke="#f6e05e" stroke-width="2" />
    `;

    // Click handler on SVG to navigate to move
    this.graphSvgEl.onclick = (e: MouseEvent) => {
      const rect = this.graphSvgEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, (clickX - (padX / width) * rect.width) / ((innerW / width) * rect.width)));
      const clickedPly = Math.round(ratio * n);
      if (clickedPly === 0) {
        this.store.setViewIndex(-1);
      } else {
        this.store.setViewIndex(clickedPly - 1);
      }
    };
  }

  private renderKeyMoments(review: GameReviewResult): void {
    const keyMoves = review.moves
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.class === 'blunder' || m.class === 'mistake' || m.class === 'inaccuracy');

    if (keyMoves.length === 0) {
      this.keyMomentsListEl.innerHTML = `<div class="key-moments-empty">Ключевых ошибок в партии не обнаружено.</div>`;
      return;
    }

    this.keyMomentsListEl.innerHTML = '';
    for (const { m, idx } of keyMoves) {
      const item = document.createElement('div');
      item.className = 'key-moment-item';
      item.dataset.moveIndex = idx.toString();

      const moveNum = Math.floor(idx / 2) + 1;
      const moveStr = idx % 2 === 0 ? `${moveNum}. ${m.san}` : `${moveNum}... ${m.san}`;

      item.innerHTML = `
        <span class="moment-san"><strong>${moveStr}</strong></span>
        <span class="move-class-badge badge-${m.class}">${MOVE_CLASS_LABELS[m.class]}</span>
        <span class="moment-loss">-${m.loss.toFixed(1)}%</span>
        <span class="moment-best">Лучший: ${m.bestSan || '—'}</span>
      `;

      item.addEventListener('click', () => {
        this.store.setViewIndex(idx);
      });

      this.keyMomentsListEl.appendChild(item);
    }
  }
}
