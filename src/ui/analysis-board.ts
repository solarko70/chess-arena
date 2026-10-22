import { ChessStore } from '../state/store';
import { ChessBoardUI } from './board';
import { createEngine, type AnalysisEngine, type AnalysisEngineResult } from '@/analysis';
import {
  exportPGN,
  generateLegal,
  isInCheck,
  moveToSAN,
  parseFEN,
  parsePGN,
  serializeFEN,
  type CastlingRights,
  type Color,
  type GameState,
  type Piece,
  type PieceType,
  type Square,
} from '@/core';
import { getPieceSvg } from './pieces';

const BACK_ICON = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
`;

const FLIP_ICON = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>
`;

const EDIT_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
`;

const COPY_ICON = `
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
`;

const IMPORT_ICON = `
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="16 16 12 12 8 16"></polyline>
    <line x1="12" y1="12" x2="12" y2="21"></line>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
  </svg>
`;

const TRASH_ICON = `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
`;

const NAV_FIRST_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <line x1="5" y1="4" x2="5" y2="20"></line>
    <polygon points="19 4 9 12 19 20 19 4" fill="currentColor"></polygon>
  </svg>
`;

const NAV_PREV_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polygon points="17 4 7 12 17 20 17 4" fill="currentColor"></polygon>
  </svg>
`;

const NAV_NEXT_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polygon points="7 4 17 12 7 20 7 4" fill="currentColor"></polygon>
  </svg>
`;

const NAV_LAST_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"></polygon>
    <line x1="19" y1="4" x2="19" y2="20"></line>
  </svg>
`;

const PIECE_TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

export interface AnalysisBoardOptions {
  onBackToMain?: () => void;
}

export class AnalysisBoardUI {
  private container: HTMLElement;
  private store: ChessStore;
  private boardUI: ChessBoardUI;
  private engine: AnalysisEngine;
  private abortController: AbortController | null = null;
  private onBackCallback?: () => void;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private isEditorOpen = false;
  private editorPieces: (Piece | null)[] = [];
  private editorTurn: Color = 'white';
  private editorCastling: CastlingRights = {
    white: { kingside: true, queenside: true },
    black: { kingside: true, queenside: true },
  };
  private selectedBrush: Piece | 'eraser' | null = null;
  private copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private isPaused = false;

  constructor(container: HTMLElement, options: AnalysisBoardOptions = {}) {
    this.container = container;
    this.onBackCallback = options.onBackToMain;
    this.store = new ChessStore();
    this.engine = createEngine();

    this.renderSkeleton();
    const boardMount = this.container.querySelector('#analysis-board-mount') as HTMLElement;
    this.boardUI = new ChessBoardUI(boardMount, this.store);

    this.initEvents();
    this.store.subscribe(() => {
      this.handleStoreChange();
    });

    this.handleStoreChange();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="analysis-screen-inner">
        <header class="analysis-topbar">
          <button class="btn-back-to-main" id="btn-analysis-back-to-main" aria-label="В главное меню">
            ${BACK_ICON}
            <span>В главное меню</span>
          </button>
          <div class="analysis-title">
            <span>Анализ партии</span>
          </div>
          <div class="analysis-topbar-actions">
            <button class="solar-btn-ghost btn-analysis-tool" id="btn-analysis-flip" title="Перевернуть доску (F)" aria-label="Перевернуть доску">
              ${FLIP_ICON}
              <span>Разворот</span>
            </button>
            <button class="solar-btn-ghost btn-analysis-tool" id="btn-board-editor" title="Редактировать расстановку" aria-label="Редактор расстановки">
              ${EDIT_ICON}
              <span>Редактор доски</span>
            </button>
          </div>
        </header>

        <div class="analysis-layout">
          <!-- Left Board Column -->
          <div class="analysis-board-col">
            <div id="analysis-board-mount" class="analysis-board-mount"></div>

            <div class="analysis-board-nav">
              <button class="btn-board-nav" id="btn-nav-start" title="В начало (Стрелка вверх)" aria-label="В начало">
                ${NAV_FIRST_ICON}
              </button>
              <button class="btn-board-nav" id="btn-nav-prev" title="Назад (Стрелка влево)" aria-label="Назад">
                ${NAV_PREV_ICON}
              </button>
              <button class="btn-board-nav" id="btn-nav-next" title="Вперёд (Стрелка вправо)" aria-label="Вперёд">
                ${NAV_NEXT_ICON}
              </button>
              <button class="btn-board-nav" id="btn-nav-end" title="В конец (Стрелка вниз)" aria-label="В конец">
                ${NAV_LAST_ICON}
              </button>
            </div>
          </div>

          <!-- Right Analysis Panel -->
          <aside class="analysis-side-panel">
            <!-- Engine Evaluation Section -->
            <section class="analysis-section analysis-engine-section">
              <div class="engine-section-header">
                <span class="engine-name-badge" id="analysis-engine-name">Stockfish</span>
                <span class="engine-depth-badge" id="analysis-engine-depth">Глубина: —</span>
              </div>
              <div class="engine-eval-row">
                <div class="engine-eval-numeric" id="analysis-eval-numeric">0.0</div>
                <div class="engine-bestmove-info" id="analysis-bestmove-info">Анализ позиции...</div>
              </div>
              <div class="engine-pv-line" id="analysis-pv-line"></div>
            </section>

            <!-- Move History Section -->
            <section class="analysis-section analysis-history-section">
              <div class="analysis-section-title">История ходов</div>
              <div class="analysis-moves-scroll" id="analysis-moves-container"></div>
            </section>

            <!-- FEN Section -->
            <section class="analysis-section analysis-fen-section">
              <div class="analysis-section-title">FEN позиции</div>
              <div class="fen-input-wrapper">
                <input type="text" class="analysis-text-input" id="analysis-fen-input" spellcheck="false" />
              </div>
              <div class="analysis-btn-row">
                <button class="solar-btn-ghost btn-sm" id="btn-copy-fen" title="Скопировать FEN">
                  ${COPY_ICON}
                  <span>Копировать FEN</span>
                </button>
                <button class="solar-btn-ghost btn-sm" id="btn-load-fen" title="Загрузить FEN">
                  ${IMPORT_ICON}
                  <span>Загрузить</span>
                </button>
              </div>
              <div class="analysis-error-text" id="analysis-fen-error" style="display: none;"></div>
            </section>

            <!-- PGN Section -->
            <section class="analysis-section analysis-pgn-section">
              <div class="analysis-section-title">PGN партии</div>
              <div class="pgn-input-wrapper">
                <textarea class="analysis-textarea-input" id="analysis-pgn-input" rows="3" spellcheck="false"></textarea>
              </div>
              <div class="analysis-btn-row">
                <button class="solar-btn-ghost btn-sm" id="btn-copy-pgn" title="Скопировать PGN">
                  ${COPY_ICON}
                  <span>Копировать PGN</span>
                </button>
                <button class="solar-btn-ghost btn-sm" id="btn-load-pgn" title="Импорт партии">
                  ${IMPORT_ICON}
                  <span>Импорт PGN</span>
                </button>
              </div>
              <div class="analysis-error-text" id="analysis-pgn-error" style="display: none;"></div>
            </section>
          </aside>
        </div>

        <!-- Board Editor Modal / Overlay (Stage 6b Part 4) -->
        <div class="editor-overlay" id="analysis-editor-overlay" style="display: none;" role="dialog" aria-modal="true" aria-label="Редактор расстановки">
          <div class="editor-modal">
            <header class="editor-header">
              <h2 class="editor-title">Редактор расстановки фигур</h2>
              <button class="editor-close-btn" id="btn-editor-close" aria-label="Закрыть">✕</button>
            </header>

            <div class="editor-body">
              <!-- Palette White pieces -->
              <div class="editor-palette-group">
                <span class="palette-label">Белые фигуры:</span>
                <div class="editor-palette" id="palette-white"></div>
              </div>

              <!-- Palette Black pieces -->
              <div class="editor-palette-group">
                <span class="palette-label">Чёрные фигуры:</span>
                <div class="editor-palette" id="palette-black"></div>
              </div>

              <!-- Palette Tools (Eraser) -->
              <div class="editor-palette-tools">
                <button class="palette-piece palette-tool" id="tool-eraser" title="Ластик / Удаление фигуры" aria-label="Ластик">
                  ${TRASH_ICON}
                </button>
                <button class="solar-btn-ghost btn-sm" id="btn-editor-clear">Очистить доску</button>
                <button class="solar-btn-ghost btn-sm" id="btn-editor-initial">Начальная позиция</button>
              </div>

              <!-- Editor Interactive Board -->
              <div class="editor-board-mount" id="editor-board-mount"></div>

              <!-- Editor Position Parameters -->
              <div class="editor-params-grid">
                <div class="editor-param-col">
                  <span class="param-title">Очерёдность хода:</span>
                  <label class="editor-radio-label">
                    <input type="radio" name="editor-turn" value="white" id="editor-turn-white" checked />
                    <span>Ход белых</span>
                  </label>
                  <label class="editor-radio-label">
                    <input type="radio" name="editor-turn" value="black" id="editor-turn-black" />
                    <span>Ход чёрных</span>
                  </label>
                </div>

                <div class="editor-param-col">
                  <span class="param-title">Рокировка белых:</span>
                  <label class="editor-check-label">
                    <input type="checkbox" id="editor-castling-wk" checked />
                    <span>O-O (Короткая)</span>
                  </label>
                  <label class="editor-check-label">
                    <input type="checkbox" id="editor-castling-wq" checked />
                    <span>O-O-O (Длинная)</span>
                  </label>
                </div>

                <div class="editor-param-col">
                  <span class="param-title">Рокировка чёрных:</span>
                  <label class="editor-check-label">
                    <input type="checkbox" id="editor-castling-bk" checked />
                    <span>O-O (Короткая)</span>
                  </label>
                  <label class="editor-check-label">
                    <input type="checkbox" id="editor-castling-bq" checked />
                    <span>O-O-O (Длинная)</span>
                  </label>
                </div>
              </div>

              <div class="editor-error-msg" id="editor-error-msg" style="display: none;"></div>
            </div>

            <footer class="editor-footer">
              <button class="solar-btn-ghost" id="btn-editor-cancel">Отмена</button>
              <button class="btn-action" id="btn-editor-apply">Применить расстановку</button>
            </footer>
          </div>
        </div>
      </div>
    `;
  }

  private initEvents(): void {
    // Back to main
    this.container.querySelector('#btn-analysis-back-to-main')?.addEventListener('click', () => {
      this.onBackCallback?.();
    });

    // Flip board
    this.container.querySelector('#btn-analysis-flip')?.addEventListener('click', () => {
      this.store.toggleFlip();
    });

    // Navigation buttons
    this.container.querySelector('#btn-nav-start')?.addEventListener('click', () => {
      this.viewStart();
    });
    this.container.querySelector('#btn-nav-prev')?.addEventListener('click', () => {
      this.viewPrev();
    });
    this.container.querySelector('#btn-nav-next')?.addEventListener('click', () => {
      this.viewNext();
    });
    this.container.querySelector('#btn-nav-end')?.addEventListener('click', () => {
      this.viewEnd();
    });

    // FEN Actions
    const fenInput = this.container.querySelector('#analysis-fen-input') as HTMLInputElement | null;
    const copyFenBtn = this.container.querySelector('#btn-copy-fen') as HTMLButtonElement | null;
    const loadFenBtn = this.container.querySelector('#btn-load-fen') as HTMLButtonElement | null;

    copyFenBtn?.addEventListener('click', async () => {
      const fen = serializeFEN(this.store.getState());
      await this.copyText(fen, copyFenBtn, 'Скопировано');
    });

    loadFenBtn?.addEventListener('click', () => {
      this.handleLoadFen();
    });

    fenInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleLoadFen();
      }
    });

    // PGN Actions
    const copyPgnBtn = this.container.querySelector('#btn-copy-pgn') as HTMLButtonElement | null;
    const loadPgnBtn = this.container.querySelector('#btn-load-pgn') as HTMLButtonElement | null;

    copyPgnBtn?.addEventListener('click', async () => {
      const pgn = exportPGN(this.store.getLiveState());
      await this.copyText(pgn, copyPgnBtn, 'Скопировано');
    });

    loadPgnBtn?.addEventListener('click', () => {
      this.handleLoadPgn();
    });

    // Board Editor Actions
    this.container.querySelector('#btn-board-editor')?.addEventListener('click', () => {
      this.openBoardEditor();
    });
    this.container.querySelector('#btn-editor-close')?.addEventListener('click', () => {
      this.closeBoardEditor();
    });
    this.container.querySelector('#btn-editor-cancel')?.addEventListener('click', () => {
      this.closeBoardEditor();
    });
    this.container.querySelector('#btn-editor-apply')?.addEventListener('click', () => {
      this.applyEditorPosition();
    });
    this.container.querySelector('#btn-editor-clear')?.addEventListener('click', () => {
      this.clearEditorBoard();
    });
    this.container.querySelector('#btn-editor-initial')?.addEventListener('click', () => {
      this.resetEditorInitialPosition();
    });

    // Global keyboard navigation
    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.isEditorOpen) {
        if (e.key === 'Escape') {
          this.closeBoardEditor();
        }
        return;
      }

      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.viewPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.viewNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.viewStart();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.viewEnd();
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        e.preventDefault();
        this.store.toggleFlip();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  public viewStart(): void {
    this.store.setViewIndex(-1);
  }

  public viewPrev(): void {
    const cur = this.store.getViewIndex() ?? this.store.getLiveState().history.length - 1;
    this.store.setViewIndex(Math.max(-1, cur - 1));
  }

  public viewNext(): void {
    const cur = this.store.getViewIndex();
    if (cur !== null) {
      const maxIdx = this.store.getLiveState().history.length - 1;
      if (cur >= maxIdx - 1) {
        this.store.setViewIndex(null);
      } else {
        this.store.setViewIndex(cur + 1);
      }
    }
  }

  public viewEnd(): void {
    this.store.setViewIndex(null);
  }

  private handleStoreChange(): void {
    const state = this.store.getState();
    const liveState = this.store.getLiveState();
    const viewIndex = this.store.getViewIndex();

    // Update FEN input
    const fenInput = this.container.querySelector('#analysis-fen-input') as HTMLInputElement | null;
    if (fenInput && document.activeElement !== fenInput) {
      fenInput.value = serializeFEN(state);
    }

    // Update PGN input
    const pgnInput = this.container.querySelector('#analysis-pgn-input') as HTMLTextAreaElement | null;
    if (pgnInput && document.activeElement !== pgnInput) {
      pgnInput.value = exportPGN(liveState);
    }

    // Update nav buttons disabled state
    const historyLen = liveState.history.length;
    const curPly = viewIndex === null ? historyLen - 1 : viewIndex;

    const btnStart = this.container.querySelector('#btn-nav-start') as HTMLButtonElement | null;
    const btnPrev = this.container.querySelector('#btn-nav-prev') as HTMLButtonElement | null;
    const btnNext = this.container.querySelector('#btn-nav-next') as HTMLButtonElement | null;
    const btnEnd = this.container.querySelector('#btn-nav-end') as HTMLButtonElement | null;

    if (btnStart) btnStart.disabled = curPly < 0;
    if (btnPrev) btnPrev.disabled = curPly < 0;
    if (btnNext) btnNext.disabled = curPly >= historyLen - 1;
    if (btnEnd) btnEnd.disabled = curPly >= historyLen - 1;

    // Render Move History table
    this.renderMovesTable(liveState, curPly);

    // Run continuous engine evaluation
    if (!this.isPaused) {
      this.runLiveAnalysis();
    }
  }

  public pause(): void {
    this.isPaused = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.runLiveAnalysis();
  }

  private renderMovesTable(liveState: GameState, curPly: number): void {
    const container = this.container.querySelector('#analysis-moves-container');
    if (!container) return;

    if (liveState.history.length === 0) {
      container.innerHTML = '<div class="analysis-moves-empty">Сделайте ход на доске для начала анализа</div>';
      return;
    }

    let html = '<div class="analysis-moves-table">';
    let tempState = this.store.getStateAtPly(-1);

    for (let i = 0; i < liveState.history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = liveState.history[i];
      const blackMove = liveState.history[i + 1];

      const whiteSan = whiteMove ? moveToSAN(tempState, whiteMove) : '';
      if (whiteMove) tempState = this.store.getStateAtPly(i);

      const blackSan = blackMove ? moveToSAN(tempState, blackMove) : '';
      if (blackMove) tempState = this.store.getStateAtPly(i + 1);

      const whiteActive = curPly === i ? 'active' : '';
      const blackActive = curPly === i + 1 ? 'active' : '';

      html += `
        <div class="analysis-move-row">
          <span class="move-num">${moveNum}.</span>
          <span class="move-item ${whiteActive}" data-ply="${i}">${whiteSan}</span>
          ${blackMove ? `<span class="move-item ${blackActive}" data-ply="${i + 1}">${blackSan}</span>` : '<span class="move-item empty"></span>'}
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach click listeners to plies
    container.querySelectorAll('.move-item[data-ply]').forEach((el) => {
      el.addEventListener('click', () => {
        const ply = parseInt(el.getAttribute('data-ply') ?? '0', 10);
        this.store.setViewIndex(ply);
      });
    });

    // Auto scroll active move into view
    const activeEl = container.querySelector('.move-item.active') as HTMLElement | null;
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private runLiveAnalysis(): void {
    if (this.isPaused) return;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const currentState = this.store.getState();
    const legal = generateLegal(currentState);

    const numericEl = this.container.querySelector('#analysis-eval-numeric');
    const bestMoveEl = this.container.querySelector('#analysis-bestmove-info');
    const depthEl = this.container.querySelector('#analysis-engine-depth');
    const pvEl = this.container.querySelector('#analysis-pv-line');
    const engineNameEl = this.container.querySelector('#analysis-engine-name');

    if (engineNameEl) {
      engineNameEl.textContent = this.engine.name || 'Stockfish';
    }

    // Terminal positions check
    if (legal.length === 0) {
      if (this.store.isInCheck()) {
        const isWhiteMated = currentState.turn === 'white';
        const mateScore = { type: 'mate' as const, value: isWhiteMated ? -1 : 1 };
        this.boardUI.setExternalScore(mateScore);
        this.boardUI.setExternalArrow(null);
        if (numericEl) numericEl.textContent = isWhiteMated ? '0-1' : '1-0';
        if (bestMoveEl) bestMoveEl.textContent = `Мат! ${isWhiteMated ? 'Чёрные победили' : 'Белые победили'}`;
        if (depthEl) depthEl.textContent = 'Мат';
        if (pvEl) pvEl.textContent = '';
      } else {
        const drawScore = { type: 'cp' as const, value: 0 };
        this.boardUI.setExternalScore(drawScore);
        this.boardUI.setExternalArrow(null);
        if (numericEl) numericEl.textContent = '½-½';
        if (bestMoveEl) bestMoveEl.textContent = 'Ничья (Пат)';
        if (depthEl) depthEl.textContent = 'Пат';
        if (pvEl) pvEl.textContent = '';
      }
      return;
    }

    if (numericEl) numericEl.textContent = '...';
    if (bestMoveEl) bestMoveEl.textContent = 'Анализ...';
    if (depthEl) depthEl.textContent = 'Глубина: ...';

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.engine
      .analyze(currentState, {
        depth: 18,
        multiPV: 1,
        signal,
      })
      .then((res: AnalysisEngineResult) => {
        if (signal.aborted) return;
        this.boardUI.setExternalScore(res.score);
        if (res.bestMove) {
          this.boardUI.setExternalArrow(res.bestMove);
        } else {
          this.boardUI.setExternalArrow(null);
        }

        if (depthEl) {
          depthEl.textContent = `Глубина: ${res.depth}`;
        }

        if (numericEl) {
          if (res.score.type === 'mate') {
            const val = res.score.value;
            numericEl.textContent = val > 0 ? `M${Math.abs(val)}` : `-M${Math.abs(val)}`;
          } else {
            const cp = res.score.value / 100;
            const sign = cp > 0 ? '+' : '';
            numericEl.textContent = `${sign}${cp.toFixed(1)}`;
          }
        }

        if (bestMoveEl) {
          if (res.bestMove) {
            const san = moveToSAN(currentState, res.bestMove);
            bestMoveEl.textContent = `Лучший ход: ${san}`;
          } else {
            bestMoveEl.textContent = 'Оценка рассчитана';
          }
        }

        if (pvEl) {
          const firstLine = res.lines[0];
          if (firstLine && firstLine.pvSan && firstLine.pvSan.length > 0) {
            pvEl.textContent = `Линия: ${firstLine.pvSan.slice(0, 7).join(' ')}`;
          } else {
            pvEl.textContent = '';
          }
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
      });
  }

  private handleLoadFen(): void {
    const fenInput = this.container.querySelector('#analysis-fen-input') as HTMLInputElement | null;
    if (!fenInput) return;
    const raw = fenInput.value.trim();
    if (!raw) return;

    try {
      const parsed = parseFEN(raw);
      const pieces = parsed.board.pieces;
      const whiteKings = pieces.filter((p) => p && p.type === 'king' && p.color === 'white');
      const blackKings = pieces.filter((p) => p && p.type === 'king' && p.color === 'black');

      if (whiteKings.length !== 1 || blackKings.length !== 1) {
        this.showFenError('Некорректная позиция: на доске должен быть ровно один белый и один чёрный король');
        return;
      }

      this.clearFenError();
      this.store.newGame(parsed);
      this.handleStoreChange();
    } catch {
      this.showFenError('Некорректная FEN-строка');
    }
  }

  private handleLoadPgn(): void {
    const pgnInput = this.container.querySelector('#analysis-pgn-input') as HTMLTextAreaElement | null;
    if (!pgnInput) return;
    const raw = pgnInput.value.trim();
    if (!raw) return;

    try {
      const parsed = parsePGN(raw);
      this.clearPgnError();
      this.store.newGame(parsed.state);
      this.handleStoreChange();
    } catch {
      this.showPgnError('Не удалось разобрать PGN партии');
    }
  }

  private showFenError(msg: string): void {
    const errEl = this.container.querySelector('#analysis-fen-error') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  }

  private clearFenError(): void {
    const errEl = this.container.querySelector('#analysis-fen-error') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  private showPgnError(msg: string): void {
    const errEl = this.container.querySelector('#analysis-pgn-error') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  }

  private clearPgnError(): void {
    const errEl = this.container.querySelector('#analysis-pgn-error') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  private async copyText(text: string, button: HTMLButtonElement, feedback: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Safe fallback on clipboard restriction
    }
    const origHtml = button.innerHTML;
    button.innerHTML = `<span>${feedback}</span>`;
    if (this.copyFeedbackTimer) clearTimeout(this.copyFeedbackTimer);
    this.copyFeedbackTimer = setTimeout(() => {
      button.innerHTML = origHtml;
    }, 1500);
  }

  // ── Board Editor Implementation (Stage 6b Part 4) ───────────────────────

  public openBoardEditor(): void {
    this.isEditorOpen = true;
    const state = this.store.getState();
    this.editorPieces = [...state.board.pieces];
    this.editorTurn = state.turn;
    this.editorCastling = {
      white: { ...state.castlingRights.white },
      black: { ...state.castlingRights.black },
    };
    this.selectedBrush = null;

    const overlay = this.container.querySelector('#analysis-editor-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'flex';

    this.renderEditorPalettes();
    this.renderEditorBoard();
    this.syncEditorParams();
    this.clearEditorError();
  }

  public closeBoardEditor(): void {
    this.isEditorOpen = false;
    const overlay = this.container.querySelector('#analysis-editor-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'none';
    this.clearEditorError();
  }

  private renderEditorPalettes(): void {
    const whitePalette = this.container.querySelector('#palette-white');
    const blackPalette = this.container.querySelector('#palette-black');
    if (!whitePalette || !blackPalette) return;

    whitePalette.innerHTML = '';
    blackPalette.innerHTML = '';

    for (const type of PIECE_TYPES) {
      const wBtn = document.createElement('button');
      wBtn.className = 'palette-piece';
      wBtn.dataset.color = 'white';
      wBtn.dataset.type = type;
      wBtn.innerHTML = getPieceSvg(type, 'white');
      wBtn.title = `Белая фигура: ${type}`;
      wBtn.addEventListener('click', () => this.selectBrush({ type, color: 'white' }, wBtn));
      whitePalette.appendChild(wBtn);

      const bBtn = document.createElement('button');
      bBtn.className = 'palette-piece';
      bBtn.dataset.color = 'black';
      bBtn.dataset.type = type;
      bBtn.innerHTML = getPieceSvg(type, 'black');
      bBtn.title = `Чёрная фигура: ${type}`;
      bBtn.addEventListener('click', () => this.selectBrush({ type, color: 'black' }, bBtn));
      blackPalette.appendChild(bBtn);
    }

    const eraserBtn = this.container.querySelector('#tool-eraser') as HTMLElement | null;
    eraserBtn?.addEventListener('click', () => {
      this.selectBrush('eraser', eraserBtn);
    });
  }

  private selectBrush(brush: Piece | 'eraser', btnEl: HTMLElement): void {
    this.container.querySelectorAll('.palette-piece').forEach((el) => el.classList.remove('active'));
    if (this.selectedBrush === brush) {
      this.selectedBrush = null;
    } else {
      this.selectedBrush = brush;
      btnEl.classList.add('active');
    }
  }

  private renderEditorBoard(): void {
    const mount = this.container.querySelector('#editor-board-mount');
    if (!mount) return;

    mount.innerHTML = '';
    const boardEl = document.createElement('div');
    boardEl.className = 'editor-board chess-board';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = r * 8 + c;
        const isLight = (r + c) % 2 === 0;
        const piece = this.editorPieces[sq];

        const sqEl = document.createElement('div');
        sqEl.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        sqEl.dataset.square = sq.toString();

        if (piece) {
          const pieceWrapper = document.createElement('div');
          pieceWrapper.className = 'piece-wrapper';
          pieceWrapper.innerHTML = getPieceSvg(piece.type, piece.color);
          sqEl.appendChild(pieceWrapper);
        }

        // Click to apply or erase
        sqEl.addEventListener('click', () => {
          this.handleEditorSquareClick(sq);
        });

        boardEl.appendChild(sqEl);
      }
    }

    mount.appendChild(boardEl);
  }

  private handleEditorSquareClick(sq: Square): void {
    if (!this.selectedBrush) {
      // If no brush selected, clicking on a piece removes it (toggle click)
      this.editorPieces[sq] = null;
    } else if (this.selectedBrush === 'eraser') {
      this.editorPieces[sq] = null;
    } else {
      this.editorPieces[sq] = { ...this.selectedBrush };
    }
    this.renderEditorBoard();
  }

  private clearEditorBoard(): void {
    this.editorPieces = new Array(64).fill(null);
    this.renderEditorBoard();
  }

  private resetEditorInitialPosition(): void {
    const initialState = this.store.getStateAtPly(-1);
    this.editorPieces = [...initialState.board.pieces];
    this.editorTurn = 'white';
    this.editorCastling = {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    };
    this.syncEditorParams();
    this.renderEditorBoard();
  }

  private syncEditorParams(): void {
    const turnWhiteRadio = this.container.querySelector('#editor-turn-white') as HTMLInputElement | null;
    const turnBlackRadio = this.container.querySelector('#editor-turn-black') as HTMLInputElement | null;
    if (turnWhiteRadio && turnBlackRadio) {
      if (this.editorTurn === 'white') turnWhiteRadio.checked = true;
      else turnBlackRadio.checked = true;
    }

    const wk = this.container.querySelector('#editor-castling-wk') as HTMLInputElement | null;
    const wq = this.container.querySelector('#editor-castling-wq') as HTMLInputElement | null;
    const bk = this.container.querySelector('#editor-castling-bk') as HTMLInputElement | null;
    const bq = this.container.querySelector('#editor-castling-bq') as HTMLInputElement | null;

    if (wk) wk.checked = this.editorCastling.white.kingside;
    if (wq) wq.checked = this.editorCastling.white.queenside;
    if (bk) bk.checked = this.editorCastling.black.kingside;
    if (bq) bq.checked = this.editorCastling.black.queenside;
  }

  public applyEditorPosition(): void {
    // Read turn & castling
    const turnBlackRadio = this.container.querySelector('#editor-turn-black') as HTMLInputElement | null;
    this.editorTurn = turnBlackRadio?.checked ? 'black' : 'white';

    const wk = (this.container.querySelector('#editor-castling-wk') as HTMLInputElement | null)?.checked ?? false;
    const wq = (this.container.querySelector('#editor-castling-wq') as HTMLInputElement | null)?.checked ?? false;
    const bk = (this.container.querySelector('#editor-castling-bk') as HTMLInputElement | null)?.checked ?? false;
    const bq = (this.container.querySelector('#editor-castling-bq') as HTMLInputElement | null)?.checked ?? false;

    this.editorCastling = {
      white: { kingside: wk, queenside: wq },
      black: { kingside: bk, queenside: bq },
    };

    // Validation 1: Kings count
    const whiteKings = this.editorPieces.filter((p) => p && p.type === 'king' && p.color === 'white');
    const blackKings = this.editorPieces.filter((p) => p && p.type === 'king' && p.color === 'black');

    if (whiteKings.length !== 1 || blackKings.length !== 1) {
      this.showEditorError('На доске должен быть ровно один белый и один чёрный король');
      return;
    }

    // Validation 2: Pawns on promotion ranks (rank 0 or 7)
    for (let c = 0; c < 8; c++) {
      const topPiece = this.editorPieces[c];
      const bottomPiece = this.editorPieces[56 + c];
      if (topPiece?.type === 'pawn' || bottomPiece?.type === 'pawn') {
        this.showEditorError('Пешки не могут находиться на 1-й и 8-й горизонталях');
        return;
      }
    }

    // Validation 3: Non-moving side must not be in check
    const nonMovingTurn: Color = this.editorTurn === 'white' ? 'black' : 'white';
    const tempState: GameState = {
      board: {
        width: 8,
        height: 8,
        pieces: [...this.editorPieces],
      },
      turn: nonMovingTurn,
      castlingRights: { ...this.editorCastling },
      enPassantSquare: null,
      halfMoveClock: 0,
      fullMoveNumber: 1,
      history: [],
      positionHistory: [],
    };

    if (isInCheck(tempState.board, nonMovingTurn)) {
      this.showEditorError('Король стороны, которая не ходит, не может быть под шахом');
      return;
    }

    // Apply valid position to store
    const finalState: GameState = {
      ...tempState,
      turn: this.editorTurn,
    };

    this.store.newGame(finalState);
    this.closeBoardEditor();
    this.handleStoreChange();
  }

  private showEditorError(msg: string): void {
    const errEl = this.container.querySelector('#editor-error-msg') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  }

  private clearEditorError(): void {
    const errEl = this.container.querySelector('#editor-error-msg') as HTMLElement | null;
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  public getStore(): ChessStore {
    return this.store;
  }

  public getBoardUI(): ChessBoardUI {
    return this.boardUI;
  }

  public getEngine(): AnalysisEngine {
    return this.engine;
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.copyFeedbackTimer) {
      clearTimeout(this.copyFeedbackTimer);
      this.copyFeedbackTimer = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.engine.dispose();
    this.boardUI.clearExternalAnalysis();
    this.container.innerHTML = '';
  }
}

export function mountAnalysisBoard(container: HTMLElement, options: AnalysisBoardOptions = {}): AnalysisBoardUI {
  return new AnalysisBoardUI(container, options);
}
