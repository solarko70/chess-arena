import { ChessStore } from '@/state/store';
import {
  exportReviewedPGN,
  MOVE_CLASS_REGISTRY,
  getMoveClassMeta,
  type GameReviewResult,
} from '@/analysis';

export class ReviewPanelUI {
  private container: HTMLElement;
  private store: ChessStore;

  // DOM elements
  private cancelBtn!: HTMLButtonElement;
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
            <button class="btn-action" id="btn-copy-reviewed-pgn">Копировать PGN с оценками</button>
          </div>
        </div>
      </div>
    `;

    this.cancelBtn = this.container.querySelector('#btn-cancel-review') as HTMLButtonElement;
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
    this.cancelBtn.addEventListener('click', () => {
      this.cancelReview();
    });

    this.copyPgnBtn.addEventListener('click', () => {
      void this.copyReviewedPGN();
    });
  }

  public async startReview(): Promise<void> {
    this.store.setReviewMode(true);
    if (this.store.getReviewResult()) {
      return;
    }
    if (!this.store.canReview() || this.store.isReviewInProgress()) {
      return;
    }
    const isDeep = this.store.getReviewDepth() === 20;
    await this.store.startReview({ isDeep });
  }

  public cancelReview(): void {
    this.store.cancelReview();
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
    const isReviewing = this.store.isReviewInProgress();
    const isReviewMode = this.store.isReviewMode();
    const reviewResult = this.store.getReviewResult();
    const progress = this.store.getReviewProgress();
    const fallbackNote = this.store.getReviewFallbackNote() || reviewResult?.fallbackNote;

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

    for (const meta of MOVE_CLASS_REGISTRY) {
      const label = meta.nameRu;
      const wCount = review.counts.white[meta.id] ?? 0;
      const bCount = review.counts.black[meta.id] ?? 0;
      html += `
        <tr>
          <td><span class="move-class-badge badge-${meta.id}">${label}</span></td>
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
      .filter(({ m }) => getMoveClassMeta(m.class).order >= 4);

    if (keyMoves.length === 0) {
      this.keyMomentsListEl.innerHTML = `<div class="key-moments-empty">Ключевых ошибок в партии не обнаружено.</div>`;
      return;
    }

    this.keyMomentsListEl.innerHTML = '';
    for (const { m, idx } of keyMoves) {
      const meta = getMoveClassMeta(m.class);
      const item = document.createElement('div');
      item.className = 'key-moment-item';
      item.dataset.moveIndex = idx.toString();

      const moveNum = Math.floor(idx / 2) + 1;
      const moveStr = idx % 2 === 0 ? `${moveNum}. ${m.san}` : `${moveNum}... ${m.san}`;

      item.innerHTML = `
        <span class="moment-san"><strong>${moveStr}</strong></span>
        <span class="move-class-badge badge-${m.class}">${meta.nameRu}</span>
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
