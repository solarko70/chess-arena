import { solarAudio } from '@/audio/solar-audio';

const PARALLAX_LIMIT = 10;
const SETTLE_DISTANCE = 0.001;
const LAYER_DEPTHS = [1, 0.65, 0.35] as const;
let activeCleanup: (() => void) | null = null;

function sceneMarkup(): string {
  return `<div class="solar-singularity-corona corona-pulse" aria-hidden="true"></div>
    <div class="solar-singularity-disk" aria-hidden="true"></div>
    <div class="solar-singularity-orbits" aria-hidden="true"></div>`;
}

/** Write only composite transforms; inherited variables would restyle the painted layers. */
function setParallax(layers: HTMLElement[], x: number, y: number): void {
  layers.forEach((layer, index) => {
    const dx = (x * PARALLAX_LIMIT * LAYER_DEPTHS[index]).toFixed(3);
    const dy = (y * PARALLAX_LIMIT * LAYER_DEPTHS[index]).toFixed(3);
    layer.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0)`;
  });
}

/** Mounts one isolated scene; its cleanup cannot dispose a later scene. */
export function mountSaturnBackground(container: HTMLElement): () => void {
  unmountSaturnBackground();
  if (typeof document === 'undefined' || !container?.ownerDocument?.defaultView) return () => {};
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  const wrapper = doc.createElement('div');
  wrapper.className = 'saturn-scene-wrapper solar-singularity-scene';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = sceneMarkup();
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
  const layers = [...wrapper.children] as HTMLElement[];
  const disk = wrapper.querySelector<HTMLElement>('.solar-singularity-disk')!;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let bounds = container.getBoundingClientRect();
  let core = disk.getBoundingClientRect();
  let frame: number | null = null;
  let x = 0, y = 0, targetX = 0, targetY = 0;
  let pointerX = 0, pointerY = 0, pointerBlocked = false;
  let hovering = false;
  const hoverAllowed = (): boolean => !doc.hidden && !wrapper.classList.contains('saturn-scene-leaving');
  const motionAllowed = (): boolean => !doc.hidden && !media?.matches &&
    !doc.body.classList.contains('bg-anim-off') && !wrapper.classList.contains('saturn-scene-leaving');
  const cancelFrame = (): void => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  };
  const animate = (): void => {
    frame = null;
    updateHover();
    if (!motionAllowed()) return;
    x += (targetX - x) * 0.075;
    y += (targetY - y) * 0.075;
    const settled = Math.abs(targetX - x) + Math.abs(targetY - y) < SETTLE_DISTANCE;
    if (settled) { x = targetX; y = targetY; }
    setParallax(layers, x, y);
    if (!settled) schedule();
  };
  const schedule = (): void => {
    if (frame === null && typeof win.requestAnimationFrame === 'function' && hoverAllowed()) {
      frame = win.requestAnimationFrame(animate);
    }
  };
  const resetMotion = (): void => {
    cancelFrame();
    x = y = targetX = targetY = 0;
    setParallax(layers, 0, 0);
    hovering = false;
    wrapper.classList.remove('solar-singularity-hovered');
  };
  const updateHover = (): void => {
    const radius = Math.min(core.width, core.height) * 0.56;
    const dx = pointerX - (core.left + core.width / 2 + x * PARALLAX_LIMIT * LAYER_DEPTHS[1]);
    const dy = pointerY - (core.top + core.height / 2 + y * PARALLAX_LIMIT * LAYER_DEPTHS[1]);
    const next = hoverAllowed() && !pointerBlocked && radius > 0 &&
      pointerX >= bounds.left + bounds.width / 2 && dx * dx + dy * dy <= radius * radius;
    if (next === hovering) return;
    hovering = next;
    wrapper.classList.toggle('solar-singularity-hovered', next);
    if (next) solarAudio.playButtonHover();
  };
  const onMove = (event: MouseEvent): void => {
    if (!hoverAllowed()) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    const target = event.target as Element | null;
    pointerBlocked = typeof target?.closest === 'function' &&
      Boolean(target.closest('button, input, select, textarea, [role="dialog"], [role="button"]'));
    const clamp = (n: number): number => Math.max(-1, Math.min(1, n));
    targetX = clamp(((event.clientX - bounds.left) / (bounds.width || win.innerWidth || 1)) * 2 - 1);
    targetY = clamp(((event.clientY - bounds.top) / (bounds.height || win.innerHeight || 1)) * 2 - 1);
    schedule();
  };
  const onLeave = (): void => { pointerBlocked = true; targetX = targetY = 0; schedule(); };
  const onResize = (): void => {
    resetMotion();
    bounds = container.getBoundingClientRect();
    core = disk.getBoundingClientRect();
  };
  const onVisibility = (): void => {
    wrapper.classList.toggle('solar-anim-paused', doc.hidden);
    resetMotion();
  };
  win.addEventListener('mousemove', onMove, { passive: true });
  win.addEventListener('resize', onResize, { passive: true });
  win.addEventListener('blur', resetMotion);
  doc.documentElement.addEventListener('mouseleave', onLeave);
  doc.addEventListener('visibilitychange', onVisibility);
  media?.addEventListener?.('change', resetMotion);
  onVisibility();
  return (): void => {
    cancelFrame();
    win.removeEventListener('mousemove', onMove);
    win.removeEventListener('resize', onResize);
    win.removeEventListener('blur', resetMotion);
    doc.documentElement.removeEventListener('mouseleave', onLeave);
    doc.removeEventListener('visibilitychange', onVisibility);
    media?.removeEventListener?.('change', resetMotion);
  };
}

export function unmountSaturnBackground(): void {
  activeCleanup?.();
}
