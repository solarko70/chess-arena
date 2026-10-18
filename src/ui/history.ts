import { ChessStore } from '@/state/store';
import { moveToSAN, classicalRuleSet } from '@/core';
import { scoreToCp, MOVE_CLASS_LABELS, type MoveClass } from '@/analysis';

export class HistoryUI {
  private container: HTMLElement;
  private store: ChessStore;
  private listEl!: HTMLElement;
  private detailEl!: HTMLElement;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="history-panel">
        <div class="history-header">История ходов</div>
        <div class="history-detail-panel" id="history-detail-panel" style="display: none;"></div>
        <div class="history-list"></div>
        <div class="history-nav">
          <button id="hist-first" title="В начало (Home)">|&lt;</button>
          <button id="hist-prev" title="Назад (&larr;)">&larr;</button>
          <button id="hist-next" title="Вперед (&rarr;)">&rarr;</button>
          <button id="hist-last" title="В конец (End)">&gt;|</button>
        </div>
      </div>
    `;

    this.listEl = this.container.querySelector('.history-list') as HTMLElement;
    this.detailEl = this.container.querySelector('#history-detail-panel') as HTMLElement;
    this.initEvents();
    this.store.subscribe(() => this.render());
  }

  private initEvents(): void {
    this.container.querySelector('#hist-first')?.addEventListener('click', () => {
      this.store.setViewIndex(-1);
    });
    this.container.querySelector('#hist-prev')?.addEventListener('click', () => {
      const current = this.store.getViewIndex();
      const historyLen = this.store.getLiveState().history.length;
      if (historyLen === 0) return;
      const target = current === null ? historyLen - 2 : current - 1;
      this.store.setViewIndex(target);
    });
    this.container.querySelector('#hist-next')?.addEventListener('click', () => {
      const current = this.store.getViewIndex();
      if (current !== null) {
        this.store.setViewIndex(current + 1);
      }
    });
    this.container.querySelector('#hist-last')?.addEventListener('click', () => {
      this.store.setViewIndex(null);
    });

    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      const historyLen = this.store.getLiveState().history.length;
      if (historyLen === 0) return;

      const current = this.store.getViewIndex();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const target = current === null ? historyLen - 2 : current - 1;
        this.store.setViewIndex(target);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (current !== null) {
          this.store.setViewIndex(current + 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.store.setViewIndex(-1);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.store.setViewIndex(null);
      }
    });
  }

  private render(): void {
    const liveState = this.store.getLiveState();
    const history = liveState.history;
    const viewIndex = this.store.getViewIndex();
    const review = this.store.getReviewResult();

    this.listEl.innerHTML = '';

    // Render detail panel for selected move if review exists
    if (viewIndex !== null && viewIndex >= 0 && review && review.moves[viewIndex]) {
      const m = review.moves[viewIndex];
      this.detailEl.style.display = 'flex';
      const evalFormatted = m.evalAfter.type === 'mate'
        ? `Мат ${m.evalAfter.value > 0 ? '+' : ''}${m.evalAfter.value}`
        : `${(scoreToCp(m.evalAfter) / 100).toFixed(2)}`;
      const bestSan = m.bestSan || '—';
      this.detailEl.innerHTML = `
        <span class="detail-badge badge-${m.class}" data-class="${m.class}">${MOVE_CLASS_LABELS[m.class]}</span>
        <span class="detail-eval">Оценка: <strong>${evalFormatted}</strong></span>
        <span class="detail-best">Лучший ход: <strong>${bestSan}</strong></span>
      `;
    } else {
      this.detailEl.style.display = 'none';
      this.detailEl.innerHTML = '';
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
        const badge = document.createElement('span');
        badge.className = `move-class-badge badge-${whiteReview.class}`;
        badge.dataset.class = whiteReview.class;
        badge.title = MOVE_CLASS_LABELS[whiteReview.class];
        badge.textContent = getMoveClassSymbol(whiteReview.class);
        whiteSpan.appendChild(badge);
      }

      if (viewIndex === i) whiteSpan.classList.add('active');
      whiteSpan.addEventListener('click', () => this.store.setViewIndex(i));
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
          const badge = document.createElement('span');
          badge.className = `move-class-badge badge-${blackReview.class}`;
          badge.dataset.class = blackReview.class;
          badge.title = MOVE_CLASS_LABELS[blackReview.class];
          badge.textContent = getMoveClassSymbol(blackReview.class);
          blackSpan.appendChild(badge);
        }

        if (viewIndex === i + 1) blackSpan.classList.add('active');
        blackSpan.addEventListener('click', () => this.store.setViewIndex(i + 1));
        row.appendChild(blackSpan);
      }

      this.listEl.appendChild(row);
    }

    const activeEl = this.listEl.querySelector('.history-move.active') as HTMLElement | null;
    if (activeEl) {
      if (typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      } else {
        this.listEl.scrollTop = activeEl.offsetTop - this.listEl.offsetTop;
      }
    } else {
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }
  }
}

function getMoveClassSymbol(cls: MoveClass): string {
  switch (cls) {
    case 'best':
      return '★';
    case 'excellent':
      return '★';
    case 'good':
      return '✓';
    case 'inaccuracy':
      return '?!';
    case 'mistake':
      return '?';
    case 'blunder':
      return '??';
  }
}
