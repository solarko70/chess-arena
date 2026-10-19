/**
 * Accuracy Ring SVG component.
 * Calculates SVG stroke-dashoffset and renders an animated circular accuracy gauge.
 */

export const RING_RADIUS = 28;
export const RING_CIRCUMFERENCE = 175.93; // 2 * Math.PI * 28

/**
 * Calculates stroke-dashoffset for a given accuracy percentage [0, 100].
 */
export function calculateRingOffset(accuracy: number): number {
  const clamped = Math.max(0, Math.min(100, accuracy));
  return RING_CIRCUMFERENCE * (1 - clamped / 100);
}

export interface AccuracyRingOptions {
  size?: number;
  radius?: number;
  valueId?: string;
  className?: string;
}

export interface AccuracyRingDom {
  wrapEl: HTMLElement;
  svgEl: SVGSVGElement;
  bgCircle: SVGCircleElement;
  progressCircle: SVGCircleElement;
  valueEl: HTMLElement;
  update: (accuracy: number | null, isReviewing?: boolean) => void;
}

/**
 * Creates a circular accuracy indicator with animated SVG progress ring.
 */
export function createAccuracyRing(options: AccuracyRingOptions = {}): AccuracyRingDom {
  const size = options.size ?? 72;
  const radius = options.radius ?? RING_RADIUS;
  const center = size / 2;

  const wrapEl = document.createElement('div');
  wrapEl.className = `card-accuracy-ring-wrap ${options.className ?? ''}`.trim();

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('class', 'accuracy-ring-svg');
  svgEl.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svgEl.setAttribute('aria-hidden', 'true');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('class', 'ring-bg');
  bgCircle.setAttribute('cx', center.toString());
  bgCircle.setAttribute('cy', center.toString());
  bgCircle.setAttribute('r', radius.toString());
  svgEl.appendChild(bgCircle);

  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('class', 'ring-progress');
  progressCircle.setAttribute('cx', center.toString());
  progressCircle.setAttribute('cy', center.toString());
  progressCircle.setAttribute('r', radius.toString());
  progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progressCircle.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
  svgEl.appendChild(progressCircle);

  wrapEl.appendChild(svgEl);

  const valueEl = document.createElement('div');
  valueEl.className = 'card-accuracy-val';
  if (options.valueId) {
    valueEl.id = options.valueId;
  }
  valueEl.innerHTML = '<span class="skeleton-pill skeleton-acc"></span>';
  wrapEl.appendChild(valueEl);

  const update = (accuracy: number | null, isReviewing = false): void => {
    if (accuracy !== null && !isNaN(accuracy)) {
      const accText = `${accuracy.toFixed(1)}%`;
      if (valueEl.textContent !== accText) {
        valueEl.textContent = accText;
        valueEl.classList.add('fade-in');
      }

      const offset = calculateRingOffset(accuracy);
      progressCircle.style.strokeDashoffset = offset.toFixed(2);
      progressCircle.classList.remove('ring-high', 'ring-mid', 'ring-low');

      if (accuracy >= 85) {
        progressCircle.classList.add('ring-high');
      } else if (accuracy >= 70) {
        progressCircle.classList.add('ring-mid');
      } else {
        progressCircle.classList.add('ring-low');
      }
    } else {
      if (isReviewing) {
        if (!valueEl.querySelector('.skeleton-pill')) {
          valueEl.innerHTML = '<span class="skeleton-pill skeleton-acc"></span>';
          valueEl.classList.remove('fade-in');
        }
      } else {
        valueEl.textContent = '—';
        valueEl.classList.remove('fade-in');
      }
      progressCircle.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
      progressCircle.classList.remove('ring-high', 'ring-mid', 'ring-low');
    }
  };

  return {
    wrapEl,
    svgEl,
    bgCircle,
    progressCircle,
    valueEl,
    update,
  };
}

