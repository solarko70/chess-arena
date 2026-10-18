import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initApp, getRouter } from '@/main';
import { globalStore } from '@/state/store';
import { LOCAL_SETUP_STORAGE_KEY, BOT_SETUP_STORAGE_KEY } from '@/ui/setupmodals';

describe('Game Setup Modals & Resignation (Stage A2)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#/';
    document.body.innerHTML = '<div id="app"></div>';
    globalStore.newGame(undefined, { mode: 'pvp' });
    initApp();
  });

  afterEach(() => {
    getRouter()?.destroy();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('local modal contains time control groups and no level or color fields', () => {
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();

    const overlay = document.getElementById('setup-modal-overlay') as HTMLElement;
    expect(overlay.style.display).toBe('flex');

    const title = document.getElementById('setup-modal-title');
    expect(title?.textContent).toBe('Играть локально');

    // Time cards present
    const timeCards = overlay.querySelectorAll('.setup-time-card');
    expect(timeCards.length).toBe(6); // none, 1+0, 3+2, 5+0, 10+0, 15+10

    // No level or color fields
    const levelCards = overlay.querySelectorAll('.setup-level-card');
    const colorCards = overlay.querySelectorAll('.setup-color-card');
    expect(levelCards.length).toBe(0);
    expect(colorCards.length).toBe(0);
  });

  it('bot modal contains time, level with strength guide and player color', () => {
    const playBotBtn = document.getElementById('btn-play-bot') as HTMLButtonElement;
    playBotBtn.click();

    const overlay = document.getElementById('setup-modal-overlay') as HTMLElement;
    expect(overlay.style.display).toBe('flex');

    const title = document.getElementById('setup-modal-title');
    expect(title?.textContent).toBe('Играть с ботом');

    // Time cards present
    const timeCards = overlay.querySelectorAll('.setup-time-card');
    expect(timeCards.length).toBe(6);

    // 5 Bot levels with name and elo guide
    const levelCards = overlay.querySelectorAll('.setup-level-card');
    expect(levelCards.length).toBe(5);

    const eloBadges = overlay.querySelectorAll('.setup-level-elo');
    expect(eloBadges.length).toBe(5);

    // 3 Color options
    const colorCards = overlay.querySelectorAll('.setup-color-card');
    expect(colorCards.length).toBe(3);
  });

  it('start game saves local choices to localStorage and opens game with pvp', () => {
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();

    // Select Blitz 5+0
    const blitz5Card = document.querySelector('.setup-time-card[data-time-id="blitz-5-0"]') as HTMLButtonElement;
    blitz5Card.click();

    const startBtn = document.getElementById('btn-setup-start') as HTMLButtonElement;
    startBtn.click();

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem(LOCAL_SETUP_STORAGE_KEY) || '{}');
    expect(saved.timeControl).toBe('blitz-5-0');

    // Check store & navigation
    expect(globalStore.getGameMode()).toBe('pvp');
    expect(globalStore.getClockMode()).toBe('blitz-5-0');
    expect(window.location.hash).toBe('#/game');
  });

  it('start game saves bot choices to localStorage and opens game with ai mode', () => {
    const playBotBtn = document.getElementById('btn-play-bot') as HTMLButtonElement;
    playBotBtn.click();

    // Select 3+2, Expert level, and Black color
    const blitz32Card = document.querySelector('.setup-time-card[data-time-id="blitz-3-2"]') as HTMLButtonElement;
    const expertCard = document.querySelector('.setup-level-card[data-level-id="expert"]') as HTMLButtonElement;
    const blackColorCard = document.querySelector('.setup-color-card[data-color-id="black"]') as HTMLButtonElement;

    blitz32Card.click();
    expertCard.click();
    blackColorCard.click();

    const startBtn = document.getElementById('btn-setup-start') as HTMLButtonElement;
    startBtn.click();

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem(BOT_SETUP_STORAGE_KEY) || '{}');
    expect(saved.timeControl).toBe('blitz-3-2');
    expect(saved.level).toBe('expert');
    expect(saved.playerColor).toBe('black');

    // Check store & navigation
    expect(globalStore.getGameMode()).toBe('ai');
    expect(globalStore.getAILevel()).toBe('expert');
    expect(globalStore.getPlayerColorChoice()).toBe('black');
    expect(globalStore.getClockMode()).toBe('blitz-3-2');
    expect(window.location.hash).toBe('#/game');
  });

  it('escape, close button and overlay click close setup modal', () => {
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();

    const overlay = document.getElementById('setup-modal-overlay') as HTMLElement;
    expect(overlay.style.display).toBe('flex');

    // 1. Close via close button
    const closeBtn = document.getElementById('btn-setup-close') as HTMLButtonElement;
    closeBtn.click();
    expect(overlay.style.display).toBe('none');

    // 2. Open and close via Escape
    playLocalBtn.click();
    expect(overlay.style.display).toBe('flex');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.style.display).toBe('none');

    // 3. Open and close via overlay backdrop click
    playLocalBtn.click();
    expect(overlay.style.display).toBe('flex');
    overlay.click();
    expect(overlay.style.display).toBe('none');
  });

  it('focus trap cycles inside setup modal and initial focus is on start button', () => {
    const playLocalBtn = document.getElementById('btn-play-local') as HTMLButtonElement;
    playLocalBtn.click();

    const startBtn = document.getElementById('btn-setup-start') as HTMLButtonElement;
    expect(document.activeElement).toBe(startBtn);

    const dialog = document.querySelector('.setup-modal-dialog') as HTMLElement;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Tab from last wraps to first
    last.focus();
    const eventTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(eventTab);
    expect(eventTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('navigating to #/game without an active game redirects to home screen', () => {
    globalStore.setActiveGame(false);

    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(window.location.hash).toBe('#/');
    const homeScreen = document.getElementById('screen-home');
    expect(homeScreen?.style.display).toBe('flex');
  });

  it('resigning against bot shows confirm dialog, stops clock, shows loss modal', () => {
    // Start game vs bot with clocks
    globalStore.setClockMode('rapid-10-0');
    globalStore.newGame(undefined, { mode: 'ai', level: 'club', playerColor: 'white' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Make first move to start clock
    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    expect(globalStore.isClockActive()).toBe(true);

    const resignBtn = document.getElementById('btn-resign') as HTMLButtonElement;
    expect(resignBtn.disabled).toBe(false);
    resignBtn.click();

    // Confirm dialog is shown
    const resignOverlay = document.getElementById('resign-modal-overlay') as HTMLElement;
    expect(resignOverlay.style.display).toBe('flex');
    expect(resignOverlay.textContent).toContain('Вы уверены, что хотите сдаться?');

    // Click confirm resign
    const confirmBtn = document.getElementById('btn-confirm-resign') as HTMLButtonElement;
    confirmBtn.click();

    expect(resignOverlay.style.display).toBe('none');
    expect(globalStore.getResignedPlayer()).toBe('white');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.isClockActive()).toBe(false);
    expect(globalStore.isAIThinking()).toBe(false);

    // Check game over modal
    const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
    expect(gameOverOverlay.style.display).toBe('flex');

    const verdictEl = document.getElementById('game-over-verdict');
    const titleEl = document.getElementById('game-over-title');
    expect(verdictEl?.textContent).toBe('Вы проиграли');
    expect(titleEl?.textContent).toBe('Вы сдались');
  });

  it('resigning in local game prompts which side resigns and shows win for opponent', () => {
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const resignBtn = document.getElementById('btn-resign') as HTMLButtonElement;
    resignBtn.click();

    const resignOverlay = document.getElementById('resign-modal-overlay') as HTMLElement;
    expect(resignOverlay.style.display).toBe('flex');
    expect(resignOverlay.textContent).toContain('Кто сдаётся?');

    // Click White resigns
    const resignWhiteBtn = document.getElementById('btn-resign-white') as HTMLButtonElement;
    resignWhiteBtn.click();

    expect(globalStore.getResignedPlayer()).toBe('white');
    expect(globalStore.isGameOver()).toBe(true);

    const titleEl = document.getElementById('game-over-title');
    expect(titleEl?.textContent).toBe('Белые сдались. Победили чёрные');
  });

  it('undo after resignation restores game to ongoing and re-enables resign button', () => {
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    globalStore.resign('white');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.getResignedPlayer()).toBe('white');

    const resignBtn = document.getElementById('btn-resign') as HTMLButtonElement;
    expect(resignBtn.disabled).toBe(true);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    undoBtn.click();

    expect(globalStore.getResignedPlayer()).toBeNull();
    expect(globalStore.isGameOver()).toBe(false);
    expect(resignBtn.disabled).toBe(false);
  });

  it('resign button is disabled when game is over', () => {
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Fool's mate
    const f2 = globalStore.coordsToSquare(5, 6);
    const f3 = globalStore.coordsToSquare(5, 5);
    const e7 = globalStore.coordsToSquare(4, 1);
    const e5 = globalStore.coordsToSquare(4, 3);
    const g2 = globalStore.coordsToSquare(6, 6);
    const g4 = globalStore.coordsToSquare(6, 4);
    const d8 = globalStore.coordsToSquare(3, 0);
    const h4 = globalStore.coordsToSquare(7, 4);

    globalStore.makeMove(f2, f3);
    globalStore.makeMove(e7, e5);
    globalStore.makeMove(g2, g4);
    globalStore.makeMove(d8, h4);

    expect(globalStore.getGameResult().type).toBe('checkmate');
    const resignBtn = document.getElementById('btn-resign') as HTMLButtonElement;
    expect(resignBtn.disabled).toBe(true);
  });
});
