import { describe, it, expect, beforeEach } from 'vitest';
import { globalStore } from '@/state/store';
import { ClockWidget } from '@/ui/clockwidget';

describe('UI Mount and Clock Panel Tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('clock panel and dropdown exist and are not hidden by default, and timers show 03:00 on blitz 3+2', () => {
    const widget = new ClockWidget(container, globalStore);
    widget.render();

    const panel = container.querySelector('#clock-panel') as HTMLElement;
    const select = container.querySelector('#time-control-select') as HTMLSelectElement;

    expect(panel).not.toBeNull();
    expect(select).not.toBeNull();

    let curr: HTMLElement | null = panel;
    while (curr && curr !== document.body) {
      const style = window.getComputedStyle(curr);
      expect(style.display).not.toBe('none');
      expect(curr.hasAttribute('hidden')).toBe(false);
      curr = curr.parentElement;
    }

    select.value = 'blitz-3-2';
    select.dispatchEvent(new Event('change'));
    widget.render();

    const whiteBox = container.querySelector('#white-clock-box') as HTMLElement;
    const blackBox = container.querySelector('#black-clock-box') as HTMLElement;
    const whiteTime = container.querySelector('#white-time') as HTMLElement;

    expect(whiteBox).not.toBeNull();
    expect(blackBox).not.toBeNull();

    expect(window.getComputedStyle(whiteBox).display).not.toBe('none');
    expect(window.getComputedStyle(blackBox).display).not.toBe('none');

    expect(whiteTime.textContent).toBe('03:00');
  });
});
