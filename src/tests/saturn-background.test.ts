import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('mounts an aria-hidden SVG scene without adding keyboard stops', () => {
    mountSaturnBackground(container);
    const wrapper = container.querySelector('.saturn-scene-wrapper');
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    expect(wrapper?.querySelector('[tabindex], button, a')).toBeNull();
    expect(wrapper?.querySelector('.saturn-hitbox')).not.toBeNull();
  });

  it('builds ordered planet and ring layers with atmosphere, divisions and shadows', () => {
    mountSaturnBackground(container);
    const svg = container.querySelector('svg')!;
    const layers = [...svg.children].map((element) => element.getAttribute('class'));
    expect(layers.slice(1, 5)).toEqual([
      'saturn-rings saturn-rings-back saturn-ring-depth',
      'saturn-planet saturn-planet-depth',
      'saturn-rings saturn-rings-front saturn-ring-depth',
      'saturn-planet-shadow saturn-ring-depth',
    ]);
    expect(svg.querySelectorAll('.saturn-atmosphere path').length).toBeGreaterThan(50);
    expect(svg.querySelectorAll('[data-ring="C"] path').length).toBeGreaterThan(20);
    expect(svg.querySelector('[data-ring="B"]')).not.toBeNull();
    expect(svg.querySelectorAll('[data-ring="A"]').length).toBe(2);
    expect(svg.querySelector('.saturn-ring-shadow')).not.toBeNull();
    expect(svg.querySelectorAll('radialGradient, linearGradient').length).toBeGreaterThan(3);
    expect([...svg.querySelectorAll('[fill]')].every((el) =>
      /^(var\(--solar-|url\(#|none$)/.test(el.getAttribute('fill')!))).toBe(true);
  });

  it('unmount removes the DOM, frame and exactly the listeners installed by mount', () => {
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const cleanup = mountSaturnBackground(container);
    const hitbox = container.querySelector('.saturn-hitbox')!;
    const removeHitbox = vi.spyOn(hitbox, 'removeEventListener');
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 600 }));
    expect(frames.size).toBe(1);
    cleanup();
    cleanup();
    expect(container.querySelector('.saturn-scene-wrapper')).toBeNull();
    expect(frames.size).toBe(0);
    for (const type of ['mousemove', 'resize']) {
      const listener = addWindow.mock.calls.find(([name]) => name === type)![1];
      expect(removeWindow).toHaveBeenCalledWith(type, listener);
    }
    const listener = addDocument.mock.calls.find(([name]) => name === 'visibilitychange')![1];
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', listener);
    expect(removeHitbox).toHaveBeenCalledWith('mouseenter', expect.any(Function));
    expect(removeHitbox).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('a stale cleanup cannot remove a newly mounted scene', () => {
    const oldCleanup = mountSaturnBackground(container);
    const oldId = container.querySelector('linearGradient')?.id;
    mountSaturnBackground(container);
    oldCleanup();
    expect(container.querySelectorAll('.saturn-scene-wrapper')).toHaveLength(1);
    expect(container.querySelector('linearGradient')?.id).not.toBe(oldId);
    unmountSaturnBackground();
    unmountSaturnBackground();
    expect(container.children).toHaveLength(0);
  });

  it('smooths and clamps pointer motion, then stops requesting frames at rest', () => {
    mountSaturnBackground(container);
    const wrapper = container.querySelector<HTMLElement>('.saturn-scene-wrapper')!;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50000, clientY: -50000 }));
    advanceFrames(1);
    const firstX = parseFloat(wrapper.style.getPropertyValue('--saturn-x'));
    expect(firstX).toBeGreaterThan(0);
    expect(firstX).toBeLessThan(10);
    advanceFrames();
    expect(wrapper.style.getPropertyValue('--saturn-x')).toBe('10.000px');
    expect(wrapper.style.getPropertyValue('--saturn-y')).toBe('-10.000px');
    expect(wrapper.style.getPropertyValue('--saturn-rotate-x')).toBe('3.500deg');
    expect(wrapper.style.getPropertyValue('--saturn-rotate-y')).toBe('3.500deg');
    expect(frames.size).toBe(0);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    advanceFrames();
    expect(wrapper.style.getPropertyValue('--saturn-x')).toBe('0.000px');
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
    expect(container.querySelector<HTMLElement>('.saturn-scene-wrapper')!
      .style.getPropertyValue('--saturn-x')).toBe('0.000px');
  });

  it('plays one procedural hover tick and clears the warming effect on leave', () => {
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    const hitbox = container.querySelector('.saturn-hitbox')!;
    hitbox.dispatchEvent(new MouseEvent('mouseenter'));
    expect(hover).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.saturn-hovered')).not.toBeNull();
    hitbox.dispatchEvent(new MouseEvent('mouseleave'));
    expect(container.querySelector('.saturn-hovered')).toBeNull();
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
    expect(frames.size).toBe(0);
    unmountSaturnBackground();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1]);
  });

  it('respects disabled background animation without scheduling work', () => {
    document.body.classList.add('bg-anim-off');
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('works in JSDOM without Web Audio, matchMedia or requestAnimationFrame', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal('requestAnimationFrame', undefined);
    const nodes = vi.spyOn(solarAudio, 'ensureContext');
    mountSaturnBackground(container);
    expect(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
      container.querySelector('.saturn-hitbox')!.dispatchEvent(new MouseEvent('mouseenter'));
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
