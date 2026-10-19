import './ui/styles.css';
import { APP_NAME } from './config';
import { t } from './i18n';
import { HashRouter, type AppRoute } from './router';
import { globalStore, type ChessStore } from './state/store';
import { ChessBoardUI } from './ui/board';
import { HistoryUI } from './ui/history';
import { ReviewPanelUI } from './ui/reviewpanel';
import { GameOverModalUI } from './ui/gameovermodal';
import { GameSetupModalUI } from './ui/setupmodals';
import { LEVELS } from './ai';
import { getPieceSvg } from './ui/pieces';
import type { Color } from './core';

function formatClockMs(ms: number): { text: string; isLow: boolean } {
  if (ms <= 0) return { text: '00:00.0', isLow: true };
  const isLow = ms < 10000;
  const totalSec = ms / 1000;
  if (isLow) {
    const sec = Math.floor(totalSec);
    const tenths = Math.floor((ms % 1000) / 100);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return {
      text: `${min > 0 ? min + ':' : ''}${s.toString().padStart(2, '0')}.${tenths}`,
      isLow: true,
    };
  }
  const totalSecCeil = Math.ceil(totalSec);
  const min = Math.floor(totalSecCeil / 60);
  const sec = totalSecCeil % 60;
  return {
    text: `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
    isLow: false,
  };
}

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

const FLIP_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>
`;

let currentRouter: HashRouter | null = null;
let clockIntervalId: ReturnType<typeof setInterval> | null = null;
let keydownCleanup: (() => void) | null = null;

export function getRouter(): HashRouter | null {
  return currentRouter;
}

function getSideLabel(store: ChessStore, sideColor: Color): string {
  if (store.getGameMode() === 'ai') {
    const playerColor = store.getPlayerColor();
    if (sideColor === playerColor) {
      return 'Вы';
    }
    const levelName = LEVELS[store.getAILevel()]?.name ?? 'Бот';
    return `Компьютер: ${levelName}`;
  }
  return sideColor === 'white' ? 'Белые' : 'Чёрные';
}

export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (clockIntervalId !== null) {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
  }
  if (keydownCleanup) {
    keydownCleanup();
    keydownCleanup = null;
  }

  // Remove old modals mounted on document.body on re-init
  document.getElementById('setup-modal-mount')?.remove();
  document.getElementById('game-over-modal-mount')?.remove();

  document.title = APP_NAME;
  globalStore.loadSettingsFromStorage();

  app.innerHTML = `
    <!-- Fixed Theme Toggle in top-right corner of viewport -->
    <button class="theme-toggle-btn" id="theme-btn" aria-label="${t('common.themeToggleDark')}" title="${t('common.themeToggleDark')}">
      ${MOON_ICON}
    </button>

    <!-- Fullscreen Solar Chess background -->
    <div class="solar-background active" id="solar-bg" aria-hidden="true" style="pointer-events: none;">
      <!-- Vignette overlay -->
      <div class="solar-vignette" aria-hidden="true"></div>

      <!-- Twinkling stars -->
      <svg class="solar-stars" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="75" cy="45" r="1.5" class="solar-star star-1" />
        <circle cx="160" cy="110" r="1" class="solar-star star-2" />
        <circle cx="280" cy="60" r="2" class="solar-star star-3 star-extra" />
        <circle cx="390" cy="120" r="1.2" class="solar-star star-1" />
        <circle cx="510" cy="40" r="1.8" class="solar-star star-2 star-extra" />
        <circle cx="630" cy="95" r="1.2" class="solar-star star-3" />
        <circle cx="720" cy="50" r="1.5" class="solar-star star-1 star-extra" />
        <circle cx="850" cy="70" r="1.3" class="solar-star star-2" />
        <circle cx="920" cy="130" r="1.6" class="solar-star star-3 star-extra" />
        <circle cx="80" cy="220" r="1.4" class="solar-star star-1 star-extra" />
        <circle cx="120" cy="180" r="1.3" class="solar-star star-3" />
        <circle cx="670" cy="170" r="1.4" class="solar-star star-2" />
        <circle cx="820" cy="240" r="1.2" class="solar-star star-1" />
        <circle cx="230" cy="280" r="1" class="solar-star star-1 star-extra" />
        <circle cx="580" cy="260" r="1.6" class="solar-star star-3" />
        <circle cx="910" cy="320" r="1.5" class="solar-star star-2 star-extra" />
        <circle cx="150" cy="380" r="1.2" class="solar-star star-3" />
        <circle cx="790" cy="390" r="1.4" class="solar-star star-1 star-extra" />
        <circle cx="350" cy="420" r="1.1" class="solar-star star-2" />
        <circle cx="620" cy="450" r="1.3" class="solar-star star-3 star-extra" />
      </svg>

      <!-- The Sun -->
      <div class="solar-sun" aria-hidden="true"></div>

      <!-- Orbits & piece silhouettes -->
      <div class="solar-orbits" aria-hidden="true">
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

      <!-- Chessboard surface at bottom with perspective -->
      <div class="solar-surface" aria-hidden="true">
        <div class="solar-surface-grid"></div>
      </div>
    </div>

    <!-- Screen 1: Home -->
    <div class="screen screen-home" id="screen-home">
      <div class="home-title-wrapper" id="home-title-wrapper">
        <div class="home-title-queen" aria-hidden="true">${getPieceSvg('queen', 'white')}</div>
        <h1 class="home-title" id="home-app-title">${APP_NAME}</h1>
      </div>
      <div class="home-hero">
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
      <!-- Subtle solar decor layer behind side panel -->
      <div class="game-solar-decor" aria-hidden="true" style="pointer-events: none;">
        <svg width="460" height="460" viewBox="0 0 460 460" fill="none" aria-hidden="true">
          <ellipse cx="460" cy="0" rx="380" ry="240" class="solar-modal-orbit" />
          <ellipse cx="460" cy="0" rx="260" ry="160" class="solar-modal-orbit" />
          <circle cx="280" cy="80" r="1.5" class="solar-modal-star" />
          <circle cx="340" cy="180" r="1" class="solar-modal-star" />
          <circle cx="200" cy="140" r="1.5" class="solar-modal-star" />
        </svg>
      </div>

      <header class="game-topbar">
        <button class="btn-back-to-main" id="btn-back-to-main" aria-label="На главный">← На главный</button>
      </header>

      <div class="game-layout" id="game-layout">
        <!-- Left column: Top player bar, Board, Bottom player bar -->
        <div class="game-board-col" id="game-board-col">
          <div class="player-bar player-bar-top" id="player-bar-top" data-side="black">
            <div class="player-info">
              <span class="player-color-indicator black" id="player-indicator-top"></span>
              <span class="player-name" id="player-name-top">Чёрные</span>
            </div>
            <div class="player-clock clock-time" id="player-clock-top" style="display: none;">10:00</div>
          </div>

          <div id="board-mount" class="game-board-mount"></div>

          <div class="player-bar player-bar-bottom" id="player-bar-bottom" data-side="white">
            <div class="player-info">
              <span class="player-color-indicator white" id="player-indicator-bottom"></span>
              <span class="player-name" id="player-name-bottom">Белые</span>
            </div>
            <div class="player-clock clock-time" id="player-clock-bottom" style="display: none;">10:00</div>
          </div>
        </div>

        <!-- Right column: Side panel -->
        <aside class="game-side-panel" id="game-side-panel">
          <div class="side-panel-header">
            <div class="status-info">
              <svg class="orbit-mini-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <ellipse cx="8" cy="8" rx="6.5" ry="3.5" stroke="currentColor" stroke-dasharray="2,2" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              </svg>
              <div class="status-text" id="status-text">Ход белых</div>
              <div id="status-badge-container"></div>
            </div>
            <button class="btn-icon-flip" id="btn-flip" title="Перевернуть доску (F)" aria-label="Перевернуть доску">
              ${FLIP_ICON}
            </button>
          </div>

          <div id="history-mount" class="game-history-mount"></div>

          <div class="side-panel-actions">
            <button class="btn-action" id="btn-undo">Отменить ход</button>
            <button class="btn-action btn-danger" id="btn-resign">Сдаться</button>
            <button class="btn-action" id="btn-show-summary" style="display: none;">Показать итог</button>
          </div>
        </aside>
      </div>

      <!-- Temporary Review Overlay (Stage A2b) -->
      <div class="review-overlay" id="review-overlay" style="display: none;" role="dialog" aria-modal="true" aria-label="Разбор партии">
        <div class="review-overlay-header">
          <h2 class="review-overlay-title">Разбор партии</h2>
          <button class="review-overlay-close" id="btn-close-review-overlay" aria-label="Закрыть разбор">✕</button>
        </div>
        <div class="review-overlay-body">
          <div class="review-overlay-board-col" id="review-overlay-board-slot"></div>
          <div class="review-overlay-side-col">
            <div id="review-overlay-history-slot" class="review-overlay-history-slot"></div>
            <div id="review-mount" class="review-overlay-panel-slot"></div>
          </div>
        </div>
      </div>

      <!-- Resign Modal Dialog (Stage A2) -->
      <div class="resign-modal-overlay" id="resign-modal-overlay" style="display: none;">
        <div class="resign-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="resign-modal-title">
          <h3 class="resign-modal-title" id="resign-modal-title">Сдаться</h3>
          <p class="resign-modal-text" id="resign-modal-text"></p>
          <div class="resign-modal-actions" id="resign-modal-actions"></div>
        </div>
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
    // Redirect to home if opening game screen without an active game
    if (route === 'game' && !globalStore.isGameActive()) {
      currentRouter?.navigate('home');
      return;
    }

    const homeScreen = document.getElementById('screen-home');
    const gameScreen = document.getElementById('screen-game');
    const analysisScreen = document.getElementById('screen-analysis');
    const solarBg = document.getElementById('solar-bg');

    const isHome = route === 'home';
    document.body.classList.toggle('home-active', isHome);
    document.body.classList.toggle('game-active', route === 'game');

    if (homeScreen) {
      homeScreen.style.display = isHome ? 'flex' : 'none';
      homeScreen.classList.toggle('active', isHome);
    }
    if (solarBg) {
      solarBg.style.display = isHome ? 'block' : 'none';
      solarBg.classList.toggle('active', isHome);
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

  // Setup modal for local and bot games
  const setupModalMount = document.createElement('div');
  setupModalMount.id = 'setup-modal-mount';
  document.body.appendChild(setupModalMount);

  const setupModal = new GameSetupModalUI(setupModalMount, (params) => {
    globalStore.setClockMode(params.timeControl);
    globalStore.newGame(undefined, {
      mode: params.mode,
      level: params.level,
      playerColor: params.playerColor,
    });
    currentRouter?.navigate('game');
  });

  // Home screen menu actions
  const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement | null;
  playLocalBtn?.addEventListener('click', () => {
    setupModal.open('local', playLocalBtn);
  });

  const playBotBtn = document.getElementById('btn-play-bot') as HTMLButtonElement | null;
  playBotBtn?.addEventListener('click', () => {
    setupModal.open('bot', playBotBtn);
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

  // Mount Board, History, and Review Panel
  const boardMount = document.getElementById('board-mount') as HTMLElement;
  new ChessBoardUI(boardMount, globalStore);

  const historyMount = document.getElementById('history-mount') as HTMLElement;
  new HistoryUI(historyMount, globalStore);

  const reviewMount = document.getElementById('review-mount') as HTMLElement;
  const reviewPanel = new ReviewPanelUI(reviewMount, globalStore);

  // Review Overlay open/close logic
  const reviewOverlay = document.getElementById('review-overlay') as HTMLElement;
  const reviewBoardSlot = document.getElementById('review-overlay-board-slot') as HTMLElement;
  const reviewHistorySlot = document.getElementById('review-overlay-history-slot') as HTMLElement;
  const gameBoardCol = document.getElementById('game-board-col') as HTMLElement;
  const playerBarBottom = document.getElementById('player-bar-bottom') as HTMLElement;
  const gameSidePanel = document.getElementById('game-side-panel') as HTMLElement;
  const sidePanelActions = gameSidePanel.querySelector('.side-panel-actions') as HTMLElement;
  let isReviewOverlayOpen = false;

  const openReviewOverlay = (): void => {
    if (isReviewOverlayOpen) return;
    isReviewOverlayOpen = true;
    reviewBoardSlot.appendChild(boardMount);
    reviewHistorySlot.appendChild(historyMount);
    reviewOverlay.style.display = 'flex';
    void reviewPanel.startReview();
  };

  const closeReviewOverlay = (returnToSummary = true): void => {
    if (!isReviewOverlayOpen) return;
    isReviewOverlayOpen = false;
    globalStore.setReviewMode(false);
    gameBoardCol.insertBefore(boardMount, playerBarBottom);
    gameSidePanel.insertBefore(historyMount, sidePanelActions);
    reviewOverlay.style.display = 'none';
    if (returnToSummary && globalStore.isGameOver()) {
      gameOverModal.show();
    }
  };

  document.getElementById('btn-close-review-overlay')?.addEventListener('click', () => {
    closeReviewOverlay(true);
  });

  // Back to main actions
  const handleBackToMain = (): void => {
    const isOngoing =
      globalStore.getGameResult().type === 'ongoing' &&
      globalStore.getLiveState().history.length > 0 &&
      globalStore.getTimedOutLoser() === null &&
      globalStore.getResignedPlayer() === null;

    if (isOngoing) {
      const ok = window.confirm(t('game.leaveConfirm'));
      if (!ok) return;
    }
    globalStore.cancelReview();
    if (isReviewOverlayOpen) {
      closeReviewOverlay(false);
    }
    gameOverModal.hide(true);
    globalStore.setActiveGame(false);
    currentRouter?.navigate('home');
  };

  document.getElementById('btn-back-to-main')?.addEventListener('click', handleBackToMain);
  document.getElementById('btn-analysis-back-to-main')?.addEventListener('click', () => {
    currentRouter?.navigate('home');
  });

  // Post-Game Summary Modal
  const modalMount = document.createElement('div');
  modalMount.id = 'game-over-modal-mount';
  document.body.appendChild(modalMount);
  const gameOverModal = new GameOverModalUI(modalMount, globalStore, {
    onStartReview: () => {
      openReviewOverlay();
    },
    onNewGame: () => {
      globalStore.cancelReview();
      if (isReviewOverlayOpen) {
        closeReviewOverlay(false);
      }
      globalStore.setActiveGame(false);
      currentRouter?.navigate('home');
    },
  });

  const showSummaryBtn = document.getElementById('btn-show-summary') as HTMLButtonElement | null;
  showSummaryBtn?.addEventListener('click', () => {
    gameOverModal.show();
  });

  // Player bars & Clocks rendering
  const playerBarTop = document.getElementById('player-bar-top') as HTMLElement;
  const playerIndicatorTop = document.getElementById('player-indicator-top') as HTMLElement;
  const playerNameTop = document.getElementById('player-name-top') as HTMLElement;
  const playerClockTop = document.getElementById('player-clock-top') as HTMLElement;

  const playerIndicatorBottom = document.getElementById('player-indicator-bottom') as HTMLElement;
  const playerNameBottom = document.getElementById('player-name-bottom') as HTMLElement;
  const playerClockBottom = document.getElementById('player-clock-bottom') as HTMLElement;

  const updatePlayerBars = (): void => {
    const flipped = globalStore.isFlipped();
    const topColor: Color = flipped ? 'white' : 'black';
    const bottomColor: Color = flipped ? 'black' : 'white';

    playerBarTop.dataset.side = topColor;
    playerBarBottom.dataset.side = bottomColor;

    playerIndicatorTop.className = `player-color-indicator ${topColor}`;
    playerIndicatorBottom.className = `player-color-indicator ${bottomColor}`;

    playerNameTop.textContent = getSideLabel(globalStore, topColor);
    playerNameBottom.textContent = getSideLabel(globalStore, bottomColor);

    const turn = globalStore.getLiveState().turn;
    const isGameOver = globalStore.isGameOver();
    const isTurnTop = turn === topColor && !isGameOver;
    const isTurnBottom = turn === bottomColor && !isGameOver;

    playerBarTop.classList.toggle('active-turn', isTurnTop);
    playerBarTop.classList.toggle('active-player-bar', isTurnTop);
    playerBarBottom.classList.toggle('active-turn', isTurnBottom);
    playerBarBottom.classList.toggle('active-player-bar', isTurnBottom);

    const clockMode = globalStore.getClockMode();
    if (clockMode === 'none') {
      playerClockTop.style.display = 'none';
      playerClockBottom.style.display = 'none';
    } else {
      playerClockTop.style.display = 'inline-flex';
      playerClockBottom.style.display = 'inline-flex';

      const wMs = globalStore.getTime('white');
      const bMs = globalStore.getTime('black');
      const topMs = topColor === 'white' ? wMs : bMs;
      const bottomMs = bottomColor === 'white' ? wMs : bMs;

      const topRes = formatClockMs(topMs);
      const bottomRes = formatClockMs(bottomMs);

      playerClockTop.textContent = topRes.text;
      playerClockBottom.textContent = bottomRes.text;

      const isActiveClock = globalStore.isClockActive() && !globalStore.isGameOver();

      playerClockTop.classList.toggle('low-time', topRes.isLow);
      playerClockBottom.classList.toggle('low-time', bottomRes.isLow);
      playerClockTop.classList.toggle('active-clock', isActiveClock && turn === topColor);
      playerClockBottom.classList.toggle('active-clock', isActiveClock && turn === bottomColor);
    }
  };

  clockIntervalId = setInterval(() => {
    if (globalStore.isClockActive()) {
      globalStore.tickClock();
      updatePlayerBars();
    }
  }, 100);

  const statusText = document.getElementById('status-text') as HTMLElement;
  const badgeContainer = document.getElementById('status-badge-container') as HTMLElement;
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
  const resignBtn = document.getElementById('btn-resign') as HTMLButtonElement | null;

  globalStore.subscribe((state, store) => {
    updatePlayerBars();

    const result = store.getGameResult();
    const inCheck = store.isInCheck();
    const isWhite = state.turn === 'white';
    const isViewing = store.isViewingHistory();
    const isReview = store.isReviewMode();
    const timedOutLoser = store.getTimedOutLoser();
    const resignedPlayer = store.getResignedPlayer();
    const lastError = store.getLastError();
    const canUndo = store.canUndo();
    undoBtn.disabled = !canUndo;
    if (store.isGameOver()) {
      undoBtn.title = 'Партия окончена';
    } else {
      undoBtn.removeAttribute('title');
    }

    if (resignBtn) {
      resignBtn.disabled = store.isGameOver() || isViewing || isReview || store.isReviewInProgress();
    }

    if (showSummaryBtn) {
      showSummaryBtn.style.display = store.isGameOver() ? 'inline-flex' : 'none';
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

    if (resignedPlayer !== null) {
      if (store.getGameMode() === 'ai') {
        statusText.textContent = resignedPlayer === store.getPlayerColor()
          ? 'Вы сдались. Компьютер победил.'
          : 'Компьютер сдался. Вы победили!';
      } else {
        const winner = resignedPlayer === 'white' ? 'Чёрные победили' : 'Белые победили';
        statusText.textContent = `${resignedPlayer === 'white' ? 'Белые сдались' : 'Чёрные сдались'}. ${winner}.`;
      }
      badgeContainer.innerHTML = '<span class="status-badge badge-over">Сдача</span>';
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

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (globalStore.canUndo()) {
      globalStore.undo();
    }
  });

  document.getElementById('btn-flip')?.addEventListener('click', () => {
    globalStore.toggleFlip();
  });

  const resignOverlay = document.getElementById('resign-modal-overlay') as HTMLElement;
  const resignTitle = document.getElementById('resign-modal-title') as HTMLElement;
  const resignText = document.getElementById('resign-modal-text') as HTMLElement;
  const resignActions = document.getElementById('resign-modal-actions') as HTMLElement;

  const closeResignModal = (): void => {
    if (resignOverlay) resignOverlay.style.display = 'none';
    resignBtn?.focus();
  };

  resignOverlay?.addEventListener('click', (e) => {
    if (e.target === resignOverlay) {
      closeResignModal();
    }
  });

  const handleGlobalKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (resignOverlay && resignOverlay.style.display !== 'none') {
        closeResignModal();
        return;
      }
      if (isReviewOverlayOpen) {
        closeReviewOverlay(true);
        return;
      }
    }

    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Ctrl+Z or Cmd+Z shortcut to undo move on game screen
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') && !e.shiftKey) {
      if (currentRouter?.getRoute() === 'game') {
        e.preventDefault();
        if (globalStore.canUndo()) {
          globalStore.undo();
        }
      }
      return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // F key shortcut to flip the board on the game screen
    const isFKey = e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А';
    if (isFKey && currentRouter?.getRoute() === 'game') {
      e.preventDefault();
      globalStore.toggleFlip();
    }
  };

  document.addEventListener('keydown', handleGlobalKeydown);
  keydownCleanup = () => {
    document.removeEventListener('keydown', handleGlobalKeydown);
  };

  resignBtn?.addEventListener('click', () => {
    if (globalStore.isGameOver()) return;
    const mode = globalStore.getGameMode();

    if (mode === 'ai') {
      resignTitle.textContent = 'Сдаться';
      resignText.textContent = 'Вы уверены, что хотите сдаться?';
      resignActions.innerHTML = `
        <button class="btn-action btn-danger" id="btn-confirm-resign">Сдаться</button>
        <button class="btn-action btn-secondary" id="btn-cancel-resign">Отмена</button>
      `;
      resignOverlay.style.display = 'flex';
      document.getElementById('btn-confirm-resign')?.focus();

      document.getElementById('btn-confirm-resign')?.addEventListener('click', () => {
        closeResignModal();
        globalStore.resign(globalStore.getPlayerColor());
      });
      document.getElementById('btn-cancel-resign')?.addEventListener('click', () => {
        closeResignModal();
      });
    } else {
      resignTitle.textContent = 'Сдаться';
      resignText.textContent = 'Кто сдаётся?';
      resignActions.innerHTML = `
        <button class="btn-action" id="btn-resign-white">Белые</button>
        <button class="btn-action" id="btn-resign-black">Чёрные</button>
        <button class="btn-action btn-secondary" id="btn-cancel-resign">Отмена</button>
      `;
      resignOverlay.style.display = 'flex';
      document.getElementById('btn-resign-white')?.focus();

      document.getElementById('btn-resign-white')?.addEventListener('click', () => {
        closeResignModal();
        globalStore.resign('white');
      });
      document.getElementById('btn-resign-black')?.addEventListener('click', () => {
        closeResignModal();
        globalStore.resign('black');
      });
      document.getElementById('btn-cancel-resign')?.addEventListener('click', () => {
        closeResignModal();
      });
    }
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
