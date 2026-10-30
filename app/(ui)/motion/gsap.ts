'use client';

// GSAP registration for the public site. Never import from portal code
// (portal uses ≤150ms Tailwind transitions). All plugins are free in `gsap`.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Observer } from 'gsap/Observer';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(
    useGSAP,
    ScrollTrigger,
    SplitText,
    DrawSVGPlugin,
    MotionPathPlugin,
    ScrollToPlugin,
    Observer,
    Flip,
  );
}

let refreshTimer: number | undefined;

/**
 * ScrollTriggers must refresh in page order and again after any layout change (fonts, pin spacers,
 * hot reload re-running effects). Call this after creating triggers; it sorts them top-to-bottom
 * and refreshes once, debounced.
 */
export function scheduleScrollRefresh(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }, 120);
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', scheduleScrollRefresh);
  document.fonts?.ready.then(scheduleScrollRefresh);
  if ('ResizeObserver' in window) {
    let lastHeight = 0;
    new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastHeight) > 2) {
        lastHeight = h;
        scheduleScrollRefresh();
      }
    }).observe(document.body);
  }
}

export {
  gsap,
  ScrollTrigger,
  SplitText,
  DrawSVGPlugin,
  MotionPathPlugin,
  ScrollToPlugin,
  Observer,
  Flip,
  useGSAP,
};
