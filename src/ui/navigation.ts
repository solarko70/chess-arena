import type { AppRoute } from '@/router';
import { mountSaturnBackground } from './saturn-background';

export function buildSolarLogo(): string {
  return `<svg class="solar-logo solar-queen-logo" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <g id="solar-queen-outline">
        <path d="M18 36 32 64H68L82 36 65 53 68 28 56 47 50 24 44 47 32 28 35 53Z" />
        <path d="M34 64 32 77H68L66 64M36 71H64" />
        <rect x="24" y="77" width="52" height="8" rx="2.8" />
        <circle class="solar-queen-tip" cx="18" cy="33" r="3" />
        <circle class="solar-queen-tip" cx="32" cy="25" r="3" />
        <circle class="solar-queen-tip" cx="50" cy="21" r="3.3" />
        <circle class="solar-queen-tip" cx="68" cy="25" r="3" />
        <circle class="solar-queen-tip" cx="82" cy="33" r="3" />
      </g>
    </defs>
    <g class="solar-logo-corona" stroke="var(--solar-brand-gold)" stroke-width="1.5">
      <circle cx="50" cy="50" r="46" />
      <path class="solar-logo-ticks" d="M50 1V9M91 50H99M50 91V99M1 50H9" />
    </g>
    <g stroke-linecap="round" stroke-linejoin="round">
      <use class="solar-logo-keyline" href="#solar-queen-outline" stroke="var(--solar-brand-edge)" stroke-width="4.8" />
      <use class="solar-logo-queen" href="#solar-queen-outline" stroke="var(--solar-brand-figure)" stroke-width="2.2" />
      <g class="solar-queen-sun" stroke="var(--solar-brand-gold)" stroke-width="1.4">
        <circle cx="50" cy="57" r="2.8" />
        <path d="M50 50V52M50 62V64M43 57H45M55 57H57M45 52 46.5 53.5M53.5 60.5 55 62M45 62 46.5 60.5M53.5 53.5 55 52" />
      </g>
    </g>
  </svg>`;
}

const SATURN_FADE_MS = 250;
let host: HTMLElement | null = null;
let cleanup: (() => void) | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

/** Keeps the fading scene outside screens that the router hides immediately. */
export function updateSaturnBackground(route: AppRoute, container: HTMLElement): void {
  if (route === 'home') {
    if (host?.parentElement === container && fadeTimer === null) return;
    disposeSaturnBackground();
    host = container.ownerDocument.createElement('div');
    host.className = 'saturn-background-mount';
    host.setAttribute('aria-hidden', 'true');
    container.prepend(host);
    cleanup = mountSaturnBackground(host);
  } else if (host && fadeTimer === null) {
    host.querySelector('.saturn-scene-wrapper')?.classList.add('saturn-scene-leaving');
    fadeTimer = setTimeout(disposeSaturnBackground, SATURN_FADE_MS);
  }
}

export function disposeSaturnBackground(): void {
  if (fadeTimer !== null) clearTimeout(fadeTimer);
  fadeTimer = null;
  cleanup?.();
  cleanup = null;
  host?.remove();
  host = null;
}
