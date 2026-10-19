import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBrowserStockfishUrl } from '@/analysis';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';

describe('GitHub Pages Deployment & Touch Controls', () => {
  it('Файл deploy.yml существует и содержит шаги сборки и публикации', () => {
    const deployPath = path.resolve(process.cwd(), '.github/workflows/deploy.yml');
    expect(fs.existsSync(deployPath)).toBe(true);

    const content = fs.readFileSync(deployPath, 'utf-8');
    expect(content).toContain('build:');
    expect(content).toContain('deploy:');
    expect(content).toContain('actions/deploy-pages');
    expect(content).toContain('npm run build');
    expect(content).toContain('npm run lint');
    expect(content).toContain('upload-pages-artifact');
  });

  it('В index.html настроен viewport с user-scalable=no и cover', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('name="viewport"');
    expect(content).toContain('user-scalable=no');
    expect(content).toContain('viewport-fit=cover');
    expect(content).toContain('width=device-width');
  });

  it('resolveBrowserStockfishUrl возвращает относительный путь', async () => {
    const url = await resolveBrowserStockfishUrl();
    expect(url).toContain('stockfish');
    expect(url.startsWith('/stockfish')).toBe(false);
    expect(url.startsWith('./') || !url.startsWith('/')).toBe(true);
  });

  it('Селекторы доски имеют touch-action: none и user-select: none', () => {
    const cssPath = path.resolve(process.cwd(), 'src/ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    expect(css).toContain('.board-container');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('user-select: none');
  });

  it('Доска обрабатывает touchstart, touchmove и touchend события', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const store = new ChessStore();
    new ChessBoardUI(container, store);

    // Initial square e2 (sq 52) has White pawn
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);

    const sqEl = container.querySelector(`[data-square="${e2}"]`) as HTMLElement;
    const destSqEl = container.querySelector(`[data-square="${e4}"]`) as HTMLElement;
    expect(sqEl).toBeTruthy();
    expect(destSqEl).toBeTruthy();

    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (_x: number, y: number) => {
      if (y >= 200) return destSqEl;
      return sqEl;
    };

    try {
      // 1. Touch start on e2
      const touchStartEv = new CustomEvent('touchstart', {
        bubbles: true,
        cancelable: true,
      }) as unknown as TouchEvent;
      Object.defineProperty(touchStartEv, 'touches', {
        value: [{ clientX: 100, clientY: 100 }],
      });
      sqEl.dispatchEvent(touchStartEv as unknown as Event);

      expect(document.querySelector('.floating-drag-piece')).toBeTruthy();

      // 2. Touch move
      const touchMoveEv = new CustomEvent('touchmove', {
        bubbles: true,
        cancelable: true,
      }) as unknown as TouchEvent;
      Object.defineProperty(touchMoveEv, 'touches', {
        value: [{ clientX: 100, clientY: 200 }],
      });
      window.dispatchEvent(touchMoveEv as unknown as Event);

      // 3. Touch end on e4
      const touchEndEv = new CustomEvent('touchend', {
        bubbles: true,
        cancelable: true,
      }) as unknown as TouchEvent;
      Object.defineProperty(touchEndEv, 'touches', { value: [] });
      Object.defineProperty(touchEndEv, 'changedTouches', {
        value: [{ clientX: 100, clientY: 200 }],
      });
      window.dispatchEvent(touchEndEv as unknown as Event);

      // Drag piece should be cleaned up
      expect(document.querySelector('.floating-drag-piece')).toBeNull();

      // Move e2 -> e4 should have been executed
      expect(store.getState().history.length).toBe(1);
      expect(store.getState().history[0].to).toBe(e4);
    } finally {
      document.elementFromPoint = origElementFromPoint;
      container.remove();
    }
  });
});

