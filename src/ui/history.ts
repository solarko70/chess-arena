import { ChessStore } from '@/state/store';
import { moveToSAN, classicalRuleSet } from '@/core';
import { scoreToCp, getMoveClassMeta, identifyOpening } from '@/analysis';
import { solarAudio } from '@/audio/solar-audio';

export class HistoryUI {
  private container: HTMLElement;
  private store: ChessStore;
  private listEl!: HTMLElement;
  private detailEl!: HTMLElement;
  private openingBadgeEl!: HTMLElement;
  private mistakeNavEl!: HTMLElement;
  private prevMistakeBtn!: HTMLButtonElement;
  private nextMistakeBtn!: HTMLButtonElement;
  private lastPlayedViewIndex: number | null = null;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="history-panel">
        <div class="history-header solar-section-title">История ходов</div>
        <div class="history-detail-panel move-feedback-card solar-card" id="history-detail-panel" style="display: none;"></div>
        <div class="history-mistake-nav" id="history-mistake-nav" style="display: none;">
          <button type="button" class="solar-btn-ghost btn-mistake-nav" id="btn-prev-mistake" title="Предыдущая ошибка" aria-label="Предыдущая ошибка">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Пред. ошибка</span>
          </button>
          <button type="button" class="solar-btn-ghost btn-mistake-nav" id="btn-next-mistake" title="Следующая ошибка" aria-label="Следующая ошибка">
            <span>След. ошибка</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div class="opening-badge history-opening-badge solar-card" id="history-opening-badge" style="display: none;"></div>
        <div class="history-list"></div>
        <div class="history-nav">
          <button id="hist-first" class="solar-btn-ghost" title="В начало (Home)">|&lt;</button>
          <button id="hist-prev" class="solar-btn-ghost" title="Назад (&larr;)">&larr;</button>
          <button id="hist-next" class="solar-btn-ghost" title="Вперед (&rarr;)">&rarr;</button>
          <button id="hist-last" class="solar-btn-ghost" title="В конец (End)">&gt;|</button>
        </div>
      </div>
    `;

    this.listEl = this.container.querySelector('.history-list') as HTMLElement;
    this.detailEl = this.container.querySelector('#history-detail-panel') as HTMLElement;
    this.openingBadgeEl = this.container.querySelector('#history-opening-badge') as HTMLElement;
    this.mistakeNavEl = this.container.querySelector('#history-mistake-nav') as HTMLElement;
    this.prevMistakeBtn = this.container.querySelector('#btn-prev-mistake') as HTMLButtonElement;
    this.nextMistakeBtn = this.container.querySelector('#btn-next-mistake') as HTMLButtonElement;
    this.initEvents();
    this.store.subscribe(() => this.render());
  }

  private playReviewMoveSound(idx: number | null): void {
    if (idx === null || idx < 0) {
      this.lastPlayedViewIndex = idx;
      return;
    }
    const review = this.store.getReviewResult();
    if (!review || !this.store.isReviewMode()) {
      this.lastPlayedViewIndex = idx;
      return;
    }
    const revMove = review.moves[idx];
    if (!revMove) {
      this.lastPlayedViewIndex = idx;
      return;
    }
    this.lastPlayedViewIndex = idx;
    if (revMove.class === 'stellar') {
      solarAudio.playStellar();
    } else if (revMove.san?.includes('#')) {
      solarAudio.playCheckmate();
    } else if (revMove.san?.includes('+')) {
      solarAudio.playCheck();
    } else if (revMove.san?.includes('x') || revMove.move?.captured) {
      solarAudio.playCapture();
    } else {
      solarAudio.playMove();
    }
  }

  private initEvents(): void {
    this.container.querySelector('#hist-first')?.addEventListener('click', () => {
      this.playReviewMoveSound(-1);
      this.store.setViewIndex(-1);
    });
    this.container.querySelector('#hist-prev')?.addEventListener('click', () => {
      const current = this.store.getViewIndex();
      const historyLen = this.store.getLiveState().history.length;
      if (historyLen === 0) return;
      const target = current === null ? historyLen - 2 : current - 1;
      this.playReviewMoveSound(target);
      this.store.setViewIndex(target);
    });
    this.container.querySelector('#hist-next')?.addEventListener('click', () => {
      const current = this.store.getViewIndex();
      if (current !== null) {
        this.playReviewMoveSound(current + 1);
        this.store.setViewIndex(current + 1);
      }
    });
    this.container.querySelector('#hist-last')?.addEventListener('click', () => {
      this.playReviewMoveSound(null);
      this.store.setViewIndex(null);
    });

    this.prevMistakeBtn?.addEventListener('click', () => {
      this.goToPrevMistake();
    });
    this.nextMistakeBtn?.addEventListener('click', () => {
      this.goToNextMistake();
    });

    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      const historyLen = this.store.getLiveState().history.length;
      if (historyLen === 0) return;

      const current = this.store.getViewIndex();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const target = current === null ? historyLen - 2 : current - 1;
        this.playReviewMoveSound(target);
        this.store.setViewIndex(target);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (current !== null) {
          this.playReviewMoveSound(current + 1);
          this.store.setViewIndex(current + 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.playReviewMoveSound(-1);
        this.store.setViewIndex(-1);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.playReviewMoveSound(null);
        this.store.setViewIndex(null);
      }
    });
  }

  private isMistake(moveClass: string): boolean {
    return ['inaccuracy', 'mistake', 'blunder', 'missed'].includes(moveClass);
  }

  private getFeedbackVerdictTitle(moveClass: string, defaultName: string): string {
    if (moveClass === 'stellar') return 'Звёздный !!';
    if (moveClass === 'superb') return 'Превосходный !';
    if (moveClass === 'missed') return 'Упущенный шанс ✖';
    return defaultName;
  }

  private getFeedbackDescription(moveClass: string): string {
    if (moveClass === 'stellar') return 'Блестящая жертва материала, ведущая к победе';
    if (moveClass === 'superb') return 'Единственный ход, сохраняющий решающий перевес';
    if (moveClass === 'missed') return 'Упущена возможность победить';
    return '';
  }

  private goToPrevMistake(): void {
    const review = this.store.getReviewResult();
    if (!review) return;
    const current = this.store.getViewIndex();
    const historyLen = this.store.getLiveState().history.length;
    const startIdx = current === null ? historyLen - 1 : current - 1;

    for (let i = startIdx; i >= 0; i--) {
      const m = review.moves[i];
      if (m && this.isMistake(m.class)) {
        this.playReviewMoveSound(i);
        this.store.setViewIndex(i);
        return;
      }
    }
  }

  private goToNextMistake(): void {
    const review = this.store.getReviewResult();
    if (!review) return;
    const current = this.store.getViewIndex();
    const startIdx = current === null ? 0 : current + 1;
    const historyLen = this.store.getLiveState().history.length;

    for (let i = startIdx; i < historyLen; i++) {
      const m = review.moves[i];
      if (m && this.isMistake(m.class)) {
        this.playReviewMoveSound(i);
        this.store.setViewIndex(i);
        return;
      }
    }
  }

  private render(): void {
    const liveState = this.store.getLiveState();
    const history = liveState.history;
    const viewIndex = this.store.getViewIndex();
    const review = this.store.getReviewResult();
    const isReview = Boolean(this.store.isReviewMode() && review);

    if (isReview && viewIndex !== null && viewIndex !== this.lastPlayedViewIndex) {
      this.playReviewMoveSound(viewIndex);
    } else if (!isReview) {
      this.lastPlayedViewIndex = null;
    }

    this.listEl.innerHTML = '';
    this.listEl.classList.toggle('review-moves-list', isReview);

    // Render opening badge in review mode
    if (isReview && review) {
      const opening = review.opening ?? identifyOpening(history);
      if (this.openingBadgeEl) {
        if (history.length >= 1) {
          this.openingBadgeEl.style.display = 'inline-flex';
          if (opening) {
            this.openingBadgeEl.className = 'opening-badge history-opening-badge solar-card';
            this.openingBadgeEl.innerHTML = `<span class="opening-eco">${opening.eco}</span> <span class="meta-separator">·</span> <span class="opening-name">${opening.name}</span>`;
          } else {
            this.openingBadgeEl.className = 'opening-badge history-opening-badge solar-card opening-unknown';
            this.openingBadgeEl.innerHTML = `<span class="opening-name">Нестандартный дебют</span>`;
          }
        } else {
          this.openingBadgeEl.style.display = 'none';
        }
      }
    } else {
      if (this.openingBadgeEl) {
        this.openingBadgeEl.style.display = 'none';
      }
    }

    // Render detail panel for selected move if review exists
    if (viewIndex !== null && viewIndex >= 0 && review && review.moves[viewIndex]) {
      const m = review.moves[viewIndex];
      this.detailEl.style.display = 'flex';
      const evalFormatted = m.evalAfter.type === 'mate'
        ? `Мат ${m.evalAfter.value > 0 ? '+' : ''}${m.evalAfter.value}`
        : `${(scoreToCp(m.evalAfter) / 100).toFixed(2)}`;
      const meta = getMoveClassMeta(m.class);
      const bestSan = m.bestSan || '—';
      const lossText = m.loss > 0 ? `-${m.loss.toFixed(1)}%` : '0%';
      const verdictTitle = this.getFeedbackVerdictTitle(m.class, meta.nameRu);
      const verdictDesc = this.getFeedbackDescription(m.class);
      const descHtml = verdictDesc
        ? `<span class="feedback-card-desc">${verdictDesc}</span>`
        : '';

      this.detailEl.innerHTML = `
        <div class="feedback-card-header">
          <span class="move-class-badge class-row-badge feedback-card-badge badge-${m.class}" data-class="${m.class}" title="${meta.nameRu}">
            ${meta.svg}
          </span>
          <div class="feedback-card-verdict-wrap">
            <span class="feedback-card-verdict">${verdictTitle}</span>
            ${descHtml}
            <span class="detail-badge badge-${m.class}" data-class="${m.class}" style="display: none;">${meta.nameRu.toLowerCase()}</span>
          </div>
        </div>
        <div class="feedback-card-details">
          <div class="feedback-detail-item">
            <span class="feedback-label">Ход:</span>
            <span class="feedback-value"><strong>${m.san}</strong></span>
          </div>
          <div class="feedback-detail-item detail-best">
            <span class="feedback-label">Лучший ход:</span>
            <span class="feedback-value"><strong>${bestSan}</strong></span>
          </div>
          <div class="feedback-detail-item detail-eval">
            <span class="feedback-label">Оценка:</span>
            <span class="feedback-value"><strong>${evalFormatted}</strong></span>
          </div>
          <div class="feedback-detail-item feedback-loss-item">
            <span class="feedback-label">Потеря шансов:</span>
            <span class="feedback-value feedback-loss"><strong>${lossText}</strong></span>
          </div>
        </div>
      `;
    } else {
      this.detailEl.style.display = 'none';
      this.detailEl.innerHTML = '';
    }

    // Update mistake navigation buttons
    if (isReview && review) {
      this.mistakeNavEl.style.display = 'flex';
      const currentIdx = viewIndex === null ? history.length : viewIndex;
      let hasPrev = false;
      let hasNext = false;
      for (let i = 0; i < history.length; i++) {
        const m = review.moves[i];
        if (m && this.isMistake(m.class)) {
          if (i < currentIdx) hasPrev = true;
          if (i > (viewIndex === null ? -1 : viewIndex)) hasNext = true;
        }
      }
      this.prevMistakeBtn.disabled = !hasPrev;
      this.nextMistakeBtn.disabled = !hasNext;
    } else {
      this.mistakeNavEl.style.display = 'none';
    }

    let replayState = classicalRuleSet.getInitialState();
    const sans: string[] = [];
    for (let i = 0; i < history.length; i++) {
      sans.push(moveToSAN(replayState, history[i]));
      replayState = classicalRuleSet.applyMove(replayState, history[i]);
    }

    for (let i = 0; i < sans.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteSan = sans[i];
      const blackSan = sans[i + 1] ?? '';

      const row = document.createElement('div');
      row.className = 'history-row';

      const numSpan = document.createElement('span');
      numSpan.className = 'history-num';
      numSpan.textContent = `${moveNum}.`;
      row.appendChild(numSpan);

      const whiteSpan = document.createElement('span');
      whiteSpan.className = 'history-move';
      whiteSpan.dataset.moveIndex = i.toString();

      const whiteSanText = document.createElement('span');
      whiteSanText.className = 'san-text';
      whiteSanText.textContent = whiteSan;
      whiteSpan.appendChild(whiteSanText);

      const whiteReview = review?.moves[i];
      if (whiteReview) {
        const meta = getMoveClassMeta(whiteReview.class);
        const badge = document.createElement('span');
        badge.className = `move-class-badge review-move-badge badge-${whiteReview.class}`;
        badge.dataset.class = whiteReview.class;
        badge.title = meta.nameRu;
        badge.innerHTML = meta.svg;
        whiteSpan.appendChild(badge);
      }

      if (viewIndex === i) whiteSpan.classList.add('active');
      whiteSpan.addEventListener('click', () => {
        this.playReviewMoveSound(i);
        this.store.setViewIndex(i);
      });
      row.appendChild(whiteSpan);

      if (blackSan) {
        const blackSpan = document.createElement('span');
        blackSpan.className = 'history-move';
        blackSpan.dataset.moveIndex = (i + 1).toString();

        const blackSanText = document.createElement('span');
        blackSanText.className = 'san-text';
        blackSanText.textContent = blackSan;
        blackSpan.appendChild(blackSanText);

        const blackReview = review?.moves[i + 1];
        if (blackReview) {
          const meta = getMoveClassMeta(blackReview.class);
          const badge = document.createElement('span');
          badge.className = `move-class-badge review-move-badge badge-${blackReview.class}`;
          badge.dataset.class = blackReview.class;
          badge.title = meta.nameRu;
          badge.innerHTML = meta.svg;
          blackSpan.appendChild(badge);
        }

        if (viewIndex === i + 1) blackSpan.classList.add('active');
        blackSpan.addEventListener('click', () => {
          this.playReviewMoveSound(i + 1);
          this.store.setViewIndex(i + 1);
        });
        row.appendChild(blackSpan);
      }

      this.listEl.appendChild(row);
    }

    const activeEl = this.listEl.querySelector('.history-move.active') as HTMLElement | null;
    if (activeEl) {
      const activeRow = (activeEl.closest('.history-row') as HTMLElement | null) ?? activeEl;
      const container = this.listEl;
      if (container) {
        const rowTop = activeRow.offsetTop;
        const rowHeight = activeRow.offsetHeight;
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        if (rowTop < containerTop) {
          container.scrollTop = rowTop;
        } else if (rowTop + rowHeight > containerTop + containerHeight) {
          container.scrollTop = rowTop + rowHeight - containerHeight;
        }
      }
    } else {
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }
  }
}
