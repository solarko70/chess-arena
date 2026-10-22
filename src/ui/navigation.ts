import type { AppRoute } from '@/router';
import { mountSaturnBackground } from './saturn-background';

export function buildSolarLogo(): string {
  return `<svg class="solar-logo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle class="solar-logo-corona" cx="50" cy="50" r="43" fill="none" stroke="var(--solar-brand-gold)" stroke-width="1" />
    <circle cx="50" cy="50" r="36" fill="var(--solar-brand-disc)" stroke="var(--solar-brand-gold)" stroke-width="3" />
    <path d="M50 2v5m0 86v5M2 50h5m86 0h5M16 16l4 4m60 60 4 4M16 84l4-4m60-60 4-4"
      fill="none" stroke="var(--solar-brand-gold)" stroke-width="2" stroke-linecap="round" />
    <path class="solar-logo-king" d="M48 23h4v6h6v4h-6v6h-4v-6h-6v-4h6zM36 43h28l-5 12 4 15H37l4-15zM34 73h32v6H34z"
      fill="var(--solar-brand-silver)" />
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
