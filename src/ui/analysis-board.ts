import { ChessStore, type VariationNode } from '../state/store';
import { ChessBoardUI } from './board';
import { APP_NAME } from '@/config';
import { createEngine, type AnalysisEngine, type AnalysisEngineResult } from '@/analysis';
import {
  exportPGN,
  generateLegal,
  isInCheck,
  moveToSAN,
  parseFEN,
  parsePGN,
  positionKey,
  serializeFEN,
  type CastlingRights,
  type Color,
  type GameState,
  type Move,
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

const RESET_ICON = `
  <svg class="reset-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
`;

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
let observatorySequence = 0;

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
  private lastEvaluatedFen: string | null = null;
  private currentBestMove: Move | null = null;

  constructor(container: HTMLElement, options: AnalysisBoardOptions = {}) {
    this.container = container;
    this.onBackCallback = options.onBackToMain;
    this.store = new ChessStore();
    this.store.setAllowVariations(true);
    this.engine = createEngine();

    this.renderSkeleton();
    const boardMount = this.container.querySelector('#analysis-board-mount') as HTMLElement;
    this.boardUI = new ChessBoardUI(boardMount, this.store, { hideBadges: true });

    this.initEvents();
    this.store.subscribe(() => {
      this.handleStoreChange();
    });

    this.handleStoreChange();
  }

  private renderSkeleton(): void {
    const sceneId = `analysis-observatory-${++observatorySequence}`;
    this.container.innerHTML = `
      <svg class="analysis-bg-scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="${sceneId}-cyan">
            <stop stop-color="var(--solar-analysis-nebula-cyan)" stop-opacity="0.28"/>
            <stop offset="1" stop-color="var(--solar-analysis-nebula-cyan)" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${sceneId}-amber">
            <stop stop-color="var(--solar-analysis-nebula-amber)" stop-opacity="0.24"/>
            <stop offset="1" stop-color="var(--solar-analysis-nebula-amber)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="150" cy="280" rx="530" ry="360" fill="url(#${sceneId}-cyan)"/>
        <ellipse cx="1810" cy="850" rx="470" ry="330" fill="url(#${sceneId}-amber)"/>
        <g class="analysis-bg-grid" fill="none" stroke="var(--solar-analysis-grid)" stroke-width="1" opacity="0.2" aria-hidden="true">
          <path d="M0 220H1920 M0 540H1920 M0 860H1920 M240 0V1080 M960 0V1080 M1680 0V1080" vector-effect="non-scaling-stroke"/>
          <ellipse cx="1570" cy="260" rx="640" ry="230" transform="rotate(-28 1570 260)" vector-effect="non-scaling-stroke"/>
          <ellipse cx="1570" cy="260" rx="800" ry="340" transform="rotate(-28 1570 260)" vector-effect="non-scaling-stroke"/>
        </g>
        <path d="M90 140h0 M310 430h0 M170 740h0 M430 960h0 M1530 110h0 M1790 380h0 M1670 750h0 M1850 990h0" fill="none" stroke="var(--solar-analysis-star)" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
      </svg>
      <div class="analysis-screen-inner analysis-container">
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

            <button class="analysis-reset-board-btn" id="btn-analysis-reset-board" title="Сбросить доску к начальной позиции">
              ${RESET_ICON}
              <span>Вернуть начальную позицию</span>
            </button>

            <div class="analysis-reset-confirm" id="analysis-reset-confirm" style="display: none;">
              <div class="reset-confirm-text">Сбросить анализ к начальной позиции? Все ходы и варианты будут удалены.</div>
              <div class="reset-confirm-actions">
                <button class="btn-reset-confirm-yes" id="btn-reset-confirm-yes">Сбросить</button>
                <button class="btn-reset-confirm-no" id="btn-reset-confirm-no">Отмена</button>
              </div>
            </div>
          </div>

          <!-- Right Analysis Panel -->
          <aside class="analysis-side-panel analysis-sidebar">
            <!-- Engine Evaluation Section -->
            <section class="analysis-section analysis-engine-section">
              <div class="engine-section-header">
                <span class="engine-name-badge" id="analysis-engine-name">Stockfish 19 Lite WASM</span>
                <span class="engine-depth-badge" id="analysis-engine-depth">depth=0</span>
              </div>
              <div class="analysis-multipv-lines" id="analysis-multipv-lines">
                <div class="analysis-multipv-placeholder">Загрузка анализа Stockfish...</div>
              </div>
              <div class="engine-eval-row" style="display: none;">
                <div class="engine-eval-numeric" id="analysis-eval-numeric">0.0</div>
                <div class="engine-bestmove-info" id="analysis-bestmove-info">Анализ позиции...</div>
              </div>
              <div class="engine-pv-line" id="analysis-pv-line" style="display: none;"></div>
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
                <textarea class="analysis-textarea-input" id="analysis-pgn-input" rows="4" spellcheck="false"></textarea>
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
              <button class="editor-close-btn" id="btn-editor-close" aria-label="Закрыть">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
              </button>
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

    // Reset board to initial position
    const resetBtn = this.container.querySelector('#btn-analysis-reset-board') as HTMLButtonElement | null;
    const confirmBox = this.container.querySelector('#analysis-reset-confirm') as HTMLElement | null;
    const confirmYes = this.container.querySelector('#btn-reset-confirm-yes') as HTMLButtonElement | null;
    const confirmNo = this.container.querySelector('#btn-reset-confirm-no') as HTMLButtonElement | null;

    const performReset = () => {
      if (confirmBox) confirmBox.style.display = 'none';
      this.lastEvaluatedFen = null;
      this.currentBestMove = null;
      this.renderBestMoveArrow(null);
      this.store.newGame();
      this.store.setActiveVariationNode(null);
      this.boardUI.clearPremoves();
      this.handleStoreChange();
    };

    resetBtn?.addEventListener('click', () => {
      const state = this.store.getState();
      const liveState = this.store.getLiveState();
      const hasMoves = liveState.history.length > 0;
      const hasVariations = this.store.getVariations().length > 0;
      const isCustomFen = serializeFEN(state) !== STARTING_FEN;

      if (!hasMoves && !hasVariations && !isCustomFen) {
        performReset();
      } else {
        if (confirmBox) {
          confirmBox.style.display = confirmBox.style.display === 'none' ? 'block' : 'none';
        }
      }
    });

    confirmYes?.addEventListener('click', () => {
      performReset();
    });

    confirmNo?.addEventListener('click', () => {
      if (confirmBox) confirmBox.style.display = 'none';
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
      const pgn = exportPGN(this.store.getLiveState(), { Site: APP_NAME });
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
    this.store.setActiveVariationNode(null);
    this.store.setViewIndex(-1);
  }

  public viewPrev(): void {
    const activeVar = this.store.getActiveVariationNode();
    if (activeVar) {
      if (activeVar.parentId) {
        this.store.setActiveVariationNode(activeVar.parentId);
      } else {
        const rootPly = activeVar.rootPly;
        this.store.setActiveVariationNode(null);
        this.store.setViewIndex(rootPly);
      }
      return;
    }
    const cur = this.store.getViewIndex() ?? this.store.getLiveState().history.length - 1;
    this.store.setViewIndex(Math.max(-1, cur - 1));
  }

  public viewNext(): void {
    const activeVar = this.store.getActiveVariationNode();
    if (activeVar) {
      if (activeVar.children.length > 0) {
        this.store.setActiveVariationNode(activeVar.children[0].id);
      }
      return;
    }
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
    this.store.setActiveVariationNode(null);
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
      pgnInput.value = exportPGN(liveState, { Site: APP_NAME });
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

    // Run continuous engine evaluation only when position actually changes
    const currentFen = serializeFEN(state);
    if (!this.isPaused && this.lastEvaluatedFen !== currentFen) {
      this.lastEvaluatedFen = currentFen;
      this.currentBestMove = null;
      this.renderBestMoveArrow(null);
      this.runLiveAnalysis();
    } else {
      this.renderBestMoveArrow(this.currentBestMove);
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.lastEvaluatedFen = null;
    this.currentBestMove = null;
    this.renderBestMoveArrow(null);
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
    const container = this.container.querySelector('#analysis-moves-container') as HTMLElement | null;
    if (!container) return;

    const variations = this.store.getVariations();
    if (liveState.history.length === 0 && variations.length === 0) {
      container.innerHTML = '<div class="analysis-moves-empty">Сделайте ход на доске для начала анализа</div>';
      return;
    }

    container.innerHTML = '';
    const tableEl = document.createElement('div');
    tableEl.className = 'analysis-moves-table';

    let tempState = this.store.getStateAtPly(-1);
    const activeVarId = this.store.getActiveVariationNodeId();

    // Render variations before move 1 (rootPly = -1)
    const rootVarBefore = variations.filter((v) => v.rootPly === -1);
    for (const v of rootVarBefore) {
      this.renderVariationRow(v, tableEl, activeVarId);
    }

    for (let i = 0; i < liveState.history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = liveState.history[i];
      const blackMove = liveState.history[i + 1];

      const whiteSan = whiteMove ? moveToSAN(tempState, whiteMove) : '';
      if (whiteMove) tempState = this.store.getStateAtPly(i);

      const blackSan = blackMove ? moveToSAN(tempState, blackMove) : '';
      if (blackMove) tempState = this.store.getStateAtPly(i + 1);

      const isMainWhiteActive = activeVarId === null && curPly === i;
      const isMainBlackActive = activeVarId === null && curPly === i + 1;

      const rowEl = document.createElement('div');
      rowEl.className = 'analysis-move-row';
      rowEl.innerHTML = `
        <span class="move-num">${moveNum}.</span>
        <span class="move-item ${isMainWhiteActive ? 'active' : ''}" data-ply="${i}">${whiteSan}</span>
        ${blackMove ? `<span class="move-item ${isMainBlackActive ? 'active' : ''}" data-ply="${i + 1}">${blackSan}</span>` : '<span class="move-item empty"></span>'}
      `;

      rowEl.querySelectorAll('.move-item[data-ply]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const ply = parseInt(el.getAttribute('data-ply') ?? '0', 10);
          this.store.setActiveVariationNode(null);
          this.store.setViewIndex(ply);
        });
      });

      tableEl.appendChild(rowEl);

      // Render variations after white move (rootPly === i)
      const varsAfterWhite = variations.filter((v) => v.rootPly === i);
      for (const v of varsAfterWhite) {
        this.renderVariationRow(v, tableEl, activeVarId);
      }

      // Render variations after black move (rootPly === i + 1)
      if (blackMove) {
        const varsAfterBlack = variations.filter((v) => v.rootPly === i + 1);
        for (const v of varsAfterBlack) {
          this.renderVariationRow(v, tableEl, activeVarId);
        }
      }
    }

    container.appendChild(tableEl);

    // Auto scroll active move strictly within moves container to prevent page/board layout shift
    const activeEl = container.querySelector('.move-item.active, .variation-move.active') as HTMLElement | null;
    if (activeEl) {
      const cRect = typeof container.getBoundingClientRect === 'function' ? container.getBoundingClientRect() : null;
      const aRect = typeof activeEl.getBoundingClientRect === 'function' ? activeEl.getBoundingClientRect() : null;
      if (cRect && aRect && cRect.height > 0) {
        const relativeTop = aRect.top - cRect.top + container.scrollTop;
        const targetScroll = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTop = Math.max(0, targetScroll);
      } else if (typeof activeEl.offsetTop === 'number' && typeof container.offsetTop === 'number') {
        const relativeTop = activeEl.offsetTop - container.offsetTop;
        const targetScroll = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTop = Math.max(0, targetScroll);
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  private renderVariationRow(rootNode: VariationNode, container: HTMLElement, activeVarId: string | null): void {
    const varRow = document.createElement('div');
    varRow.className = 'history-variation analysis-variation';

    const bracketOpen = document.createElement('span');
    bracketOpen.className = 'variation-bracket';
    bracketOpen.textContent = '(';
    varRow.appendChild(bracketOpen);

    const movesWrap = document.createElement('span');
    movesWrap.className = 'variation-moves-wrap';

    const renderSequence = (curr: VariationNode) => {
      const span = document.createElement('span');
      const isActive = activeVarId === curr.id;
      span.className = `variation-move${isActive ? ' active' : ''}`;
      span.dataset.variationId = curr.id;

      const moveNumber = Math.floor(curr.ply / 2) + 1;
      const isBlack = curr.ply % 2 === 1;
      let label = curr.san;
      if (curr.parentId === null) {
        label = isBlack ? `${moveNumber}... ${curr.san}` : `${moveNumber}. ${curr.san}`;
      } else {
        const parentNode = this.store.findVariationNode(curr.parentId);
        if (parentNode && !isBlack) {
          label = `${moveNumber}. ${curr.san}`;
        }
      }
      span.textContent = label;

      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.setActiveVariationNode(curr.id);
      });

      movesWrap.appendChild(span);

      if (curr.children.length === 1) {
        renderSequence(curr.children[0]);
      } else if (curr.children.length > 1) {
        renderSequence(curr.children[0]);
        for (let c = 1; c < curr.children.length; c++) {
          const subOpen = document.createElement('span');
          subOpen.className = 'variation-bracket';
          subOpen.textContent = '(';
          movesWrap.appendChild(subOpen);

          renderSequence(curr.children[c]);

          const subClose = document.createElement('span');
          subClose.className = 'variation-bracket';
          subClose.textContent = ')';
          movesWrap.appendChild(subClose);
        }
      }
    };

    renderSequence(rootNode);
    varRow.appendChild(movesWrap);

    const bracketClose = document.createElement('span');
    bracketClose.className = 'variation-bracket';
    bracketClose.textContent = ')';
    varRow.appendChild(bracketClose);

    container.appendChild(varRow);
  }

  private runLiveAnalysis(): void {
    if (this.isPaused) return;

    const currentState = this.store.getState();
    this.lastEvaluatedFen = serializeFEN(currentState);

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const legal = generateLegal(currentState);

    const numericEl = this.container.querySelector('#analysis-eval-numeric');
    const bestMoveEl = this.container.querySelector('#analysis-bestmove-info');
    const depthEl = this.container.querySelector('#analysis-engine-depth');
    const pvEl = this.container.querySelector('#analysis-pv-line');
    const engineNameEl = this.container.querySelector('#analysis-engine-name');
    const multipvContainer = this.container.querySelector('#analysis-multipv-lines') as HTMLElement | null;

    if (engineNameEl) {
      engineNameEl.textContent = this.engine.name || 'Stockfish 19 Lite WASM';
    }

    // Terminal positions check
    if (legal.length === 0) {
      if (this.store.isInCheck()) {
        const isWhiteMated = currentState.turn === 'white';
        const mateScore = { type: 'mate' as const, value: isWhiteMated ? -1 : 1 };
        this.boardUI.setExternalScore(mateScore);
        this.boardUI.setExternalArrow(null);
        this.currentBestMove = null;
        this.renderBestMoveArrow(null);
        if (numericEl) numericEl.textContent = isWhiteMated ? '0-1' : '1-0';
        if (bestMoveEl) bestMoveEl.textContent = `Мат! ${isWhiteMated ? 'Чёрные победили' : 'Белые победили'}`;
        if (depthEl) depthEl.textContent = 'depth=0';
        if (pvEl) pvEl.textContent = '';
        if (multipvContainer) {
          multipvContainer.innerHTML = `
            <div class="analysis-multipv-row terminal" data-line-index="1">
              <span class="eval-pill ${isWhiteMated ? 'score-black' : 'score-white'}">${isWhiteMated ? '0-1' : '1-0'}</span>
              <span class="multipv-pv-text">Мат! ${isWhiteMated ? 'Чёрные победили' : 'Белые победили'}</span>
            </div>
          `;
        }
      } else {
        const drawScore = { type: 'cp' as const, value: 0 };
        this.boardUI.setExternalScore(drawScore);
        this.boardUI.setExternalArrow(null);
        this.currentBestMove = null;
        this.renderBestMoveArrow(null);
        if (numericEl) numericEl.textContent = '½-½';
        if (bestMoveEl) bestMoveEl.textContent = 'Ничья (Пат)';
        if (depthEl) depthEl.textContent = 'depth=0';
        if (pvEl) pvEl.textContent = '';
        if (multipvContainer) {
          multipvContainer.innerHTML = `
            <div class="analysis-multipv-row terminal" data-line-index="1">
              <span class="eval-pill score-equal">½-½</span>
              <span class="multipv-pv-text">Ничья (Пат)</span>
            </div>
          `;
        }
      }
      return;
    }

    if (numericEl) numericEl.textContent = '...';
    if (bestMoveEl) bestMoveEl.textContent = 'Анализ...';
    if (depthEl) depthEl.textContent = 'depth=...';

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.engine
      .analyze(currentState, {
        depth: 18,
        multiPV: 3,
        signal,
        onUpdate: (partial: AnalysisEngineResult) => {
          if (signal.aborted) return;
          this.applyEngineResult(currentState, partial);
        },
      })
      .then((res: AnalysisEngineResult) => {
        if (signal.aborted) return;
        this.applyEngineResult(currentState, res);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
      });
  }

  private applyEngineResult(currentState: GameState, res: AnalysisEngineResult): void {
    if (this.isPaused) return;

    const numericEl = this.container.querySelector('#analysis-eval-numeric');
    const bestMoveEl = this.container.querySelector('#analysis-bestmove-info');
    const depthEl = this.container.querySelector('#analysis-engine-depth');
    const pvEl = this.container.querySelector('#analysis-pv-line');

    this.boardUI.setExternalScore(res.score);
    this.boardUI.setExternalArrow(null);
    this.currentBestMove = res.bestMove ?? null;
    this.renderBestMoveArrow(this.currentBestMove);

    if (depthEl) {
      depthEl.textContent = `depth=${res.depth}`;
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
        let san = res.lines[0]?.san;
        if (!san) {
          try {
            san = moveToSAN(currentState, res.bestMove);
          } catch {
            san = '';
          }
        }
        bestMoveEl.textContent = san ? `Лучший ход: ${san}` : 'Оценка рассчитана';
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

    const linesEl = this.container.querySelector('#analysis-multipv-lines') as HTMLElement | null;
    if (linesEl) {
      this.renderMultiPVLines(linesEl, currentState, res.lines);
    }
  }

  private renderMultiPVLines(container: HTMLElement, state: GameState, lines: AnalysisEngineResult['lines']): void {
    if (!lines || lines.length === 0) {
      container.innerHTML = '<div class="analysis-multipv-placeholder">Нет ходов для оценки</div>';
      return;
    }

    container.innerHTML = '';
    lines.slice(0, 3).forEach((line, idx) => {
      const row = document.createElement('div');
      row.className = 'analysis-multipv-row';
      row.dataset.lineIndex = (idx + 1).toString();

      let pillText = '0.00';
      let pillClass = 'score-equal';
      if (line.score.type === 'mate') {
        const val = line.score.value;
        pillText = val > 0 ? `M${Math.abs(val)}` : `-M${Math.abs(val)}`;
        pillClass = val > 0 ? 'score-white' : 'score-black';
      } else {
        const cp = line.score.value / 100;
        const sign = cp > 0 ? '+' : '';
        pillText = `${sign}${cp.toFixed(2)}`;
        pillClass = cp > 0.35 ? 'score-white' : cp < -0.35 ? 'score-black' : 'score-equal';
      }

      const pill = document.createElement('span');
      pill.className = `eval-pill ${pillClass}`;
      pill.textContent = pillText;
      row.appendChild(pill);

      const pvText = document.createElement('span');
      pvText.className = 'multipv-pv-text';
      pvText.textContent = this.formatPvString(state, line.pvSan);
      row.appendChild(pvText);

      row.addEventListener('click', () => {
        if (line.move) {
          this.store.makeMove(line.move.from, line.move.to, line.move.promotion);
        }
      });

      container.appendChild(row);
    });
  }

  private formatPvString(state: GameState, pvSan: string[]): string {
    if (!pvSan || pvSan.length === 0) return '';
    const startPly = state.history.length;
    const tokens: string[] = [];
    for (let i = 0; i < Math.min(pvSan.length, 7); i++) {
      const currentPly = startPly + i;
      const moveNum = Math.floor(currentPly / 2) + 1;
      const isWhite = currentPly % 2 === 0;
      if (isWhite) {
        tokens.push(`${moveNum}. ${pvSan[i]}`);
      } else {
        if (i === 0) {
          tokens.push(`${moveNum}... ${pvSan[i]}`);
        } else {
          tokens.push(pvSan[i]);
        }
      }
    }
    return tokens.join(' ');
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
      positionCounts: new Map(),
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
    const key = positionKey(finalState);
    finalState.positionHistory = [key];
    finalState.positionCounts = new Map([[key, 1]]);

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
    this.currentBestMove = null;
    this.renderBestMoveArrow(null);
    this.boardUI.clearExternalAnalysis();
    this.container.innerHTML = '';
  }

  private renderBestMoveArrow(move: Move | null): void {
    const arrowLayer = this.container.querySelector('.board-arrow-layer') as SVGElement | null;
    if (!arrowLayer) return;

    if (!move || typeof move.from !== 'number' || typeof move.to !== 'number') {
      arrowLayer.innerHTML = '';
      return;
    }

    const flipped = this.store.isFlipped();
    const { width, height } = this.store.getState().board;

    const sqW = 800 / width;
    const sqH = 800 / height;

    const fromX = move.from % width;
    const fromY = Math.floor(move.from / width);
    const toX = move.to % width;
    const toY = Math.floor(move.to / width);

    const fromCol = flipped ? width - 1 - fromX : fromX;
    const fromRow = flipped ? height - 1 - fromY : fromY;
    const toCol = flipped ? width - 1 - toX : toX;
    const toRow = flipped ? height - 1 - toY : toY;

    const x1 = fromCol * sqW + sqW / 2;
    const y1 = fromRow * sqH + sqH / 2;
    const targetCenterX = toCol * sqW + sqW / 2;
    const targetCenterY = toRow * sqH + sqH / 2;

    const dx = targetCenterX - x1;
    const dy = targetCenterY - y1;
    const angle = Math.atan2(dy, dx);
    const offset = 8; // 6-8px offset from target square center so the arrowhead points to piece edge

    const x2 = Number((targetCenterX - Math.cos(angle) * offset).toFixed(1));
    const y2 = Number((targetCenterY - Math.sin(angle) * offset).toFixed(1));

    arrowLayer.innerHTML = `
      <defs>
        <marker id="analysis-best-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="var(--class-best, #22c55e)" />
        </marker>
      </defs>
      <line class="analysis-best-move-arrow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
            stroke="var(--class-best, #22c55e)" stroke-width="8" stroke-linecap="round"
            marker-end="url(#analysis-best-arrowhead)" />
    `;
  }
}

export function mountAnalysisBoard(container: HTMLElement, options: AnalysisBoardOptions = {}): AnalysisBoardUI {
  return new AnalysisBoardUI(container, options);
}
