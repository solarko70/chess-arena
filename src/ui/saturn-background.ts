let activeCleanup: (() => void) | null = null;
let sceneSequence = 0;

/** Mounts one isolated scene; its cleanup cannot dispose a later scene. */
export function mountSaturnBackground(container: HTMLElement): () => void {
  unmountSaturnBackground();
  if (typeof document === 'undefined' || !container?.ownerDocument?.defaultView) return () => {};
  const doc = container.ownerDocument;
  const wrapper = doc.createElement('div');
  const gradientId = `solar-rim-${++sceneSequence}`;
  wrapper.className = 'saturn-scene-wrapper solar-singularity-scene solar-theme-scene';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `<svg class="solar-rim-static solar-singularity-corona" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${gradientId}-halo">
          <stop offset="0.75" stop-color="var(--solar-singularity-rim-gold)" stop-opacity="0"/>
          <stop offset="0.79" stop-color="var(--solar-singularity-rim-gold)" stop-opacity="0.18"/>
          <stop offset="0.815" stop-color="var(--solar-singularity-hot)" stop-opacity="0.6"/>
          <stop offset="0.86" stop-color="var(--solar-singularity-corona-edge)" stop-opacity="0.12"/>
          <stop offset="1" stop-color="var(--solar-singularity-corona-edge)" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${gradientId}-gold" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="var(--solar-singularity-rim-gold)"/>
          <stop offset="1" stop-color="var(--solar-singularity-corona-edge)"/>
        </linearGradient>
      </defs>
      <circle cx="320" cy="320" r="300" fill="url(#${gradientId}-halo)"/>
      <circle class="solar-singularity-disk" cx="320" cy="320" r="244" fill="var(--solar-singularity-core)"/>
      <circle cx="320" cy="320" r="244" fill="none" stroke="url(#${gradientId}-gold)" stroke-width="1.25" vector-effect="non-scaling-stroke"/>
    </svg>
    <svg class="solar-orbits-spinning solar-singularity-orbits" viewBox="0 0 1000 1000" fill="none" aria-hidden="true" focusable="false">
      <circle cx="500" cy="500" r="320" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <circle cx="500" cy="500" r="380" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <circle cx="500" cy="500" r="440" stroke-width="1" stroke-dasharray="4 12" vector-effect="non-scaling-stroke"/>
      <circle cx="500" cy="500" r="490" stroke-width="1" vector-effect="non-scaling-stroke"/>
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
