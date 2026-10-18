import './ui/styles.css';
import { APP_NAME } from './config';
import { t } from './i18n';
import { HashRouter, type AppRoute } from './router';
import { globalStore, type GameMode, type PlayerColorChoice } from './state/store';
import { ChessBoardUI } from './ui/board';
import { HistoryUI } from './ui/history';
import { ImportExportUI } from './ui/importexport';
import { ClockWidget } from './ui/clockwidget';
import { ReviewPanelUI } from './ui/reviewpanel';
import { GameOverModalUI } from './ui/gameovermodal';
import { LEVELS, LEVEL_ORDER, type LevelId } from './ai';
import { getPieceSvg } from './ui/pieces';

const MOON_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
`;

const SUN_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
`;

let currentRouter: HashRouter | null = null;

export function getRouter(): HashRouter | null {
  return currentRouter;
}

export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  document.title = APP_NAME;
  globalStore.loadSettingsFromStorage();

  const levelOptionsHtml = LEVEL_ORDER.map(
    (id) => `<option value="${id}">${LEVELS[id].name}</option>`,
  ).join('');

  app.innerHTML = `
    <!-- Fixed Theme Toggle in top-right corner of viewport -->
    <button class="theme-toggle-btn" id="theme-btn" aria-label="${t('common.themeToggleDark')}" title="${t('common.themeToggleDark')}">
      ${MOON_ICON}
    </button>

    <!-- Screen 1: Home -->
    <div class="screen screen-home" id="screen-home">
      <!-- Solar Chess background -->
      <div class="solar-background" aria-hidden="true" style="pointer-events: none;">
        <svg class="solar-stars" viewBox="0 0 800 500" preserveAspectRatio="none">
          <circle cx="75" cy="45" r="1.5" class="solar-star star-1" />
          <circle cx="160" cy="110" r="1" class="solar-star star-2" />
          <circle cx="280" cy="60" r="2" class="solar-star star-3" />
          <circle cx="390" cy="120" r="1.2" class="solar-star star-1" />
          <circle cx="510" cy="40" r="1.8" class="solar-star star-2" />
          <circle cx="630" cy="95" r="1.2" class="solar-star star-3" />
          <circle cx="720" cy="50" r="1.5" class="solar-star star-1" />
          <circle cx="120" cy="180" r="1.3" class="solar-star star-3" />
          <circle cx="670" cy="170" r="1.4" class="solar-star star-2" />
          <circle cx="230" cy="220" r="1" class="solar-star star-1" />
          <circle cx="580" cy="210" r="1.6" class="solar-star star-3" />
        </svg>

        <div class="solar-sun"></div>

        <div class="solar-orbits">
          <div class="solar-orbit solar-orbit-1">
            <div class="solar-piece-wrapper">
              <div class="solar-piece-counter">
                ${getPieceSvg('pawn', 'white')}
              </div>
            </div>
          </div>
          <div class="solar-orbit solar-orbit-2">
            <div class="solar-piece-wrapper">
              <div class="solar-piece-counter">
                ${getPieceSvg('knight', 'white')}
              </div>
            </div>
          </div>
          <div class="solar-orbit solar-orbit-3">
            <div class="solar-piece-wrapper">
              <div class="solar-piece-counter">
                ${getPieceSvg('bishop', 'white')}
              </div>
            </div>
          </div>
          <div class="solar-orbit solar-orbit-4">
            <div class="solar-piece-wrapper">
              <div class="solar-piece-counter">
                ${getPieceSvg('rook', 'white')}
              </div>
            </div>
          </div>
        </div>

        <div class="solar-surface">
          <div class="solar-surface-grid"></div>
        </div>
      </div>

      <div class="home-hero">
        <div class="home-title-wrapper">
          <div class="home-title-queen" aria-hidden="true">${getPieceSvg('queen', 'white')}</div>
          <h1 class="home-title" id="home-app-title">${APP_NAME}</h1>
        </div>
        <div class="home-menu">
          <button class="btn-menu" id="btn-play-local">${t('menu.playLocal')}</button>
          <button class="btn-menu" id="btn-play-bot">${t('menu.playBot')}</button>
          <button class="btn-menu" id="btn-play-online">${t('menu.playOnline')}</button>
          <button class="btn-menu" id="btn-play-variants">${t('menu.playVariants')}</button>
          <button class="btn-menu" id="btn-analysis">${t('menu.analysis')}</button>
        </div>
        <div class="home-toast" id="home-toast" style="display: none;"></div>
      </div>
    </div>

    <!-- Screen 2: Game -->
    <div class="screen screen-game" id="screen-game" style="display: none;">
      <header class="chess-header">
        <button class="btn-back-to-main" id="btn-back-to-main">${t('header.backToMain')}</button>
        <div class="chess-title">
          <span id="game-app-title">${APP_NAME}</span>
        </div>
      </header>

      <div class="game-setup-panel" id="game-setup-panel">
        <div class="setup-field">
          <label for="game-mode-select">Режим:</label>
          <select id="game-mode-select" class="clock-select">
            <option value="pvp">Двое на одном экране</option>
            <option value="ai">Против компьютера</option>
          </select>
        </div>
        <div class="setup-field" id="ai-level-field">
          <label for="ai-level-select">Уровень:</label>
          <select id="ai-level-select" class="clock-select">
            ${levelOptionsHtml}
          </select>
        </div>
        <div class="setup-field" id="player-color-field">
          <label for="player-color-select">Цвет:</label>
          <select id="player-color-select" class="clock-select">
            <option value="white">Белые</option>
            <option value="black">Чёрные</option>
            <option value="random">Случайно</option>
          </select>
        </div>
      </div>

      <div class="status-bar">
        <div class="status-text" id="status-text">Ход белых</div>
        <div id="status-badge-container"></div>
      </div>

      <div id="clock-mount"></div>
      <div id="board-mount"></div>
      <div id="history-mount"></div>
      <div id="review-mount"></div>
      <div id="io-mount"></div>

      <div class="controls-bar">
        <button class="btn-action" id="btn-new-game">Новая партия</button>
        <button class="btn-action" id="btn-undo">Отменить ход</button>
        <button class="btn-action" id="btn-flip">Перевернуть</button>
        <button class="btn-action" id="btn-show-summary" style="display: none;">Показать итог</button>
      </div>
    </div>

    <!-- Screen 3: Analysis Stub -->
    <div class="screen screen-analysis" id="screen-analysis" style="display: none;">
      <header class="chess-header">
        <button class="btn-back-to-main" id="btn-analysis-back-to-main">${t('header.backToMain')}</button>
        <div class="chess-title">
          <span>${t('menu.analysis')}</span>
        </div>
      </header>
      <div class="analysis-stub-body">
        <h2>${t('menu.analysis')}</h2>
        <p class="stub-badge">${t('common.soon')}</p>
      </div>
    </div>
  `;

  // Setup router
  if (currentRouter) {
    currentRouter.destroy();
    currentRouter = null;
  }

  currentRouter = new HashRouter((route: AppRoute) => {
    const homeScreen = document.getElementById('screen-home');
    const gameScreen = document.getElementById('screen-game');
    const analysisScreen = document.getElementById('screen-analysis');

    if (homeScreen) {
      homeScreen.style.display = route === 'home' ? 'flex' : 'none';
      homeScreen.classList.toggle('active', route === 'home');
    }
    if (gameScreen) {
      gameScreen.style.display = route === 'game' ? 'flex' : 'none';
      gameScreen.classList.toggle('active', route === 'game');
    }
    if (analysisScreen) {
      analysisScreen.style.display = route === 'analysis' ? 'flex' : 'none';
      analysisScreen.classList.toggle('active', route === 'analysis');
    }
  });
  currentRouter.init();

  const modeSelect = document.getElementById('game-mode-select') as HTMLSelectElement;
  const levelSelect = document.getElementById('ai-level-select') as HTMLSelectElement;
  const colorSelect = document.getElementById('player-color-select') as HTMLSelectElement;
  const aiLevelField = document.getElementById('ai-level-field') as HTMLElement;
  const playerColorField = document.getElementById('player-color-field') as HTMLElement;

  modeSelect.value = globalStore.getGameMode();
  levelSelect.value = globalStore.getAILevel();
  colorSelect.value = globalStore.getPlayerColorChoice();

  const syncSetupVisibility = (): void => {
    const isAI = modeSelect.value === 'ai';
    aiLevelField.style.display = isAI ? 'flex' : 'none';
    playerColorField.style.display = isAI ? 'flex' : 'none';
  };
  syncSetupVisibility();

  const applySetupAndStartNewGame = (): void => {
    syncSetupVisibility();
    globalStore.newGame(undefined, {
      mode: modeSelect.value as GameMode,
      level: levelSelect.value as LevelId,
      playerColor: colorSelect.value as PlayerColorChoice,
    });
  };

  modeSelect.addEventListener('change', applySetupAndStartNewGame);
  levelSelect.addEventListener('change', applySetupAndStartNewGame);
  colorSelect.addEventListener('change', applySetupAndStartNewGame);

  // Home screen menu actions
  document.getElementById('btn-play-local')?.addEventListener('click', () => {
    modeSelect.value = 'pvp';
    applySetupAndStartNewGame();
    currentRouter?.navigate('game');
  });

  document.getElementById('btn-play-bot')?.addEventListener('click', () => {
    modeSelect.value = 'ai';
    applySetupAndStartNewGame();
    currentRouter?.navigate('game');
  });

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const showToast = (message: string): void => {
    const toast = document.getElementById('home-toast') as HTMLElement | null;
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  };

  document.getElementById('btn-play-online')?.addEventListener('click', () => {
    showToast(t('common.soon'));
  });
  document.getElementById('btn-play-variants')?.addEventListener('click', () => {
    showToast(t('common.soon'));
  });
  document.getElementById('btn-analysis')?.addEventListener('click', () => {
    showToast(t('common.soon'));
  });

  // Back to main actions
  const handleBackToMain = (): void => {
    const isOngoing =
      globalStore.getGameResult().type === 'ongoing' &&
      globalStore.getLiveState().history.length > 0 &&
      globalStore.getTimedOutLoser() === null;

    if (isOngoing) {
      const ok = window.confirm(t('game.leaveConfirm'));
      if (!ok) return;
    }
    currentRouter?.navigate('home');
  };

  document.getElementById('btn-back-to-main')?.addEventListener('click', handleBackToMain);
  document.getElementById('btn-analysis-back-to-main')?.addEventListener('click', () => {
    currentRouter?.navigate('home');
  });

  const clockMount = document.getElementById('clock-mount') as HTMLElement;
  new ClockWidget(clockMount, globalStore, (loser) => {
    const statusText = document.getElementById('status-text') as HTMLElement;
    const badgeContainer = document.getElementById('status-badge-container') as HTMLElement;
    const winner = loser === 'white' ? 'Чёрные победили' : 'Белые победили';
    statusText.textContent = `Время истекло! ${winner} по времени.`;
    badgeContainer.innerHTML = '<span class="status-badge badge-over">Время истекло</span>';
  });

  const boardMount = document.getElementById('board-mount') as HTMLElement;
  new ChessBoardUI(boardMount, globalStore);

  const historyMount = document.getElementById('history-mount') as HTMLElement;
  new HistoryUI(historyMount, globalStore);

  const reviewMount = document.getElementById('review-mount') as HTMLElement;
  new ReviewPanelUI(reviewMount, globalStore);

  const ioMount = document.getElementById('io-mount') as HTMLElement;
  new ImportExportUI(ioMount, globalStore);

  const modalMount = document.createElement('div');
  modalMount.id = 'game-over-modal-mount';
  document.body.appendChild(modalMount);
  const gameOverModal = new GameOverModalUI(modalMount, globalStore, {
    onStartReview: () => {
      (document.getElementById('btn-start-review') as HTMLButtonElement | null)?.click();
    },
    onNewGame: () => {
      applySetupAndStartNewGame();
    },
  });

  const showSummaryBtn = document.getElementById('btn-show-summary') as HTMLButtonElement | null;
  showSummaryBtn?.addEventListener('click', () => {
    gameOverModal.show();
  });

  const statusText = document.getElementById('status-text') as HTMLElement;
  const badgeContainer = document.getElementById('status-badge-container') as HTMLElement;
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;

  globalStore.subscribe((state, store) => {
    const result = store.getGameResult();
    const inCheck = store.isInCheck();
    const isWhite = state.turn === 'white';
    const isViewing = store.isViewingHistory();
    const isReview = store.isReviewMode();
    const timedOutLoser = store.getTimedOutLoser();
    const lastError = store.getLastError();

    undoBtn.disabled = (state.history.length === 0 && !store.isAIThinking()) || isViewing || isReview || store.isReviewInProgress();

    if (showSummaryBtn) {
      const isEnded = store.isGameOver();
      const canShowSummary = isEnded && !isViewing && !isReview && !store.isReviewInProgress() && !gameOverModal.isOpen();
      showSummaryBtn.style.display = canShowSummary ? 'inline-flex' : 'none';
    }

    if (isReview) {
      statusText.textContent = 'Разбор партии';
      badgeContainer.innerHTML = '<span class="status-badge badge-turn-white">Разбор</span>';
      return;
    }

    if (lastError && lastError.startsWith('Ошибка ИИ:')) {
      statusText.textContent = lastError;
      badgeContainer.innerHTML = '<span class="status-badge badge-check">Ошибка</span>';
      return;
    }

    if (timedOutLoser !== null) {
      const winner = timedOutLoser === 'white' ? 'Чёрные победили' : 'Белые победили';
      statusText.textContent = `Время истекло! ${winner} по времени.`;
      badgeContainer.innerHTML = '<span class="status-badge badge-over">Время истекло</span>';
      return;
    }

    let text = isWhite ? 'Ход белых' : 'Ход чёрных';
    if (isViewing) {
      text = `Просмотр истории (ход ${(store.getViewIndex() ?? 0) + 1})`;
    }
    let badgeHtml = isWhite
      ? '<span class="status-badge badge-turn-white">Белые</span>'
      : '<span class="status-badge badge-turn-black">Чёрные</span>';

    if (result.type === 'checkmate') {
      const winner = result.winner === 'white' ? 'Белые победили!' : 'Чёрные победили!';
      text = `Мат! ${winner}`;
      badgeHtml = '<span class="status-badge badge-over">Мат</span>';
    } else if (result.type === 'stalemate') {
      text = 'Ничья! Пат.';
      badgeHtml = '<span class="status-badge badge-over">Пат</span>';
    } else if (result.type === 'threefoldRepetition') {
      text = 'Ничья! Троекратное повторение позиции.';
      badgeHtml = '<span class="status-badge badge-over">Ничья</span>';
    } else if (result.type === 'fiftyMoveRule') {
      text = 'Ничья! Правило 50 ходов.';
      badgeHtml = '<span class="status-badge badge-over">Ничья</span>';
    } else if (result.type === 'insufficientMaterial') {
      text = 'Ничья! Недостаточно материала для мата.';
      badgeHtml = '<span class="status-badge badge-over">Ничья</span>';
    } else if (store.isAIThinking() && !isViewing) {
      text = 'Компьютер думает…';
      badgeHtml = '<span class="status-badge badge-thinking">Компьютер думает…</span>';
    } else if (inCheck && !isViewing) {
      text = `${isWhite ? 'Белый' : 'Чёрный'} король под шахом!`;
      badgeHtml += ' <span class="status-badge badge-check">Шах</span>';
    }

    statusText.textContent = text;
    badgeContainer.innerHTML = badgeHtml;
  });

  if (globalStore.getGameMode() === 'ai') {
    globalStore.newGame();
  }

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    applySetupAndStartNewGame();
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    globalStore.undo();
  });

  document.getElementById('btn-flip')?.addEventListener('click', () => {
    globalStore.toggleFlip();
  });

  let isDark = !document.documentElement.getAttribute('data-theme');
  const updateThemeUI = (): void => {
    const themeBtn = document.getElementById('theme-btn');
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      if (themeBtn) {
        themeBtn.innerHTML = MOON_ICON;
        themeBtn.setAttribute('title', t('common.themeToggleDark'));
        themeBtn.setAttribute('aria-label', t('common.themeToggleDark'));
      }
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeBtn) {
        themeBtn.innerHTML = SUN_ICON;
        themeBtn.setAttribute('title', t('common.themeToggleLight'));
        themeBtn.setAttribute('aria-label', t('common.themeToggleLight'));
      }
    }
  };
  updateThemeUI();

  const toggleTheme = (): void => {
    isDark = !isDark;
    updateThemeUI();
  };

  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
}

window.addEventListener('DOMContentLoaded', initApp);
