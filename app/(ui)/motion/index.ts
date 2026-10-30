/**
 * @azentio/motion
 *
 * GSAP-powered animation helpers for the public marketing site.
 * **Do NOT import from the portal or dashboard code paths** —
 * those views use ≤150ms Tailwind CSS transitions exclusively.
 *
 * ── Usage ─────────────────────────────────────────────────
 * ```ts
 * import { registerGsap, useHeroReveal, useReducedMotion } from '@/ui/motion';
 *
 * // Register once in your public layout:
 * registerGsap();
 *
 * // In a component:
 * const ref = useRef<HTMLDivElement>(null);
 * useHeroReveal(ref, { stagger: 0.15 });
 * ```
 */

export {
  gsap,
  ScrollTrigger,
  useGSAP,
  registerGsap,
  useReducedMotion,
} from './gsap';

export {
  useHeroReveal,
  useStatsCountUp,
  useStaggeredReveal,
} from './hero-animations';

export type { RevealOptions, StatsOptions } from './hero-animations';