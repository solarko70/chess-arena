import { solarAudio } from '@/audio/solar-audio';

const RING_FLATTENING = 0.275;
const PLANET_TRANSFORM = 'translate(1230 440) rotate(-24)';
const PARALLAX_LIMIT = 10;
const TILT_LIMIT = 3.5;
const SETTLE_DISTANCE = 0.001;
let sceneSequence = 0;
let activeCleanup: (() => void) | null = null;

/** An annulus leaves the Cassini and Encke divisions genuinely transparent. */
function annulus(inner: number, outer: number): string {
  const ellipse = (r: number): string =>
    `M ${-r} 0 a ${r} ${r * RING_FLATTENING} 0 1 0 ${2 * r} 0 a ${r} ${r * RING_FLATTENING} 0 1 0 ${-2 * r} 0`;
  return `${ellipse(outer)} ${ellipse(inner)}`;
}

function ringBands(): string {
  const regions = [
    { name: 'c', inner: 490, outer: 650, opacity: 0.32 },
    { name: 'b', inner: 653, outer: 878, opacity: 0.95 },
    { name: 'a', inner: 900, outer: 1053, opacity: 0.78 },
    { name: 'a', inner: 1059, outer: 1120, opacity: 0.7 },
  ];
  return regions.map(({ name, inner, outer, opacity }) => {
    const bands: string[] = [];
    for (let r = inner, i = 0; r < outer; i++) {
      const next = Math.min(outer, r + 2.2 + ((i * 7) % 9));
      bands.push(`<path d="${annulus(r, next)}" fill-rule="evenodd" fill="var(--solar-saturn-ring-${name}-${i % 3})" opacity="${opacity * (0.72 + (i % 5) * 0.055)}"/>`);
      r = next;
    }
    return `<g data-ring="${name.toUpperCase()}">${bands.join('')}</g>`;
  }).join('');
}

function atmosphereBands(): string {
  return Array.from({ length: 86 }, (_, i) => {
    const y = -352 + i * 8.3;
    const curve = 18 + Math.sin(i * 1.7) * 5;
    const thickness = 1.4 + ((i * 13) % 6);
    return `<path d="M -400 ${y} Q 0 ${y + curve} 400 ${y - 2} L 400 ${y + thickness} Q 0 ${y + curve + thickness} -400 ${y + thickness} Z" fill="var(--solar-saturn-band-${i % 4})" opacity="${0.1 + (i % 5) * 0.035}"/>`;
  }).join('');
}

function svgDefinitions(id: string): string {
  return `<defs>
    <linearGradient id="${id}-atmosphere" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="var(--solar-saturn-polar)"/>
      <stop offset="0.18" stop-color="var(--solar-saturn-sand)"/>
      <stop offset="0.33" stop-color="var(--solar-saturn-caramel)"/>
      <stop offset="0.46" stop-color="var(--solar-saturn-gold)"/>
      <stop offset="0.61" stop-color="var(--solar-saturn-sand)"/>
      <stop offset="0.78" stop-color="var(--solar-saturn-ochre)"/>
      <stop offset="1" stop-color="var(--solar-saturn-night)"/>
    </linearGradient>
    <radialGradient id="${id}-light" cx="76%" cy="18%" r="85%">
      <stop offset="0" stop-color="var(--solar-saturn-ivory)" stop-opacity="0.45"/>
      <stop offset="0.43" stop-color="var(--solar-saturn-ivory)" stop-opacity="0.04"/>
      <stop offset="0.63" stop-color="var(--solar-saturn-night)" stop-opacity="0.1"/>
      <stop offset="0.84" stop-color="var(--solar-saturn-night)" stop-opacity="0.82"/>
      <stop offset="1" stop-color="var(--solar-saturn-night)"/>
    </radialGradient>
    <linearGradient id="${id}-ring-shadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--solar-saturn-shadow)" stop-opacity="0"/>
      <stop offset="0.15" stop-color="var(--solar-saturn-shadow)" stop-opacity="0.55"/>
      <stop offset="0.68" stop-color="var(--solar-saturn-shadow)" stop-opacity="0.8"/>
      <stop offset="1" stop-color="var(--solar-saturn-shadow)" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="${id}-cast-shadow">
      <stop stop-color="var(--solar-saturn-shadow)" stop-opacity="0.08"/>
      <stop offset="0.45" stop-color="var(--solar-saturn-shadow)" stop-opacity="0.92"/>
      <stop offset="1" stop-color="var(--solar-saturn-shadow)"/>
    </linearGradient>
    <clipPath id="${id}-globe"><ellipse rx="385" ry="360"/></clipPath>
    <clipPath id="${id}-rear"><path d="M -1140 -340 H 1140 V 0 H -1140 Z"/></clipPath>
    <clipPath id="${id}-front"><path d="M -1140 0 H 1140 V 340 H -1140 Z"/></clipPath>
    <clipPath id="${id}-annulus"><path d="${annulus(490, 1120)}" clip-rule="evenodd"/></clipPath>
    <mask id="${id}-outside-globe" maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="4000" height="3000">
      <path d="M -1000 -1000 H 3000 V 2000 H -1000 Z" fill="var(--solar-saturn-mask-visible)"/>
      <ellipse transform="${PLANET_TRANSFORM}" rx="386" ry="361" fill="var(--solar-saturn-mask-hidden)"/>
    </mask>
    <g id="${id}-bands">${ringBands()}</g>
  </defs>`;
}

function sceneMarkup(id: string): string {
  return `<div class="saturn-parallax" aria-hidden="true"><div class="saturn-float" aria-hidden="true">
    <svg class="saturn-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      ${svgDefinitions(id)}
      <g class="saturn-rings saturn-rings-back saturn-ring-depth" aria-hidden="true">
        <g transform="${PLANET_TRANSFORM}" clip-path="url(#${id}-rear)"><use href="#${id}-bands"/></g>
      </g>
      <g class="saturn-planet saturn-planet-depth" aria-hidden="true">
        <g transform="${PLANET_TRANSFORM}"><g clip-path="url(#${id}-globe)">
          <ellipse rx="385" ry="360" fill="url(#${id}-atmosphere)"/>
          <g class="saturn-atmosphere">${atmosphereBands()}</g>
          <ellipse rx="385" ry="360" fill="url(#${id}-light)"/>
          <path class="saturn-ring-shadow" d="M -402 -78 Q -42 38 402 -38 L 402 8 Q -28 110 -402 -21 Z" fill="url(#${id}-ring-shadow)"/>
          <path d="M -390 -49 Q 0 66 390 -12" fill="none" stroke="var(--solar-saturn-shadow)" stroke-width="2" opacity="0.35"/>
        </g><ellipse rx="384" ry="359" fill="none" stroke="var(--solar-saturn-sand)" stroke-opacity="0.17" stroke-width="1.2"/></g>
      </g>
      <g class="saturn-rings saturn-rings-front saturn-ring-depth" aria-hidden="true">
        <g transform="${PLANET_TRANSFORM}" clip-path="url(#${id}-front)"><use href="#${id}-bands" opacity="0.92"/></g>
      </g>
      <g class="saturn-planet-shadow saturn-ring-depth" aria-hidden="true" mask="url(#${id}-outside-globe)">
        <g transform="${PLANET_TRANSFORM}" clip-path="url(#${id}-rear)"><g clip-path="url(#${id}-annulus)">
          <path d="M -1140 -160 Q -740 -324 -230 -225 L -240 38 H -1140 Z" fill="url(#${id}-cast-shadow)"/>
        </g></g>
      </g>
      <g class="saturn-ring-depth" aria-hidden="true"><g transform="${PLANET_TRANSFORM}">
        <ellipse class="saturn-ring-glow" rx="1120" ry="308" fill="none" stroke="var(--solar-saturn-gold)" stroke-width="1.8"/>
      </g></g>
      <g class="saturn-hitbox" aria-hidden="true">
        <g class="saturn-planet-depth"><ellipse class="saturn-hit-target" transform="${PLANET_TRANSFORM}" rx="385" ry="360" fill="var(--solar-saturn-transparent)"/></g>
        <g class="saturn-ring-depth"><path class="saturn-hit-target" transform="${PLANET_TRANSFORM}" d="${annulus(490, 1120)}" fill-rule="evenodd" fill="var(--solar-saturn-transparent)"/></g>
      </g>
    </svg>
  </div></div>`;
}

function setParallax(wrapper: HTMLElement, x: number, y: number): void {
  wrapper.style.setProperty('--saturn-x', `${(x * PARALLAX_LIMIT).toFixed(3)}px`);
  wrapper.style.setProperty('--saturn-y', `${(y * PARALLAX_LIMIT).toFixed(3)}px`);
  wrapper.style.setProperty('--saturn-rotate-x', `${(-y * TILT_LIMIT).toFixed(3)}deg`);
  wrapper.style.setProperty('--saturn-rotate-y', `${(x * TILT_LIMIT).toFixed(3)}deg`);
}

/** Mounts one isolated scene; its cleanup cannot dispose a later scene. */
export function mountSaturnBackground(container: HTMLElement): () => void {
  unmountSaturnBackground();
  if (typeof document === 'undefined' || !container?.ownerDocument?.defaultView) return () => {};
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  const wrapper = doc.createElement('div');
  wrapper.className = 'saturn-scene-wrapper';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = sceneMarkup(`solar-saturn-${++sceneSequence}`);
  container.prepend(wrapper);
  const removeInteraction = attachInteraction(wrapper, container, win);
  let disposed = false;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    removeInteraction();
    wrapper.remove();
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;
  return cleanup;
}

function attachInteraction(wrapper: HTMLElement, container: HTMLElement, win: Window): () => void {
  const doc = container.ownerDocument;
  const hitbox = wrapper.querySelector<SVGGElement>('.saturn-hitbox')!;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let bounds = container.getBoundingClientRect();
  let frame: number | null = null;
  let x = 0, y = 0, targetX = 0, targetY = 0;
  const motionAllowed = (): boolean => !doc.hidden && !media?.matches &&
    !doc.body.classList.contains('bg-anim-off') && !wrapper.classList.contains('saturn-scene-leaving');
  const cancelFrame = (): void => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  };
  const animate = (): void => {
    frame = null;
    if (!motionAllowed()) return resetMotion();
    x += (targetX - x) * 0.075;
    y += (targetY - y) * 0.075;
    const settled = Math.abs(targetX - x) + Math.abs(targetY - y) < SETTLE_DISTANCE;
    if (settled) { x = targetX; y = targetY; }
    setParallax(wrapper, x, y);
    if (!settled) schedule();
  };
  const schedule = (): void => {
    if (frame === null && typeof win.requestAnimationFrame === 'function' && motionAllowed()) {
      frame = win.requestAnimationFrame(animate);
    }
  };
  const resetMotion = (): void => {
    cancelFrame();
    x = y = targetX = targetY = 0;
    setParallax(wrapper, 0, 0);
    wrapper.classList.remove('saturn-hovered');
  };
  const onMove = (event: MouseEvent): void => {
    if (!motionAllowed()) return;
    const clamp = (n: number): number => Math.max(-1, Math.min(1, n));
    targetX = clamp(((event.clientX - bounds.left) / (bounds.width || win.innerWidth || 1)) * 2 - 1);
    targetY = clamp(((event.clientY - bounds.top) / (bounds.height || win.innerHeight || 1)) * 2 - 1);
    schedule();
  };
  const onLeave = (): void => { targetX = targetY = 0; schedule(); };
  const onResize = (): void => { bounds = container.getBoundingClientRect(); resetMotion(); };
  const onVisibility = (): void => {
    wrapper.classList.toggle('solar-anim-paused', doc.hidden);
    resetMotion();
  };
  const onHover = (): void => {
    if (doc.hidden || wrapper.classList.contains('saturn-scene-leaving')) return;
    wrapper.classList.add('saturn-hovered');
    solarAudio.playButtonHover();
  };
  const onHoverEnd = (): void => { wrapper.classList.remove('saturn-hovered'); };
  win.addEventListener('mousemove', onMove, { passive: true });
  win.addEventListener('resize', onResize, { passive: true });
  doc.documentElement.addEventListener('mouseleave', onLeave);
  doc.addEventListener('visibilitychange', onVisibility);
  media?.addEventListener?.('change', resetMotion);
  hitbox.addEventListener('mouseenter', onHover);
  hitbox.addEventListener('mouseleave', onHoverEnd);
  onVisibility();
  return (): void => {
    cancelFrame();
    win.removeEventListener('mousemove', onMove);
    win.removeEventListener('resize', onResize);
    doc.documentElement.removeEventListener('mouseleave', onLeave);
    doc.removeEventListener('visibilitychange', onVisibility);
    media?.removeEventListener?.('change', resetMotion);
    hitbox.removeEventListener('mouseenter', onHover);
    hitbox.removeEventListener('mouseleave', onHoverEnd);
  };
}

export function unmountSaturnBackground(): void {
  activeCleanup?.();
}
