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
    <svg class="solar-orbits-spinning solar-singularity-orbits" viewBox="0 0 1000 1000" fill="none" text-rendering="geometricPrecision" shape-rendering="geometricPrecision" aria-hidden="true" focusable="false">
      <g class="solar-orbit-near" aria-hidden="true">
        <circle cx="500" cy="500" r="320" stroke-width="1" vector-effect="non-scaling-stroke"/>
      </g>
      <g class="solar-orbit-inner" aria-hidden="true">
        <line class="solar-radial-beam" x1="880" y1="500" x2="3380" y2="500" stroke-width="1" vector-effect="non-scaling-stroke" aria-hidden="true"/>
        <line class="solar-radial-beam" x1="500" y1="880" x2="500" y2="3380" stroke-width="1" vector-effect="non-scaling-stroke" aria-hidden="true"/>
        <line class="solar-radial-beam" x1="120" y1="500" x2="-2380" y2="500" stroke-width="1" vector-effect="non-scaling-stroke" aria-hidden="true"/>
        <line class="solar-radial-beam" x1="500" y1="120" x2="500" y2="-2380" stroke-width="1" vector-effect="non-scaling-stroke" aria-hidden="true"/>
        <circle cx="500" cy="500" r="380" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="115.5" y1="500" x2="124.5" y2="500" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="875.5" y1="500" x2="884.5" y2="500" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="500" y1="875.5" x2="500" y2="884.5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="500" y1="115.5" x2="500" y2="124.5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="877" y1="500" x2="883" y2="500" transform="rotate(45 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="877" y1="500" x2="883" y2="500" transform="rotate(135 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="877" y1="500" x2="883" y2="500" transform="rotate(225 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="877" y1="500" x2="883" y2="500" transform="rotate(315 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <text class="solar-orbit-label solar-orbit-label-180" x="132" y="500" transform="rotate(90 132 500)" dominant-baseline="central" text-anchor="middle" text-rendering="geometricPrecision" shape-rendering="geometricPrecision" aria-hidden="true">180°</text>
      </g>
      <g class="solar-orbit-outer" aria-hidden="true">
        <circle cx="500" cy="500" r="440" stroke-width="1" stroke-dasharray="4 12" vector-effect="non-scaling-stroke"/>
        <circle cx="500" cy="500" r="490" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="985.5" y1="500" x2="994.5" y2="500" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="5.5" y1="500" x2="14.5" y2="500" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="500" y1="985.5" x2="500" y2="994.5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-major" x1="500" y1="5.5" x2="500" y2="14.5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="987" y1="500" x2="993" y2="500" transform="rotate(45 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="987" y1="500" x2="993" y2="500" transform="rotate(135 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="987" y1="500" x2="993" y2="500" transform="rotate(225 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="solar-orbit-tick solar-orbit-tick-minor" x1="987" y1="500" x2="993" y2="500" transform="rotate(315 500 500)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <text class="solar-orbit-label solar-orbit-label-360" x="978" y="500" transform="rotate(270 978 500)" dominant-baseline="central" text-anchor="middle" text-rendering="geometricPrecision" shape-rendering="geometricPrecision" aria-hidden="true">360°</text>
      </g>
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
