import { getPieceSvg } from '@/ui/pieces';

export interface SolarDecorOptions {
  className?: string;
  width?: number;
  height?: number;
  orbitsCount?: number;
  starsCount?: number;
  withAnimatedPieces?: boolean;
  opacity?: number;
}

export interface SolarDecorElement extends HTMLElement {
  destroy: () => void;
}

/**
 * Creates a reusable solar decorative layer with static SVG orbits/stars
 * and optional orbiting chess pieces. Guaranteed to contain <= 12 SVG child nodes.
 */
export function createSolarDecorLayer(options: SolarDecorOptions = {}): SolarDecorElement {
  const layer = document.createElement('div') as unknown as SolarDecorElement;
  layer.className = `solar-decor-layer ${options.className ?? ''}`.trim();
  layer.setAttribute('aria-hidden', 'true');
  layer.style.pointerEvents = 'none';

  if (typeof options.opacity === 'number') {
    layer.style.opacity = options.opacity.toString();
  }

  const width = options.width ?? 680;
  const height = options.height ?? 180;
  const orbitsCount = Math.min(4, Math.max(2, options.orbitsCount ?? 4));
  const starsCount = Math.min(6, Math.max(3, options.starsCount ?? 6));

  // 1. Static SVG layer (max 4 ellipses + 6 circles = 10 child nodes <= 12)
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('width', '100%');
  svgEl.setAttribute('height', '100%');
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.setAttribute('fill', 'none');
  svgEl.setAttribute('aria-hidden', 'true');

  const cx = width / 2;
  const cy = 0;
  const orbitRadii = [
    { rx: 140, ry: 45 },
    { rx: 220, ry: 75 },
    { rx: 300, ry: 105 },
    { rx: 380, ry: 135 },
  ];

  for (let i = 0; i < orbitsCount; i++) {
    const { rx, ry } = orbitRadii[i];
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', cx.toString());
    ellipse.setAttribute('cy', cy.toString());
    ellipse.setAttribute('rx', rx.toString());
    ellipse.setAttribute('ry', ry.toString());
    ellipse.setAttribute('class', 'solar-modal-orbit');
    svgEl.appendChild(ellipse);
  }

  const starCoords = [
    { x: 120, y: 40, r: 1.5 },
    { x: 180, y: 95, r: 1.0 },
    { x: 260, y: 35, r: 1.5 },
    { x: 420, y: 45, r: 1.0 },
    { x: 500, y: 110, r: 1.5 },
    { x: 580, y: 30, r: 1.0 },
  ];

  for (let i = 0; i < starsCount; i++) {
    const { x, y, r } = starCoords[i];
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x.toString());
    circle.setAttribute('cy', y.toString());
    circle.setAttribute('r', r.toString());
    circle.setAttribute('class', 'solar-modal-star');
    svgEl.appendChild(circle);
  }

  layer.appendChild(svgEl);

  // 2. Optional animated moving pieces on orbits (strictly <= 4 moving elements)
  if (options.withAnimatedPieces) {
    const piecesContainer = document.createElement('div');
    piecesContainer.className = 'modal-orbits-container';

    const pieceTypes: ('pawn' | 'knight' | 'bishop' | 'rook')[] = ['pawn', 'knight', 'bishop', 'rook'];
    for (let i = 0; i < orbitsCount && i < 4; i++) {
      const orbitEl = document.createElement('div');
      orbitEl.className = `modal-moving-orbit modal-moving-orbit-${i + 1}`;

      const counterEl = document.createElement('div');
      counterEl.className = 'modal-piece-counter';
      counterEl.innerHTML = getPieceSvg(pieceTypes[i], 'white');

      orbitEl.appendChild(counterEl);
      piecesContainer.appendChild(orbitEl);
    }

    layer.appendChild(piecesContainer);
  }

  // 3. Document visibility change listener to pause animations when tab is backgrounded
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      layer.classList.add('solar-anim-paused');
    } else {
      layer.classList.remove('solar-anim-paused');
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);

  // Initial state check in case tab was launched in background
  if (typeof document !== 'undefined' && document.hidden) {
    layer.classList.add('solar-anim-paused');
  }

  layer.destroy = (): void => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    layer.remove();
  };

  return layer;
}
