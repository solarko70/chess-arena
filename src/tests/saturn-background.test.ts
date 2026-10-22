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
  let previousTheme: string | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    document.body.classList.remove('bg-anim-off');
    previousTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme');
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
    if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', previousTheme);
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

  function palette(light: boolean): Map<string, string> {
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    const block = light ? css.match(/\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)![1]
      : css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
    return new Map([...block.matchAll(/(--solar-[\w-]+):\s*([^;]+);/g)]
      .map(match => [match[1], match[2].trim()]));
  }

  function contrast(first: string, second: string): number {
    const luminance = (hex: string): number => {
      const channels = hex.match(/[\da-f]{2}/gi)!.map(value => parseInt(value, 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  it('exports only mount and unmount with no audio, layout, event or frame dependencies', () => {
    const source = readFileSync(resolve(__dirname, '../ui/saturn-background.ts'), 'utf8');
    expect(source.match(/export function /g)).toHaveLength(2);
    expect(source).not.toMatch(/addEventListener|removeEventListener|requestAnimationFrame|cancelAnimationFrame/);
    expect(source).not.toMatch(/getBoundingClientRect|solarAudio|mousemove|pointermove|matchMedia/);
  });

  it('provides theme palettes with AA contrast for menu text and button states', () => {
    for (const light of [false, true]) {
      const colors = palette(light);
      const text = colors.get('--solar-menu-text')!;
      for (const background of ['--solar-menu-button', '--solar-menu-button-hover',
        '--solar-singularity-space', '--solar-singularity-indigo', '--solar-singularity-core']) {
        expect(contrast(text, colors.get(background)!)).toBeGreaterThanOrEqual(4.5);
      }
    }
    const light = palette(true);
    expect(contrast(light.get('--solar-menu-text')!, light.get('--solar-singularity-corona-edge')!))
      .toBeGreaterThanOrEqual(4.5);
    expect(palette(false).get('--solar-bg-dark')).toBe('#070412');
    expect(light.get('--solar-singularity-abyss')).toBe('#e2e8f0');
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    const buttonRule = css.match(/\.screen-home \.btn-menu\s*\{([^}]+)\}/)![1];
    expect(buttonRule).toMatch(/transition:\s*transform[^;]+;/);
    const transitions = buttonRule.match(/transition:([^;]+);/)![1]
      .split(',').map(value => value.trim().split(/\s+/)[0]);
    expect(transitions).not.toContain('background');
    expect(transitions).not.toContain('background-color');
    expect(transitions).not.toContain('color');
  });

  it('inherits live theme changes without remounting or duplicating scene nodes', () => {
    mountSaturnBackground(container);
    const scene = container.querySelector('.solar-theme-scene')!;
    const markup = scene.outerHTML;
    document.documentElement.setAttribute('data-theme', 'light');
    expect(scene.matches('[data-theme="light"] .solar-theme-scene')).toBe(true);
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(scene.matches('[data-theme="dark"] .solar-theme-scene')).toBe(true);
    expect(container.querySelector('.solar-theme-scene')).toBe(scene);
    expect(scene.outerHTML).toBe(markup);
    expect(scene.hasAttribute('data-theme')).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('recognizes explicit dark theme and switches both ways through the menu toggle', () => {
    vi.useFakeTimers();
    container.id = 'app';
    window.location.hash = '#/';
    document.documentElement.setAttribute('data-theme', 'dark');
    initApp();
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('light');
    const scene = container.querySelector('.solar-theme-scene');
    document.getElementById('theme-btn')!.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    document.getElementById('theme-btn')!.click();
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('light');
    expect(container.querySelector('.solar-theme-scene')).toBe(scene);
  });

  it('mounts an aria-hidden CSS scene without adding keyboard stops', () => {
    mountSaturnBackground(container);
    const wrapper = container.querySelector('.saturn-scene-wrapper');
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.classList.contains('solar-singularity-scene')).toBe(true);
    expect(wrapper?.classList.contains('solar-theme-scene')).toBe(true);
    expect(wrapper?.querySelector('[tabindex], button, a')).toBeNull();
    expect(wrapper?.querySelector('canvas, img')).toBeNull();
    expect(wrapper?.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });

  it('builds ordered corona, dark disk and coordinate orbit layers over the abyss', () => {
    mountSaturnBackground(container);
    const scene = container.querySelector('.solar-singularity-scene')!;
    const layers = [...scene.querySelectorAll(':scope > div')]
      .map((element) => element.getAttribute('class'));
    expect(layers).toEqual([
      'solar-singularity-corona corona-pulse',
      'solar-singularity-disk',
      'solar-singularity-orbits',
    ]);
    for (const element of [scene, ...scene.querySelectorAll('*')]) {
      expect(element.getAttribute('aria-hidden')).toBe('true');
    }
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    expect(css).toMatch(/\.solar-singularity-scene\s*\{[^}]*background:\s*radial-gradient/);
    expect(css).toMatch(/\.solar-singularity-disk\s*\{[^}]*background:\s*radial-gradient/);
    expect(scene.querySelector('.solar-singularity-sparks path')).not.toBeNull();
    expect(css).toContain("content: '180\\00b0 / 07'");
  });

  it('unmount removes the DOM without allocating frames or installing listeners', () => {
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const addRoot = vi.spyOn(document.documentElement, 'addEventListener');
    const removeRoot = vi.spyOn(document.documentElement, 'removeEventListener');
    const cleanup = mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 600 }));
    expect(frames.size).toBe(0);
    cleanup();
    cleanup();
    expect(container.querySelector('.saturn-scene-wrapper')).toBeNull();
    expect(frames.size).toBe(0);
    expect(addWindow).not.toHaveBeenCalled();
    expect(removeWindow).not.toHaveBeenCalled();
    expect(addDocument.mock.calls.filter(([name]) => name === 'visibilitychange')).toHaveLength(0);
    expect(removeDocument).not.toHaveBeenCalled();
    expect(addRoot).not.toHaveBeenCalled();
    expect(removeRoot).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
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

  it('ignores extreme pointer motion without requesting frames or writing transforms', () => {
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50000, clientY: -50000 }));
    advanceFrames(1);
    expect(corona.style.transform).toBe('');
    advanceFrames();
    expect(corona.style.transform).toBe('');
    expect(corona.style.length).toBe(0);
    expect(container.querySelector<HTMLElement>('.solar-singularity-disk')!.style.transform)
      .toBe('');
    expect(frames.size).toBe(0);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    advanceFrames();
    expect(corona.style.transform).toBe('');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('leaves responsive sizing to CSS without reading layout on mount or resize', () => {
    const measure = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 400, height: 200,
    } as DOMRect);
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300 }));
    expect(frames.size).toBe(0);
    window.dispatchEvent(new Event('resize'));
    expect(measure).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 200 }));
    advanceFrames();
    expect(container.querySelector<HTMLElement>('.solar-singularity-corona')!.style.transform)
      .toBe('');
  });

  it('ignores pointer bursts without allocating frames, reading layout or writing styles', () => {
    const measure = vi.spyOn(container, 'getBoundingClientRect');
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    const transformWrites = vi.spyOn(corona.style, 'transform', 'set');
    const diskMeasure = vi.spyOn(container.querySelector<HTMLElement>('.solar-singularity-disk')!, 'getBoundingClientRect');
    for (let i = 0; i < 200; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: i * 20, clientY: 900 }));
    }
    expect(frames.size).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
    expect(transformWrites).not.toHaveBeenCalled();
    advanceFrames();
    expect(measure).not.toHaveBeenCalled();
    expect(corona.style.transform).toBe('');
    expect(diskMeasure).not.toHaveBeenCalled();
  });

  it('limits the scene to six elements including one static SVG path for star sparks', () => {
    mountSaturnBackground(container);
    const scene = container.querySelector('.solar-singularity-scene')!;
    expect(1 + scene.querySelectorAll('*').length).toBeLessThanOrEqual(6);
    expect(scene.children).toHaveLength(4);
    expect(scene.querySelectorAll('svg')).toHaveLength(1);
    expect(scene.querySelectorAll('svg path')).toHaveLength(1);
    expect(scene.querySelector('canvas, img, [tabindex], filter, radialGradient')).toBeNull();
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
    expect(wrapper).toContain('user-select: none');
    expect(wrapper).toContain('will-change: transform, opacity');
    expect(css).toMatch(/\.corona-pulse::before\s*\{[^}]*animation:\s*solar-glow-breathe 9s/);
    const pulse = css.match(/@keyframes solar-glow-breathe\s*\{([\s\S]*?)\n\}/)![1];
    expect(pulse).toContain('scale(0.99)');
    expect(pulse).toContain('scale(1.01)');
    expect(pulse).toContain('opacity: 0.75');
    expect(css).toContain('animation: orbit-slow-spin 120s linear infinite');
    expect([...pulse.matchAll(/([\w-]+)\s*:/g)].map(match => match[1]))
      .toEqual(['transform', 'opacity', 'transform', 'opacity']);
    mountSaturnBackground(container);
    expect(container.querySelector('svg')?.classList.contains('solar-singularity-sparks')).toBe(true);
  });

  it('never plays hover audio or changes corona classes on pointer entry and leave', () => {
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 350 }));
    advanceFrames();
    expect(hover).not.toHaveBeenCalled();
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 810, clientY: 350 }));
    advanceFrames();
    expect(hover).not.toHaveBeenCalled();
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    advanceFrames();
    expect(container.querySelector('.solar-singularity-hovered')).toBeNull();
  });

  it('ignores controls over the core and focus changes without any pending motion', () => {
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
    expect(hover).not.toHaveBeenCalled();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 350 }));
    expect(frames.size).toBe(0);
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

  it('keeps reduced-motion scenes inert on pointer movement without audio or style writes', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const hover = vi.spyOn(solarAudio, 'playButtonHover').mockImplementation(() => {});
    mountSaturnBackground(container);
    const corona = container.querySelector<HTMLElement>('.solar-singularity-corona')!;
    const transformWrites = vi.spyOn(corona.style, 'transform', 'set');
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 350 }));
    expect(frames.size).toBe(0);
    advanceFrames(1);
    expect(frames.size).toBe(0);
    expect(hover).not.toHaveBeenCalled();
    expect(transformWrites).not.toHaveBeenCalled();
  });

  it('does not allocate animation work when the document is hidden', () => {
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }));
    expect(frames.size).toBe(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    expect(container.querySelector('.solar-singularity-scene')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(frames.size).toBe(0);
  });

  it('delegates reduced motion to CSS without installing a preference listener', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }));
    expect(frames.size).toBe(0);
    media.matches = true;
    expect(media.addEventListener).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    window.dispatchEvent(new MouseEvent('mousemove'));
    advanceFrames();
    expect(frames.size).toBe(0);
    unmountSaturnBackground();
    expect(media.removeEventListener).not.toHaveBeenCalled();
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.corona-pulse::before,[\s\S]*?\.solar-singularity-orbits::after\s*\{\s*animation: none !important/);
  });

  it('respects disabled background animation without running a parallax loop', () => {
    document.body.classList.add('bg-anim-off');
    mountSaturnBackground(container);
    window.dispatchEvent(new MouseEvent('mousemove'));
    advanceFrames();
    expect(frames.size).toBe(0);
    expect(container.querySelector<HTMLElement>('.solar-singularity-corona')!.style.transform)
      .toBe('');
    const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
    expect(css).toMatch(/body\.bg-anim-off \.corona-pulse::before,[\s\S]*?animation: none !important/);
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
    expect(nodes).not.toHaveBeenCalled();
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
