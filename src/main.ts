import './ui/styles.css';
import { globalStore, type GameMode, type PlayerColorChoice } from './state/store';
import { ChessBoardUI } from './ui/board';
import { HistoryUI } from './ui/history';
import { ImportExportUI } from './ui/importexport';
import { ClockWidget } from './ui/clockwidget';
import { ReviewPanelUI } from './ui/reviewpanel';
import { LEVELS, LEVEL_ORDER, type LevelId } from './ai';

export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  globalStore.loadSettingsFromStorage();

  const levelOptionsHtml = LEVEL_ORDER.map(
    (id) => `<option value="${id}">${LEVELS[id].name}</option>`,
  ).join('');

  app.innerHTML = `
    <header class="chess-header">
      <div class="chess-title">
        <span>⚔️ Chess Arena</span>
      </div>
      <button class="theme-toggle-btn" id="theme-btn">🌙 Тёмная тема</button>
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
      <button class="btn-action" id="btn-new-game">🔄 Новая партия</button>
      <button class="btn-action" id="btn-undo">↩️ Отменить ход</button>
      <button class="btn-action" id="btn-flip">🔃 Перевернуть</button>
    </div>
  `;

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

  const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement;
  let isDark = true;
  themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = '🌙 Тёмная тема';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      themeBtn.textContent = '☀️ Светлая тема';
    }
  });
}

window.addEventListener('DOMContentLoaded', initApp);

