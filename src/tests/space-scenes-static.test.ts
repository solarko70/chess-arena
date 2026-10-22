import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGameScene, buildReviewScene } from '@/ui/space-scenes';

describe('Static game scenery', () => {
  let container: HTMLDivElement;
  let stylesheet: HTMLStyleElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    stylesheet = document.createElement('style');
    stylesheet.textContent = css.slice(css.indexOf('\n.space-anim-layer {'),
      css.indexOf('/* Fallback & legacy element compatibility */'));
    document.head.appendChild(stylesheet);
  });

  afterEach(() => {
    container.remove();
    stylesheet.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('freezes every game layer and keeps all four planets on their fixed orbit positions', () => {
    container.innerHTML = buildGameScene();
    const layers = [...container.children];
    expect(layers).toHaveLength(5);
    for (const layer of layers) {
      expect(layer.classList.contains('space-game-static')).toBe(true);
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      for (const element of [layer, ...layer.querySelectorAll('*')]) {
        const style = getComputedStyle(element);
        expect(style.animation).toBe('none');
        expect(style.transition).toBe('none');
        expect(style.willChange).toBe('auto');
        expect(style.pointerEvents).toBe('none');
      }
    }
    const planets = [...container.querySelectorAll('.space-sun-planet')];
    const orbits = [...container.querySelectorAll('.space-sun-orbit')];
    expect(planets).toHaveLength(4);
    planets.forEach((planet, index) => {
      const orbit = orbits[index];
      const dx = Number(planet.getAttribute('cx')) - Number(orbit.getAttribute('cx'));
      const dy = Number(planet.getAttribute('cy')) - Number(orbit.getAttribute('cy'));
      const rx = Number(orbit.getAttribute('rx'));
      const ry = Number(orbit.getAttribute('ry'));
      expect((dx / rx) ** 2 + (dy / ry) ** 2).toBeCloseTo(1, 2);
      expect(planet.getAttribute('transform')).toBeNull();
    });
    expect(container.querySelector('animate, animateTransform, animateMotion, script')).toBeNull();

    container.innerHTML = buildReviewScene();
    expect(container.querySelector('.space-game-static')).toBeNull();
    expect(getComputedStyle(container.querySelector('.space-galaxy-spin')!).animation)
      .toContain('spaceGalaxySpin');
  });

  it('builds and discards game scenery without timers, frames or event listeners', () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(globalThis, 'setInterval');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const addWindow = vi.spyOn(window, 'addEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const frame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', frame);
    for (let index = 0; index < 10; index++) {
      container.innerHTML = buildGameScene();
      container.replaceChildren();
    }
    expect(container.children).toHaveLength(0);
    expect(interval).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
    expect(addWindow).not.toHaveBeenCalled();
    expect(addDocument).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
