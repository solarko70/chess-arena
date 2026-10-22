import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { solarAudio } from '@/audio/solar-audio';
import { mountSaturnBackground, unmountSaturnBackground } from '@/ui/saturn-background';
import { disposeSaturnBackground, updateSaturnBackground } from '@/ui/navigation';
import { getRouter, initApp } from '@/main';

describe('Saturn background', () => {
  let container: HTMLElement;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    document.body.classList.remove('bg-anim-off');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const measure = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('solar-singularity-disk')) {
        return { left: 600, top: 150, width: 400, height: 400 } as DOMRect;
      }
      return measure.call(this);
    });
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
    vi.stubGlobal('matchMedia', undefined);
  });

  afterEach(() => {
    getRouter()?.destroy();
    disposeSaturnBackground();
    unmountSaturnBackground();
    container.remove();
    document.getElementById('setup-modal-mount')?.remove();
    document.getElementById('game-over-modal-mount')?.remove();
    document.getElementById('game-solar-bg')?.remove();
    document.body.classList.remove('bg-anim-off');
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function advanceFrames(count = 160): void {
    for (let i = 0; i < count && frames.size > 0; i++) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(i * 16));
    }
  }

  it('mounts an aria-hidden CSS scene without adding keyboard stops', () => {
    mountSaturnBackground(container);
    const wrapper = container.querySelector('.saturn-scene-wrapper');
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.classList.contains('solar-singularity-scene')).toBe(true);
    expect(wrapper?.querySelector('[tabindex], button, a')).toBeNull();
    expect(wrapper?.querySelector('svg, canvas, img')).toBeNull();
  });

  it('builds ordered corona, dark disk and coordinate orbit layers over the abyss', () => {
    mountSaturnBackground(container);
    const scene = container.querySelector('.solar-singularity-scene')!;
    const layers = [...scene.children]
      .map((element) => element.getAttribute('class'));
    expect(layers).toEqual([
      'solar-singularity-corona corona-pulse',
      'solar-singularity-disk',
      'solar-singularity-orbits',
    ]);
    for (const element of [scene, ...scene.children]) {
      expect(element.getAttribute('aria-hidden')).toBe('true');
    }
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    expect(css).toMatch(/\.solar-singularity-scene\s*\{[^}]*background:\s*radial-gradient/);
    expect(css).toMatch(/\.solar-singularity-disk\s*\{[^}]*background:\s*var\(--solar-singularity-core\)/);
    expect(css).toContain("content: '180\\00b0 / 07'");
  });

  it('unmount removes the DOM, frame and exactly the listeners installed by mount', () => {
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const addRoot = vi.spyOn(document.documentElement, 'addEventListener');
    const removeRoot = vi.spyOn(document.documentElement, 'removeEventListener');
    const cleanup = mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 600 }));
    expect(frames.size).toBe(1);
    cleanup();
    cleanup();
    expect(container.querySelector('.saturn-scene-wrapper')).toBeNull();
    expect(frames.size).toBe(0);
    for (const type of ['mousemove', 'resize', 'blur']) {
      const listener = addWindow.mock.calls.find(([name]) => name === type)![1];
      expect(removeWindow).toHaveBeenCalledWith(type, listener);
    }
    const listener = addDocument.mock.calls.find(([name]) => name === 'visibilitychange')![1];
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', listener);
    expect(removeRoot).toHaveBeenCalledWith('mouseleave', addRoot.mock.calls[0]?.[1]);
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('a stale cleanup cannot remove a newly mounted scene', () => {
    const oldCleanup = mountSaturnBackground(container);
    const oldScene = container.querySelector('.solar-singularity-scene');
    mountSaturnBackground(container);
    oldCleanup();
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    expect(container.querySelector('.solar-singularity-scene')).not.toBe(oldScene);
    unmountSaturnBackground();
    unmountSaturnBackground();
    expect(container.children).toHaveLength(0);
  });

  it('smooths and clamps pointer motion, then stops requesting frames at rest', () => {
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50000, clientY: -50000 }));
    advanceFrames(1);
    const firstX = Number(corona.style.transform.match(/-50% \+ ([\d.-]+)px/)![1]);
    expect(firstX).toBeGreaterThan(0);
    expect(firstX).toBeLessThan(10);
    advanceFrames();
    expect(corona.style.transform).toBe('translate3d(calc(-50% + 10.000px), calc(-50% + -10.000px), 0)');
    expect(corona.style.length).toBe(1);
    expect(container.querySelector<HTMLElement>('.solar-singularity-disk')!.style.transform)
      .toContain('-50% + 6.500px');
    expect(frames.size).toBe(0);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    advanceFrames();
    expect(corona.style.transform).toBe('translate3d(calc(-50% + 0.000px), calc(-50% + 0.000px), 0)');
  });

  it('refreshes viewport bounds on resize and cancels the previous motion', () => {
    const measure = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 400, height: 200,
    } as DOMRect);
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300 }));
    expect(frames.size).toBe(1);
    window.dispatchEvent(new Event('resize'));
    expect(measure).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 200 }));
    advanceFrames();
    expect(container.querySelector<HTMLElement>('.solar-singularity-corona')!.style.transform)
      .toBe('translate3d(calc(-50% + 0.000px), calc(-50% + 0.000px), 0)');
  });

  it('coalesces pointer bursts into one frame without layout reads or immediate style writes', () => {
    const measure = vi.spyOn(container, 'getBoundingClientRect');
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    const transformWrites = vi.spyOn(corona.style, 'transform', 'set');
    const diskMeasure = vi.spyOn(container.querySelector<HTMLElement>('.solar-singularity-disk')!, 'getBoundingClientRect');
    for (let i = 0; i < 200; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: i * 20, clientY: 900 }));
    }
    expect(frames.size).toBe(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledTimes(1);
    expect(transformWrites).not.toHaveBeenCalled();
    advanceFrames();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(corona.style.transform).toContain('-50% + 10.000px');
    expect(diskMeasure).not.toHaveBeenCalled();
  });

  it('limits the entire singularity scene to four DOM elements without SVG or hitboxes', () => {
    mountSaturnBackground(container);
    const scene = container.querySelector('.solar-singularity-scene')!;
    expect(1 + scene.querySelectorAll('*').length).toBeLessThanOrEqual(4);
    expect(scene.children).toHaveLength(3);
    expect(scene.querySelector('svg, canvas, img, [tabindex]')).toBeNull();
    expect(scene.querySelector('.saturn-hitbox')).toBeNull();
  });

  it('provides bleed margins and composite-only pulse without filters or pointer interception', () => {
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    const wrapper = css.match(/\.solar-singularity-scene\s*\{([^}]+)\}/)![1];
    for (const declaration of ['top: -15%', 'left: -15%', 'width: 130%', 'height: 130%']) {
      expect(wrapper).toContain(declaration);
    }
    for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/singularity|corona-pulse/.test(selectors)) {
        expect(declarations).not.toMatch(/(?:backdrop-)?filter\s*:/);
        expect(declarations).not.toMatch(/pointer-events:\s*(auto|fill)/);
      }
    }
    expect(css).toMatch(/\.solar-singularity-scene > div\s*\{[^}]*will-change:\s*transform/);
    expect(css).toMatch(/\.corona-pulse::before\s*\{[^}]*animation:\s*solarCoronaPulse 9s/);
    const pulse = css.match(/@keyframes solarCoronaPulse\s*\{([\s\S]*?)\n\}/)![1];
    expect(pulse).toContain('scale(0.98)');
    expect(pulse).toContain('scale(1.02)');
    expect([...pulse.matchAll(/([\w-]+)\s*:/g)].map(match => match[1]))
      .toEqual(['transform', 'opacity', 'transform', 'opacity']);
    mountSaturnBackground(container);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('plays one procedural hover tick and clears the warming effect on leave', () => {
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 350 }));
    advanceFrames();
    expect(hover).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.solar-singularity-hovered')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 810, clientY: 350 }));
    advanceFrames();
    expect(hover).toHaveBeenCalledTimes(1);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    advanceFrames();
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
  });

  it('ignores controls over the core and cancels hover and pending motion on blur', () => {
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    const button = document.createElement('button');
    container.appendChild(button);
    button.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 800, clientY: 350 }));
    advanceFrames();
    expect(hover).not.toHaveBeenCalled();
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 350 }));
    advanceFrames(1);
    expect(hover).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 350 }));
    expect(frames.size).toBe(1);
    window.dispatchEvent(new Event('blur'));
    expect(frames.size).toBe(0);
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
  });

  it('does not treat the entire right half of the menu as the corona hover zone', () => {
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 0 }));
    advanceFrames();
    expect(hover).not.toHaveBeenCalled();
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
  });

  it('keeps geometric hover with reduced motion without running a parallax loop', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    const transformWrites = vi.spyOn(corona.style, 'transform', 'set');
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 350 }));
    expect(frames.size).toBe(1);
    advanceFrames(1);
    expect(frames.size).toBe(0);
    expect(hover).toHaveBeenCalledTimes(1);
    expect(transformWrites).not.toHaveBeenCalled();
  });

  it('pauses a hidden scene and cancels pending animation work', () => {
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }));
    expect(frames.size).toBe(1);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    expect(container.querySelector('.solar-anim-paused')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('respects reduced motion and detaches its preference listener', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }));
    expect(frames.size).toBe(1);
    media.matches = true;
    media.addEventListener.mock.calls[0][1]();
    expect(frames.size).toBe(0);
    window.dispatchEvent(new MouseEvent('mousemove'));
    advanceFrames();
    expect(frames.size).toBe(0);
    unmountSaturnBackground();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1]);
  });

  it('respects disabled background animation without running a parallax loop', () => {
    document.body.classList.add('bg-anim-off');
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove'));
    advanceFrames();
    expect(frames.size).toBe(0);
    expect(container.querySelector<HTMLElement>('.solar-singularity-corona')!.style.transform)
      .toBe('translate3d(calc(-50% + 0.000px), calc(-50% + 0.000px), 0)');
  });

  it('works in JSDOM without Web Audio, matchMedia or requestAnimationFrame', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal('requestAnimationFrame', undefined);
    const nodes = vi.spyOn(solarAudio, 'ensureContext');
    mountSaturnBackground(container);
    expect(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
      unmountSaturnBackground();
    }).not.toThrow();
    expect(nodes.mock.results.every((result) => result.value === null)).toBe(true);
  });

  it('safely returns a no-op when mounted without a document', () => {
    vi.stubGlobal('document', undefined);
    expect(() => mountSaturnBackground(container)()).not.toThrow();
    expect(() => unmountSaturnBackground()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('keeps a leaving scene for 250ms even when its menu screen is hidden', () => {
    vi.useFakeTimers();
    updateSaturnBackground('home', container);
    updateSaturnBackground('home', container);
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    updateSaturnBackground('game', container);
    const scene = container.querySelector('.saturn-scene-wrapper')!;
    expect(scene.classList.contains('saturn-scene-leaving')).toBe(true);
    vi.advanceTimersByTime(249);
    expect(scene.isConnected).toBe(true);
    updateSaturnBackground('analysis', container);
    vi.advanceTimersByTime(1);
    expect(container.children).toHaveLength(0);
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('cancels stale fade timers when returning home or reinitializing navigation', () => {
    vi.useFakeTimers();
    updateSaturnBackground('home', container);
    updateSaturnBackground('game', container);
    vi.advanceTimersByTime(100);
    updateSaturnBackground('home', container);
    vi.advanceTimersByTime(250);
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    expect(container.querySelector('.saturn-scene-leaving')).toBeNull();
    updateSaturnBackground('analysis', container);
    disposeSaturnBackground();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.children).toHaveLength(0);
  });

  it('mounts through the app router and fades away on analysis navigation', () => {
    vi.useFakeTimers();
    container.id = 'app';
    window.location.hash = '#/';
    initApp();
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    getRouter()!.navigate('analysis');
    expect(container.querySelector('.saturn-scene-leaving')).not.toBeNull();
    vi.advanceTimersByTime(250);
    expect(container.querySelector('.saturn-scene-wrapper')).toBeNull();
    getRouter()!.navigate('home');
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    getRouter()!.destroy();
  });

  it('ignores sound events whose target is the document rather than an element', () => {
    vi.useFakeTimers();
    container.id = 'app';
    window.location.hash = '#/';
    initApp();
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent): void => { errors.push(event.error); };
    window.addEventListener('error', onError);
    try {
      document.dispatchEvent(new MouseEvent('mouseenter'));
      document.dispatchEvent(new MouseEvent('click'));
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener('error', onError);
      getRouter()!.destroy();
    }
  });
});
