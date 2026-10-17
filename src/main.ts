import './ui/styles.css';
import { globalStore } from './state/store';
import { ChessBoardUI } from './ui/board';

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <header class="chess-header">
      <div class="chess-title">
        <span>⚔️ Chess Arena</span>
      </div>
      <button class="theme-toggle-btn" id="theme-btn">🌙 Тёмная тема</button>
    </header>

    <div class="status-bar">
      <div class="status-text" id="status-text">Ход белых</div>
      <div id="status-badge-container"></div>
    </div>

    <div id="board-mount"></div>

    <div class="controls-bar">
      <button class="btn-action" id="btn-new-game">🔄 Новая партия</button>
      <button class="btn-action" id="btn-undo">↩️ Отменить ход</button>
      <button class="btn-action" id="btn-flip">🔃 Перевернуть</button>
    </div>
  `;

  // Mount Board UI
  const boardMount = document.getElementById('board-mount') as HTMLElement;
  new ChessBoardUI(boardMount, globalStore);

  // Status updates
  const statusText = document.getElementById('status-text') as HTMLElement;
  const badgeContainer = document.getElementById('status-badge-container') as HTMLElement;
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;

  globalStore.subscribe((state, store) => {
    const result = store.getGameResult();
    const inCheck = store.isInCheck();
    const isWhite = state.turn === 'white';

    undoBtn.disabled = state.history.length === 0;

    let text = isWhite ? 'Ход белых' : 'Ход чёрных';
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
    } else if (inCheck) {
      text = `${isWhite ? 'Белый' : 'Чёрный'} король под шахом!`;
      badgeHtml += ' <span class="status-badge badge-check">Шах</span>';
    }

    statusText.textContent = text;
    badgeContainer.innerHTML = badgeHtml;
  });

  // Action buttons
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    globalStore.newGame();
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    globalStore.undo();
  });

  document.getElementById('btn-flip')?.addEventListener('click', () => {
    globalStore.toggleFlip();
  });

  // Theme toggle
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
