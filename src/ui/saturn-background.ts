let activeCleanup: (() => void) | null = null;

/** Mounts one isolated scene; its cleanup cannot dispose a later scene. */
export function mountSaturnBackground(container: HTMLElement): () => void {
  unmountSaturnBackground();
  if (typeof document === 'undefined' || !container?.ownerDocument?.defaultView) return () => {};
  const doc = container.ownerDocument;
  const wrapper = doc.createElement('div');
  wrapper.className = 'saturn-scene-wrapper solar-singularity-scene solar-theme-scene';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `<div class="solar-singularity-corona corona-pulse" aria-hidden="true"></div>
    <div class="solar-singularity-disk" aria-hidden="true"></div>
    <div class="solar-singularity-orbits" aria-hidden="true"></div>
    <svg class="solar-singularity-sparks" viewBox="0 0 320 180" aria-hidden="true" focusable="false">
      <path d="M32 32v8m-4-4h8 M130 12v12m-6-6h12 M238 80v8m-4-4h8 M284 147v6m-3-3h6" fill="none" stroke="currentColor" stroke-width="0.8" aria-hidden="true"/>
    </svg>`;
  container.prepend(wrapper);
  let disposed = false;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    wrapper.remove();
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;
  return cleanup;
}

export function unmountSaturnBackground(): void {
  activeCleanup?.();
}
