'use client';

// ───────────────────────────────────────────────────────────
// GSAP registration module
// GSAP animations only in app/(public)/ — portal uses ≤150ms
// Tailwind transitions. Do NOT import this module from portal
// or dashboard code paths.
// ───────────────────────────────────────────────────────────

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useEffect, useState } from 'react';

/**
 * Register GSAP plugins. Call once at app bootstrap inside a
 * component that lives within the public layout boundary.
 *
 * Idempotent — safe to call on every render or in multiple
 * components; GSAP silently ignores duplicate registrations.
 */
export function registerGsap(): void {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/**
 * Hook that returns `true` when the user has requested reduced
 * motion (OS-level `prefers-reduced-motion: reduce`).
 *
 * Components should check this flag and either skip animations
 * entirely or render the final frame instantly so content
 * remains accessible.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setReduced(mql.matches);

    // Listen for live changes (user toggles the OS preference)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

// Re-export for convenience so consumers only import from one place
export { gsap, ScrollTrigger, useGSAP };