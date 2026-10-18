import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initApp, getRouter } from '@/main';
import { globalStore } from '@/state/store';
import { APP_NAME } from '@/config';
import { t } from '@/i18n';

describe('Screens & Navigation (Stage A1)', () => {
  beforeEach(() => {
    window.location.hash = '#/';
    document.body.innerHTML = '<div id="app"></div>';
    globalStore.newGame(undefined, { mode: 'pvp' });
    initApp();
  });

  afterEach(() => {
    getRouter()?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('main screen contains 5 menu buttons with titles from t()', () => {
    const playLocalBtn = document.getElementById('btn-play-local');
    const playBotBtn = document.getElementById('btn-play-bot');
    const playOnlineBtn = document.getElementById('btn-play-online');
    const playVariantsBtn = document.getElementById('btn-play-variants');
    const analysisBtn = document.getElementById('btn-analysis');

    expect(playLocalBtn?.textContent?.trim()).toBe(t('menu.playLocal'));
    expect(playBotBtn?.textContent?.trim()).toBe(t('menu.playBot'));
    expect(playOnlineBtn?.textContent?.trim()).toBe(t('menu.playOnline'));
    expect(playVariantsBtn?.textContent?.trim()).toBe(t('menu.playVariants'));
    expect(analysisBtn?.textContent?.trim()).toBe(t('menu.analysis'));
  });

  it('home and game screen titles are rendered from APP_NAME', () => {
    expect(document.title).toBe(APP_NAME);

    const homeTitle = document.getElementById('home-app-title');
    const gameTitle = document.getElementById('game-app-title');

    expect(homeTitle?.textContent).toContain(APP_NAME);
    expect(gameTitle?.textContent).toContain(APP_NAME);
  });

  it('stub menu buttons show soon toast message without navigating', () => {
    const toast = document.getElementById('home-toast') as HTMLElement;
    expect(toast.style.display).toBe('none');

    // 1. Play online
    document.getElementById('btn-play-online')?.click();
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toBe(t('common.soon'));
    expect(window.location.hash).toBe('#/');

    // 2. Play variants
    document.getElementById('btn-play-variants')?.click();
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toBe(t('common.soon'));
    expect(window.location.hash).toBe('#/');

    // 3. Analysis
    document.getElementById('btn-analysis')?.click();
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toBe(t('common.soon'));
    expect(window.location.hash).toBe('#/');
  });

  it('hash router switches screens between home, game, and analysis', () => {
    const homeScreen = document.getElementById('screen-home');
    const gameScreen = document.getElementById('screen-game');
    const analysisScreen = document.getElementById('screen-analysis');

    // Initial route is home
    expect(homeScreen?.classList.contains('active')).toBe(true);
    expect(homeScreen?.style.display).toBe('flex');
    expect(gameScreen?.style.display).toBe('none');
    expect(analysisScreen?.style.display).toBe('none');

    // Navigate to game screen
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(homeScreen?.style.display).toBe('none');
    expect(gameScreen?.style.display).toBe('flex');
    expect(gameScreen?.classList.contains('active')).toBe(true);

    // Navigate to analysis stub
    window.location.hash = '#/analysis';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(homeScreen?.style.display).toBe('none');
    expect(gameScreen?.style.display).toBe('none');
    expect(analysisScreen?.style.display).toBe('flex');
    expect(analysisScreen?.classList.contains('active')).toBe(true);

    // Navigate back to home
    window.location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(homeScreen?.style.display).toBe('flex');
    expect(gameScreen?.style.display).toBe('none');
    expect(analysisScreen?.style.display).toBe('none');
  });

  it('play local button navigates to game screen with pvp mode', () => {
    const playLocalBtn = document.getElementById('btn-play-local');
    playLocalBtn?.click();

    expect(window.location.hash).toBe('#/game');
    expect(globalStore.getGameMode()).toBe('pvp');

    const gameScreen = document.getElementById('screen-game');
    expect(gameScreen?.style.display).toBe('flex');
  });

  it('play bot button navigates to game screen with ai mode', () => {
    const playBotBtn = document.getElementById('btn-play-bot');
    playBotBtn?.click();

    expect(window.location.hash).toBe('#/game');
    expect(globalStore.getGameMode()).toBe('ai');

    const gameScreen = document.getElementById('screen-game');
    expect(gameScreen?.style.display).toBe('flex');
  });

  it('back to main asks confirmation if live game is ongoing', () => {
    // Navigate to game and make a move
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    expect(globalStore.getLiveState().history.length).toBe(1);
    expect(globalStore.getGameResult().type).toBe('ongoing');

    const confirmSpy = vi.spyOn(window, 'confirm');

    // 1. User cancels confirmation -> stay in game
    confirmSpy.mockReturnValue(false);
    document.getElementById('btn-back-to-main')?.click();

    expect(confirmSpy).toHaveBeenCalledWith(t('game.leaveConfirm'));
    expect(window.location.hash).toBe('#/game');

    // 2. User confirms -> navigates to home
    confirmSpy.mockReturnValue(true);
    document.getElementById('btn-back-to-main')?.click();

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe('#/');
  });

  it('back to main does not ask confirmation after game ends', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Fool's mate: 1. f3 e5 2. g4 Qh4#
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

    const confirmSpy = vi.spyOn(window, 'confirm');
    document.getElementById('btn-back-to-main')?.click();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/');
  });

  it('back to main does not ask confirmation if no moves played', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(globalStore.getLiveState().history.length).toBe(0);

    const confirmSpy = vi.spyOn(window, 'confirm');
    document.getElementById('btn-back-to-main')?.click();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/');
  });

  it('home screen title has no emojis and equals APP_NAME', () => {
    const homeTitle = document.getElementById('home-app-title');
    expect(homeTitle).not.toBeNull();
    expect(homeTitle?.textContent?.trim()).toBe(APP_NAME);
    expect(homeTitle?.textContent).not.toMatch(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}]/u);

    const gameTitle = document.getElementById('game-app-title');
    expect(gameTitle?.textContent?.trim()).toBe(APP_NAME);
    expect(gameTitle?.textContent).not.toMatch(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}]/u);
  });

  it('solar background has aria-hidden true and pointer-events none', () => {
    const solarBg = document.querySelector('.solar-background');
    expect(solarBg).not.toBeNull();
    expect(solarBg?.getAttribute('aria-hidden')).toBe('true');
    expect((solarBg as HTMLElement)?.style.pointerEvents).toBe('none');

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.solar-background\s*\{[^}]*pointer-events:\s*none;/);
  });

  it('theme toggle button is fixed in top right corner of viewport', () => {
    const themeBtn = document.getElementById('theme-btn');
    expect(themeBtn).not.toBeNull();
    expect(themeBtn?.classList.contains('theme-toggle-btn')).toBe(true);

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.theme-toggle-btn\s*\{[^}]*position:\s*fixed;/);
    expect(css).toMatch(/\.theme-toggle-btn\s*\{[^}]*top:\s*16px;/);
    expect(css).toMatch(/\.theme-toggle-btn\s*\{[^}]*right:\s*16px;/);
  });

  it('prefers-reduced-motion media query disables animations in styles.css', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const reducedMotionBlock = css.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(reducedMotionBlock).toContain('animation: none !important');
    expect(reducedMotionBlock).toContain('.solar-sun');
    expect(reducedMotionBlock).toContain('.solar-orbit');
  });

  it('solar background layer has position fixed, inset 0, aria-hidden and pointer-events none', () => {
    const solarBg = document.getElementById('solar-bg');
    expect(solarBg).not.toBeNull();
    expect(solarBg?.getAttribute('aria-hidden')).toBe('true');
    expect((solarBg as HTMLElement)?.style.pointerEvents).toBe('none');

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.solar-background\s*\{[^}]*position:\s*fixed;/);
    expect(css).toMatch(/\.solar-background\s*\{[^}]*inset:\s*0;/);
    expect(css).toMatch(/\.solar-background\s*\{[^}]*pointer-events:\s*none;/);
  });

  it('solar background is absent on game screen', () => {
    const solarBg = document.getElementById('solar-bg');
    expect(solarBg).not.toBeNull();
    expect(solarBg?.style.display).not.toBe('none');
    expect(solarBg?.classList.contains('active')).toBe(true);

    // Navigate to game
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(solarBg?.style.display).toBe('none');
    expect(solarBg?.classList.contains('active')).toBe(false);

    // Navigate back to home
    window.location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(solarBg?.style.display).toBe('block');
    expect(solarBg?.classList.contains('active')).toBe(true);
  });

  it('css variables for glass blur, vignette strength and far blur are declared', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/--glass-blur:\s*10px;/);
    expect(css).toMatch(/--vignette-strength:\s*0\.55;/);
    expect(css).toMatch(/--far-blur:\s*1px;/);
  });

  it('prefers-reduced-motion disables animations while blur is preserved in styles.css', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const reducedMotionBlock = css.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(reducedMotionBlock).toContain('animation: none !important');
    expect(reducedMotionBlock).not.toContain('blur(0)');
    expect(reducedMotionBlock).not.toContain('backdrop-filter: none');
    expect(reducedMotionBlock).not.toContain('filter: none');
  });

  it('queen icon has lower z-index than title text', () => {
    const queenEl = document.querySelector('.home-title-queen');
    const titleEl = document.querySelector('.home-title');
    expect(queenEl).not.toBeNull();
    expect(titleEl).not.toBeNull();

    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.home-title-queen\s*\{[^}]*z-index:\s*1;/);
    expect(css).toMatch(/\.home-title\s*\{[^}]*z-index:\s*2;/);
  });
});

