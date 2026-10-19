/**
 * Space Scenes Generator for Game and Review Screens (Stage A2c-7 / A2c-8)
 * Provides deterministic celestial scenes with pointed star sparkles (<symbol>/<use>),
 * constellations, sun system, planetary cluster, solar eclipse, spiral galaxy,
 * comet, and lightweight isolated animation layers.
 */

// Seeded PRNG (mulberry32) for deterministic star generation
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ExclusionZone {
  cx: number;
  cy: number;
  r: number;
}

export interface RectZone {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SparklePlacement {
  symbolId: 'sparkle-s1' | 'sparkle-s2' | 'sparkle-s3' | 'sparkle-s4';
  x: number;
  y: number;
  size: number;
  variantClass: string;
  isTrio?: boolean;
}

export interface Constellation {
  name: string;
  points: Point[];
  edges: [number, number][];
  isSecondary?: boolean;
}

function isPointExcluded(
  x: number,
  y: number,
  circles: ExclusionZone[],
  rects: RectZone[]
): boolean {
  for (const c of circles) {
    const dx = x - c.cx;
    const dy = y - c.cy;
    if (dx * dx + dy * dy < c.r * c.r) {
      return true;
    }
  }
  for (const r of rects) {
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
      return true;
    }
  }
  return false;
}

export function generateStars(
  seed: number,
  circles: ExclusionZone[],
  rects: RectZone[],
  targetCount = 180,
  minDist = 20
): {
  small: Point[];
  medium: Point[];
  large: Point[];
  twinkleA: Point[];
  twinkleB: Point[];
  sparkles: Point[];
} {
  const rand = mulberry32(seed);
  const kept: Point[] = [];
  const maxAttempts = 2500;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < maxAttempts && kept.length < targetCount; i++) {
    const x = Math.round(rand() * 1900 + 10);
    const y = Math.round(rand() * 1060 + 10);

    if (isPointExcluded(x, y, circles, rects)) {
      continue;
    }

    let tooClose = false;
    for (const p of kept) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy < minDistSq) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      kept.push({ x, y });
    }
  }

  // Keep all stars in small/medium/large (and split ~60% into twinkleA/twinkleB + ~40% static)
  const small: Point[] = [];
  const medium: Point[] = [];
  const large: Point[] = [];
  const twinkleA: Point[] = [];
  const twinkleB: Point[] = [];

  kept.forEach((p, idx) => {
    const mod = idx % 10;
    if (mod < 3) {
      twinkleA.push(p);
    } else if (mod < 6) {
      twinkleB.push(p);
    }

    if (mod < 6) {
      small.push(p);
    } else if (mod < 9) {
      medium.push(p);
    } else {
      large.push(p);
    }
  });

  // Pick sparkles in free zones with clearance
  const sparkles: Point[] = [];
  for (let i = 0; i < 500 && sparkles.length < 8; i++) {
    const x = Math.round(rand() * 1860 + 30);
    const y = Math.round(rand() * 1020 + 30);
    if (isPointExcluded(x, y, circles, rects)) continue;

    let farEnough = true;
    for (const s of sparkles) {
      if (Math.hypot(x - s.x, y - s.y) < 120) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) {
      sparkles.push({ x, y });
    }
  }

  return { small, medium, large, twinkleA, twinkleB, sparkles };
}

function pointsToZeroLengthLines(pts: Point[]): string {
  return pts.map((p) => `M ${p.x} ${p.y} l 0 0`).join(' ');
}

function constellationsToLines(constellations: Constellation[]): string {
  const segments: string[] = [];
  for (const c of constellations) {
    for (const [i, j] of c.edges) {
      const p1 = c.points[i];
      const p2 = c.points[j];
      if (p1 && p2) {
        segments.push(`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
      }
    }
  }
  return segments.join(' ');
}

function constellationsToNodes(constellations: Constellation[]): string {
  const allPoints: Point[] = [];
  for (const c of constellations) {
    allPoints.push(...c.points);
  }
  return pointsToZeroLengthLines(allPoints);
}

/**
 * Shared <symbol> definitions for 4 pointed star types (S1, S2, S3, S4)
 * and soft radial halo gradient (radius 1.8x, max opacity <= 0.25, no blur).
 */
function buildSparkleDefs(): string {
  return `
        <radialGradient id="sparkle-halo-grad" cx="0" cy="0" r="1.8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--sparkle-halo)" stop-opacity="0.24" />
          <stop offset="100%" stop-color="var(--sparkle-halo)" stop-opacity="0" />
        </radialGradient>

        <!-- S1: 4-pointed concave star -->
        <symbol id="sparkle-s1" viewBox="-1 -1 2 2" overflow="visible">
          <circle cx="0" cy="0" r="1.8" fill="url(#sparkle-halo-grad)" />
          <path d="M0 -1 Q .10 -.10 1 0 Q .10 .10 0 1 Q -.10 .10 -1 0 Q -.10 -.10 0 -1 Z" fill="var(--sparkle-fill)" />
        </symbol>

        <!-- S2: 8-pointed star (S1 + 45deg rotated 0.55x scaled diagonal rays) -->
        <symbol id="sparkle-s2" viewBox="-1 -1 2 2" overflow="visible">
          <circle cx="0" cy="0" r="1.8" fill="url(#sparkle-halo-grad)" />
          <path d="M0 -1 Q .10 -.10 1 0 Q .10 .10 0 1 Q -.10 .10 -1 0 Q -.10 -.10 0 -1 Z M .39 -.39 Q .08 0 .39 .39 Q 0 .08 -.39 .39 Q -.08 0 -.39 -.39 Q 0 -.08 .39 -.39 Z" fill="var(--sparkle-fill)" />
        </symbol>

        <!-- S3: 6-pointed thin star (three thin rhombi at 60deg) -->
        <symbol id="sparkle-s3" viewBox="-1 -1 2 2" overflow="visible">
          <circle cx="0" cy="0" r="1.8" fill="url(#sparkle-halo-grad)" />
          <path d="M 0 -1 L .08 0 L 0 1 L -.08 0 Z M .87 -.50 L .04 .07 L -.87 .50 L -.04 -.07 Z M .87 .50 L -.04 .07 L -.87 -.50 L .04 -.07 Z" fill="var(--sparkle-fill)" />
        </symbol>

        <!-- S4: Thin star with long vertical ray, shorter horizontal ray, and bright core -->
        <symbol id="sparkle-s4" viewBox="-1 -1 2 2" overflow="visible">
          <circle cx="0" cy="0" r="1.8" fill="url(#sparkle-halo-grad)" />
          <path d="M0 -1 Q .06 -.06 .65 0 Q .06 .06 0 1 Q -.06 .06 -.65 0 Q -.06 -.06 0 -1 Z" fill="var(--sparkle-fill)" />
          <circle cx="0" cy="0" r="0.16" fill="#ffffff" />
        </symbol>`;
}

// 8 sparkles for Game Scene (sizes 14-34 viewBox units, strictly in free zones, including S1 trio)
export const GAME_SPARKLES: SparklePlacement[] = [
  { symbolId: 'sparkle-s2', x: 220, y: 320, size: 28, variantClass: 'space-sparkle-v1' },
  { symbolId: 'sparkle-s3', x: 310, y: 190, size: 22, variantClass: 'space-sparkle-v2' },
  { symbolId: 'sparkle-s4', x: 290, y: 560, size: 32, variantClass: 'space-sparkle-v3' },
  { symbolId: 'sparkle-s1', x: 820, y: 65, size: 24, variantClass: 'space-sparkle-v4' },
  { symbolId: 'sparkle-s3', x: 1580, y: 620, size: 26, variantClass: 'space-sparkle-v1' },
  // Trio of 3 small S1 sparkles of different sizes
  { symbolId: 'sparkle-s1', x: 1120, y: 58, size: 14, variantClass: 'space-sparkle-v2', isTrio: true },
  { symbolId: 'sparkle-s1', x: 1148, y: 48, size: 20, variantClass: 'space-sparkle-v3', isTrio: true },
  { symbolId: 'sparkle-s1', x: 1176, y: 62, size: 16, variantClass: 'space-sparkle-v4', isTrio: true },
];

// 8 sparkles for Review Scene (sizes 14-34 viewBox units, strictly outside 26-74% content zone)
export const REVIEW_SPARKLES: SparklePlacement[] = [
  { symbolId: 'sparkle-s2', x: 95, y: 560, size: 28, variantClass: 'space-sparkle-v1' },
  { symbolId: 'sparkle-s3', x: 320, y: 420, size: 22, variantClass: 'space-sparkle-v2' },
  { symbolId: 'sparkle-s4', x: 1610, y: 520, size: 32, variantClass: 'space-sparkle-v3' },
  { symbolId: 'sparkle-s1', x: 1840, y: 440, size: 24, variantClass: 'space-sparkle-v4' },
  { symbolId: 'sparkle-s3', x: 1580, y: 980, size: 26, variantClass: 'space-sparkle-v1' },
  // Trio of 3 small S1 sparkles of different sizes
  { symbolId: 'sparkle-s1', x: 85, y: 980, size: 15, variantClass: 'space-sparkle-v2', isTrio: true },
  { symbolId: 'sparkle-s1', x: 112, y: 968, size: 21, variantClass: 'space-sparkle-v3', isTrio: true },
  { symbolId: 'sparkle-s1', x: 140, y: 982, size: 17, variantClass: 'space-sparkle-v4', isTrio: true },
];

function renderSparkleUses(sparkles: SparklePlacement[]): string {
  return sparkles
    .map((s) => {
      const half = s.size / 2;
      const x = (s.x - half).toFixed(1);
      const y = (s.y - half).toFixed(1);
      const trioClass = s.isTrio ? ' space-sparkle-trio-item' : '';
      return `<use href="#${s.symbolId}" x="${x}" y="${y}" width="${s.size}" height="${s.size}" class="space-sparkle space-sparkle-use ${s.variantClass}${trioClass}" />`;
    })
    .join('\n          ');
}

// 5-6 Game Screen Constellations (6-10 points each, fully connected)
export const GAME_CONSTELLATIONS: Constellation[] = [
  // 1. Top-left: Pegasus-like (7 points)
  {
    name: 'Pegasus',
    points: [
      { x: 100, y: 90 },
      { x: 180, y: 120 },
      { x: 260, y: 90 },
      { x: 240, y: 180 },
      { x: 160, y: 210 },
      { x: 90, y: 180 },
      { x: 140, y: 280 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [4, 6],
    ],
  },
  // 2. Mid-left: Cygnus-like cross (6 points)
  {
    name: 'Cygnus',
    points: [
      { x: 80, y: 460 },
      { x: 160, y: 500 },
      { x: 240, y: 540 },
      { x: 150, y: 580 },
      { x: 130, y: 660 },
      { x: 220, y: 620 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [3, 5],
    ],
  },
  // 3. Top-center (above board): Cassiopeia-like (6 points)
  {
    name: 'Cassiopeia',
    points: [
      { x: 380, y: 80 },
      { x: 440, y: 40 },
      { x: 500, y: 85 },
      { x: 560, y: 45 },
      { x: 620, y: 80 },
      { x: 670, y: 40 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
    isSecondary: true,
  },
  // 4. Mid-right: Aquila-like (7 points)
  {
    name: 'Aquila',
    points: [
      { x: 1620, y: 450 },
      { x: 1700, y: 480 },
      { x: 1780, y: 450 },
      { x: 1860, y: 500 },
      { x: 1770, y: 540 },
      { x: 1700, y: 580 },
      { x: 1750, y: 640 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [4, 5],
      [5, 6],
    ],
  },
  // 5. Bottom-left (above planet): Crux-like (6 points)
  {
    name: 'Crux',
    points: [
      { x: 380, y: 990 },
      { x: 440, y: 970 },
      { x: 500, y: 950 },
      { x: 440, y: 1030 },
      { x: 480, y: 1010 },
      { x: 530, y: 1020 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
    ],
    isSecondary: true,
  },
  // 6. Bottom-center-right: Corona-like (6 points)
  {
    name: 'Corona',
    points: [
      { x: 1220, y: 1010 },
      { x: 1270, y: 970 },
      { x: 1320, y: 960 },
      { x: 1370, y: 970 },
      { x: 1420, y: 1010 },
      { x: 1320, y: 1000 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
    ],
    isSecondary: true,
  },
];

// Review Screen Chess Piece Constellations (>= 9 points each, fully connected)
export const REVIEW_CONSTELLATIONS: Constellation[] = [
  // 1. Knight (Конь) on mid-left (11 points)
  {
    name: 'Knight',
    points: [
      { x: 110, y: 470 },
      { x: 130, y: 510 },
      { x: 170, y: 520 },
      { x: 160, y: 600 },
      { x: 120, y: 660 },
      { x: 230, y: 660 },
      { x: 250, y: 580 },
      { x: 240, y: 490 },
      { x: 210, y: 410 },
      { x: 160, y: 430 },
      { x: 160, y: 470 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 0],
      [9, 10],
      [10, 2],
    ],
  },
  // 2. King (Король) on mid-right (12 points)
  {
    name: 'King',
    points: [
      { x: 1740, y: 390 },
      { x: 1740, y: 420 },
      { x: 1710, y: 420 },
      { x: 1770, y: 420 },
      { x: 1740, y: 460 },
      { x: 1670, y: 480 },
      { x: 1810, y: 480 },
      { x: 1690, y: 550 },
      { x: 1790, y: 550 },
      { x: 1650, y: 650 },
      { x: 1830, y: 650 },
      { x: 1740, y: 650 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [4, 5],
      [4, 6],
      [5, 7],
      [6, 8],
      [7, 8],
      [7, 9],
      [8, 10],
      [9, 11],
      [11, 10],
    ],
  },
  // 3. Rook (Ладья) on bottom-left free zone (10 points)
  {
    name: 'Rook',
    points: [
      { x: 330, y: 780 },
      { x: 360, y: 800 },
      { x: 400, y: 780 },
      { x: 440, y: 800 },
      { x: 470, y: 780 },
      { x: 360, y: 850 },
      { x: 440, y: 850 },
      { x: 340, y: 940 },
      { x: 460, y: 940 },
      { x: 400, y: 890 },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [4, 6],
      [5, 6],
      [5, 7],
      [6, 8],
      [7, 8],
      [5, 9],
      [6, 9],
    ],
  },
];

export const ASTEROID_POINTS: Point[] = [
  { x: 1480, y: 1020 },
  { x: 1530, y: 980 },
  { x: 1580, y: 950 },
  { x: 1630, y: 910 },
  { x: 1690, y: 880 },
  { x: 1740, y: 840 },
  { x: 1790, y: 810 },
  { x: 1840, y: 770 },
  { x: 1890, y: 740 },
  { x: 1930, y: 700 },
];

/**
 * Builds the Game Screen cosmic scene markup:
 * - Static fullscreen SVG layer (Sun, orbits, Saturn with ring, asteroid belt, constellations, static stars)
 * - 4 isolated animated layers (Saturn's moon, Sun's 4 planets in free zones, pulsating sparkles, twinkling stars)
 */
export function buildGameScene(): string {
  const circles: ExclusionZone[] = [
    { cx: 1720, cy: 60, r: 430 },
    { cx: 140, cy: 960, r: 310 },
    { cx: 1700, cy: 880, r: 180 },
  ];

  const rects: RectZone[] = [
    { x1: 400, y1: 120, x2: 1520, y2: 950 },
  ];

  const stars = generateStars(12345678, circles, rects, 180, 22);

  const staticSmall = stars.small.filter((_, i) => i % 2 === 0);
  const smallStarsD = pointsToZeroLengthLines(staticSmall);
  const mediumStarsD = pointsToZeroLengthLines(stars.medium);
  const largeStarsD = pointsToZeroLengthLines(stars.large);
  const twinkleAD = pointsToZeroLengthLines(stars.twinkleA);
  const twinkleBD = pointsToZeroLengthLines(stars.twinkleB);

  const primaryConstellations = GAME_CONSTELLATIONS.filter((c) => !c.isSecondary);
  const secondaryConstellations = GAME_CONSTELLATIONS.filter((c) => c.isSecondary);

  const primaryLines = constellationsToLines(primaryConstellations);
  const primaryNodes = constellationsToNodes(primaryConstellations);
  const secondaryLines = constellationsToLines(secondaryConstellations);
  const secondaryNodes = constellationsToNodes(secondaryConstellations);

  const asteroidLineD =
    'M ' + ASTEROID_POINTS.map((p) => `${p.x} ${p.y}`).join(' L ');
  const asteroidDotsD = pointsToZeroLengthLines(ASTEROID_POINTS);

  return `
    <svg class="game-solar-stars space-static-svg space-scene-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="pointer-events: none;">
      <defs>
        <radialGradient id="space-sun-glow-grad" cx="1720" cy="60" r="460" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--sun-glow)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--sun-glow)" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="space-sun-disk-grad" cx="1720" cy="60" r="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--sun-core)" />
          <stop offset="100%" stop-color="var(--sun-edge)" stop-opacity="0.88" />
        </radialGradient>

        <radialGradient id="space-planet-halo-grad" cx="140" cy="960" r="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--planet-halo)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--planet-halo)" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="space-planet-body-grad" cx="140" cy="960" r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--planet-core)" />
          <stop offset="100%" stop-color="var(--planet-edge)" stop-opacity="0.92" />
        </radialGradient>
        ${buildSparkleDefs()}
      </defs>

      <!-- Sun system static orbits and disk in top-right corner -->
      <g class="space-sun-cluster" id="space-sun-cluster">
        <circle cx="1720" cy="60" r="460" fill="url(#space-sun-glow-grad)" class="space-sun-glow" />
        <ellipse cx="1720" cy="60" rx="230" ry="140" class="space-sun-orbit" />
        <ellipse cx="1720" cy="60" rx="370" ry="220" class="space-sun-orbit" />
        <ellipse cx="1720" cy="60" rx="530" ry="320" class="space-sun-orbit" />
        <ellipse cx="1720" cy="60" rx="710" ry="430" class="space-sun-orbit" />
        <circle cx="1720" cy="60" r="105" fill="url(#space-sun-disk-grad)" class="space-sun-disk" />
      </g>

      <!-- Planet cluster in bottom-left corner (orbit minor semi-axis 154 >= 130 * 1.1 = 143) -->
      <g class="space-planet-cluster game-solar-planet-cluster" id="space-planet-cluster">
        <circle cx="140" cy="960" r="280" fill="url(#space-planet-halo-grad)" class="space-planet-halo" />
        <ellipse cx="140" cy="960" rx="280" ry="154" transform="rotate(-15 140 960)" class="space-planet-orbit game-solar-orbit" />
        <path d="M -90 1067 A 260 55 -25 0 1 370 853" fill="none" stroke="var(--planet-ring-back)" stroke-width="3" class="space-ring-back game-solar-ring" />
        <circle cx="140" cy="960" r="130" fill="url(#space-planet-body-grad)" class="space-planet game-solar-planet" />
        <path d="M 370 853 A 260 55 -25 0 1 -90 1067" fill="none" stroke="var(--planet-ring-front)" stroke-width="3" class="space-ring-front" />
      </g>

      <!-- Asteroid track in bottom-right corner -->
      <g class="space-asteroid-track" id="space-asteroid-track">
        <path d="${asteroidLineD}" fill="none" stroke="var(--asteroid-fill)" stroke-width="1" stroke-opacity="0.25" class="space-asteroid-line" />
        <path d="${asteroidDotsD}" fill="none" stroke="var(--asteroid-fill)" stroke-width="4.5" stroke-linecap="round" class="space-asteroid-dots" />
      </g>

      <!-- Static Constellations in free zones -->
      <g class="space-constellations" id="space-constellations">
        <path d="${primaryLines}" fill="none" stroke="var(--constellation-line)" stroke-width="1" class="space-constellation-lines" />
        <path d="${primaryNodes}" fill="none" stroke="var(--constellation-node)" stroke-width="3.5" stroke-linecap="round" class="space-constellation-nodes" />
        <path d="${secondaryLines}" fill="none" stroke="var(--constellation-line)" stroke-width="1" class="space-constellation-lines space-constellation-secondary" />
        <path d="${secondaryNodes}" fill="none" stroke="var(--constellation-node)" stroke-width="3.5" stroke-linecap="round" class="space-constellation-nodes space-constellation-secondary" />
      </g>

      <!-- Static Stars field -->
      <g class="space-stars" id="space-stars">
        <path d="${smallStarsD}" fill="none" stroke="var(--star-color)" stroke-width="1.2" stroke-linecap="round" class="space-star-small" />
        <path d="${mediumStarsD}" fill="none" stroke="var(--star-color)" stroke-width="2.0" stroke-linecap="round" class="space-star-medium space-stars-desktop" />
        <path d="${largeStarsD}" fill="none" stroke="var(--star-color)" stroke-width="2.8" stroke-linecap="round" class="space-star-large" />
      </g>
    </svg>

    <!-- Animated Layer 1: Saturn Moon on elliptical orbit (rx=280, ry=154 >= 143) -->
    <svg class="space-anim-layer space-layer-moon" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-moon-orbit-tilt" transform="translate(140, 960) rotate(-15) scale(1, 0.55)">
        <g class="space-moon-orbit-spin">
          <g transform="translate(280, 0)">
            <g class="space-moon-counter">
              <circle cx="0" cy="0" r="7" transform="scale(1, 1.818)" fill="var(--planet-moon)" class="space-moon game-solar-moon" />
            </g>
          </g>
        </g>
      </g>
    </svg>

    <!-- Animated Layer 2: Sun System Planets in free zones (x >= 1572, periods 90-240s) -->
    <svg class="space-anim-layer space-layer-planets" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-sun-planets-group">
        <circle cx="1817" cy="187" r="6" fill="var(--sun-planet-1)" class="space-sun-planet space-sun-planet-1" />
        <circle cx="1581" cy="264" r="9" fill="var(--sun-planet-2)" class="space-sun-planet space-sun-planet-2" />
        <circle cx="1830" cy="373" r="8" fill="var(--sun-planet-3)" class="space-sun-planet space-sun-planet-3" />
        <circle cx="1572" cy="481" r="11" fill="var(--sun-planet-4)" class="space-sun-planet space-sun-planet-4" />
      </g>
    </svg>

    <!-- Animated Layer 3: Pulsating Pointed Star Sparkles (<use> from <defs>) -->
    <svg class="space-anim-layer space-layer-sparkles" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-sparkles-group">
        ${renderSparkleUses(GAME_SPARKLES)}
      </g>
    </svg>

    <!-- Animated Layer 4: Anti-phase Twinkling Star Groups (2 groups of ~30% stars) -->
    <svg class="space-anim-layer space-layer-twinkle" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-twinkle-group">
        <path d="${twinkleAD}" fill="none" stroke="var(--star-color)" stroke-width="1.6" stroke-linecap="round" class="space-stars-twinkle space-stars-twinkle-a" />
        <path d="${twinkleBD}" fill="none" stroke="var(--star-color)" stroke-width="1.8" stroke-linecap="round" class="space-stars-twinkle space-stars-twinkle-b" />
      </g>
    </svg>
  `;
}

/**
 * Builds the Review Screen cosmic scene markup:
 * - Static fullscreen SVG layer (Eclipse disk without rays, bottom-left amber nebula, chess constellations, static stars)
 * - 4 isolated animated layers (Spiral galaxy in top-right, Comet outside 26-74% zone, Eclipse corona, Sparkles + twinkling stars)
 */
export function buildReviewScene(): string {
  const circles: ExclusionZone[] = [
    { cx: 160, cy: 120, r: 320 },
    { cx: 1680, cy: 200, r: 190 },
    { cx: 1680, cy: 800, r: 240 },
  ];

  const rects: RectZone[] = [
    { x1: 380, y1: 80, x2: 1540, y2: 1000 },
  ];

  const stars = generateStars(87654321, circles, rects, 175, 22);

  const smallStarsD = pointsToZeroLengthLines(stars.small);
  const mediumStarsD = pointsToZeroLengthLines(stars.medium);
  const largeStarsD = pointsToZeroLengthLines(stars.large);
  const twinkleAD = pointsToZeroLengthLines(stars.twinkleA);
  const twinkleBD = pointsToZeroLengthLines(stars.twinkleB);

  const chessLines = constellationsToLines(REVIEW_CONSTELLATIONS);
  const chessNodes = constellationsToNodes(REVIEW_CONSTELLATIONS);

  return `
    <svg class="review-solar-stars space-static-svg space-scene-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="pointer-events: none;">
      <defs>
        <!-- Eclipse corona gradient centered at (160, 120) -->
        <radialGradient id="review-eclipse-grad" cx="160" cy="120" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="42%" stop-color="var(--eclipse-corona-outer)" stop-opacity="0" />
          <stop offset="54%" stop-color="var(--eclipse-corona-core)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--eclipse-corona-outer)" stop-opacity="0" />
        </radialGradient>

        <!-- Comet tail linear gradient (strictly right of 74% = 1420.8) -->
        <linearGradient id="review-comet-tail-grad" x1="1810" y1="890" x2="1500" y2="690" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--comet-tail-start)" />
          <stop offset="100%" stop-color="var(--comet-tail-end)" />
        </linearGradient>

        <!-- Comet head radial gradient (strictly right of 74% = 1420.8) -->
        <radialGradient id="review-comet-head-grad" cx="1810" cy="890" r="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--comet-head)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--comet-glow)" stop-opacity="0" />
        </radialGradient>

        <!-- Spiral Galaxy bright core radial gradient -->
        <radialGradient id="review-galaxy-core-grad" cx="0" cy="0" r="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--galaxy-core)" stop-opacity="0.95" />
          <stop offset="100%" stop-color="var(--galaxy-mid)" stop-opacity="0" />
        </radialGradient>

        <!-- Amber Nebula in bottom-left -->
        <radialGradient id="review-nebula-2" cx="260" cy="840" r="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--nebula-amber)" />
          <stop offset="100%" stop-color="var(--nebula-amber)" stop-opacity="0" />
        </radialGradient>
        ${buildSparkleDefs()}
      </defs>

      <!-- Soft Amber Nebula cloud in bottom-left -->
      <g class="space-nebulae" id="space-nebulae">
        <ellipse cx="260" cy="840" rx="240" ry="140" fill="url(#review-nebula-2)" class="space-nebula-cloud" />
      </g>

      <!-- Solar eclipse disk in top-left corner (no rays) -->
      <g class="space-eclipse-cluster" id="space-eclipse-cluster">
        <circle cx="160" cy="120" r="140" fill="var(--eclipse-disk)" class="space-eclipse-disk" />
      </g>

      <!-- Chess Piece Constellations (Knight, King, Rook) -->
      <g class="space-chess-constellations" id="space-chess-constellations">
        <path d="${chessLines}" fill="none" stroke="var(--constellation-line)" stroke-width="1.2" class="space-constellation-lines" />
        <path d="${chessNodes}" fill="none" stroke="var(--constellation-node)" stroke-width="3.5" stroke-linecap="round" class="space-constellation-nodes" />
      </g>

      <!-- Static Stars outside exclusion zones -->
      <g class="space-stars" id="space-stars">
        <path d="${smallStarsD}" fill="none" stroke="var(--star-color)" stroke-width="1.2" stroke-linecap="round" class="space-star-small" />
        <path d="${mediumStarsD}" fill="none" stroke="var(--star-color)" stroke-width="2.0" stroke-linecap="round" class="space-star-medium space-stars-desktop" />
        <path d="${largeStarsD}" fill="none" stroke="var(--star-color)" stroke-width="2.8" stroke-linecap="round" class="space-star-large" />
      </g>
    </svg>

    <!-- Animated Layer 1: Spiral Galaxy in top-right (~18% scene width, 60deg tilt, 240s spin) -->
    <svg class="space-anim-layer space-layer-galaxy" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-galaxy-cluster" id="space-galaxy-cluster" transform="translate(1680, 200) rotate(-30) scale(1, 0.5)">
        <g class="space-galaxy-spin">
          <circle cx="0" cy="0" r="80" fill="url(#review-galaxy-core-grad)" class="space-galaxy-core" />
          <path d="M 16 0 C 34 -32, 8 -68, -38 -62 C -88 -52, -118 12, -96 78 C -74 138, 12 170, 98 156 C 146 146, 170 112, 172 72" fill="none" stroke="var(--galaxy-arm)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 10" class="space-galaxy-arm space-galaxy-arm-1 space-galaxy-arm-a" />
          <path d="M -16 0 C -34 32, -8 68, 38 62 C 88 52, 118 -12, 96 -78 C 74 -138, -12 -170, -98 -156 C -146 -146, -170 -112, -172 -72" fill="none" stroke="var(--galaxy-arm)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 10" class="space-galaxy-arm space-galaxy-arm-2 space-galaxy-arm-b" />
        </g>
      </g>
    </svg>

    <!-- Animated Layer 2: Comet in lower-right (strictly outside 26-74% content zone, 40s drift) -->
    <svg class="space-anim-layer space-layer-comet" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-comet-cluster space-comet-drift" id="space-comet-cluster">
        <path d="M 1810 890 L 1500 710 L 1535 675 Z" fill="url(#review-comet-tail-grad)" class="space-comet-tail" />
        <circle cx="1810" cy="890" r="32" fill="url(#review-comet-head-grad)" class="space-comet-glow" />
        <circle cx="1810" cy="890" r="4.5" fill="var(--comet-head)" class="space-comet-nucleus" />
      </g>
    </svg>

    <!-- Animated Layer 3: Eclipse Corona soft pulse (9s period) -->
    <svg class="space-anim-layer space-layer-eclipse-corona" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-eclipse-corona-wrap">
        <circle cx="160" cy="120" r="260" fill="url(#review-eclipse-grad)" class="space-eclipse-corona space-eclipse-corona-ring" />
      </g>
    </svg>

    <!-- Animated Layer 4: Sparkles (<use>) and Anti-phase Twinkling Stars -->
    <svg class="space-anim-layer space-layer-twinkle" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="overflow: visible;">
      <g class="space-twinkle-group">
        ${renderSparkleUses(REVIEW_SPARKLES)}
        <path d="${twinkleAD}" fill="none" stroke="var(--star-color)" stroke-width="1.6" stroke-linecap="round" class="space-stars-twinkle space-stars-twinkle-a" />
        <path d="${twinkleBD}" fill="none" stroke="var(--star-color)" stroke-width="1.8" stroke-linecap="round" class="space-stars-twinkle space-stars-twinkle-b" />
      </g>
    </svg>
  `;
}
