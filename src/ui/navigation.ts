import type { AppRoute } from '@/router';
import { mountSaturnBackground } from './saturn-background';

export function buildSolarLogo(): string {
  return `<svg class="solar-logo solar-queen-logo logo-queen-piece logo-queen-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <g id="solar-queen-outline">
        <path d="M14 29 30 67H70L86 29 66 54 68 20 55 49 50 15 45 49 32 20 34 54Z" />
        <path d="M30 67 28 82H72L70 67Z" />
        <rect x="18" y="82" width="64" height="12" rx="2.8" />
        <circle class="solar-queen-tip" cx="14" cy="26" r="3" />
        <circle class="solar-queen-tip" cx="32" cy="17" r="3" />
        <path class="solar-queen-tip solar-queen-top-sun" d="M50 5 52 8 55 7 55 10 58 12 55 14 55 17 52 16 50 19 48 16 45 17 45 14 42 12 45 10 45 7 48 8Z" />
        <circle class="solar-queen-tip" cx="68" cy="17" r="3" />
        <circle class="solar-queen-tip" cx="86" cy="26" r="3" />
      </g>
    </defs>
    <g stroke-linecap="round" stroke-linejoin="round">
      <use class="solar-logo-keyline" href="#solar-queen-outline" stroke="var(--solar-brand-edge)" stroke-width="6" fill="var(--solar-brand-piece-fill)" />
      <use class="solar-logo-queen" href="#solar-queen-outline" stroke="var(--solar-brand-piece-stroke)" stroke-width="3.5" fill="var(--solar-brand-piece-fill)" />
      <path d="M36 75H64" stroke="var(--solar-brand-piece-stroke)" stroke-width="2.5" />
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
