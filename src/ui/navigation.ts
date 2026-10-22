import type { AppRoute } from '@/router';
import { mountSaturnBackground } from './saturn-background';

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
