'use client';

// ───────────────────────────────────────────────────────────
// Hero & section animation helpers
//
// Every hook checks prefers-reduced-motion and renders the
// final frame instantly (opacity 1, no transforms) when the
// user has requested reduced motion.
//
// All GSAP work is wrapped in useGSAP for proper React
// lifecycle scoping and automatic cleanup.
// ───────────────────────────────────────────────────────────

import { type RefObject, useRef, useState, useEffect, useCallback } from 'react';
import { gsap, ScrollTrigger, useGSAP, useReducedMotion } from './gsap';

// ───────────────────────────────────────────────────────────
// Shared types
// ───────────────────────────────────────────────────────────

export interface RevealOptions {
  /** Delay in seconds before the tween starts (default 0) */
  delay?: number;
  /** Duration per tween (default 0.7) */
  duration?: number;
  /** Stagger delay between children (default 0.1) */
  stagger?: number;
  /** y-offset in px for the from-tween (default 40) */
  y?: number;
  /** Easing (default 'power3.out') */
  ease?: string;
  /** ScrollTrigger start trigger (default 'top 85%') */
  start?: string;
  /** Whether to toggle actions instead of play-once (default false) */
  toggleActions?: string;
}

export interface StatsOptions {
  /** Duration of the count-up (default 2) */
  duration?: number;
  /** Delay before starting (default 0.3) */
  delay?: number;
}

// ───────────────────────────────────────────────────────────
// useHeroReveal
// Staggered reveal of direct children — intended for the
// public home-page hero headline, subtext, pill CTA, etc.
// ───────────────────────────────────────────────────────────

export function useHeroReveal(
  containerRef: RefObject<HTMLElement | null>,
  options: RevealOptions = {},
): void {
  const prefersReducedMotion = useReducedMotion();

  const {
    delay = 0,
    duration = 0.7,
    stagger = 0.1,
    y = 40,
    ease = 'power3.out',
  } = options;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const children = Array.from(containerRef.current.children);

      if (prefersReducedMotion) {
        // Instant final state — no animation
        gsap.set(children, { autoAlpha: 1, y: 0, clearProps: 'all' });
        return;
      }

      gsap.from(children, {
        y,
        autoAlpha: 0,
        stagger,
        duration,
        delay,
        ease,
      });
    },
    {
      scope: containerRef,
      dependencies: [prefersReducedMotion],
      revertOnUpdate: true,
    },
  );
}

// ───────────────────────────────────────────────────────────
// useStatsCountUp
// Animates numeric values inside ref elements from 0 to
// their target. Each ref element should have a data-target
// attribute with the number to count to (e.g. data-target="650").
// ───────────────────────────────────────────────────────────

export function useStatsCountUp(
  refs: RefObject<Array<HTMLElement | null>> | RefObject<HTMLElement | null>,
  options: StatsOptions = {},
): void {
  const prefersReducedMotion = useReducedMotion();
  const hasRun = useRef(false);

  const { duration = 2, delay = 0.3 } = options;

  /**
   * Safely collect an array of DOM elements from the various
   * ref shapes consumers might pass in.
   */
  const getElements = useCallback((): HTMLElement[] => {
    // Single RefObject<HTMLElement | null>
    if (
      refs &&
      'current' in refs &&
      !Array.isArray(refs.current) &&
      refs.current instanceof HTMLElement
    ) {
      return [refs.current];
    }

    // RefObject<Array<HTMLElement | null>>
    if (refs && 'current' in refs && Array.isArray(refs.current)) {
      return refs.current.filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );
    }

    return [];
  }, [refs]);

  useGSAP(
    () => {
      const elements = getElements();
      if (elements.length === 0) return;

      if (prefersReducedMotion || hasRun.current) {
        // Instant final frame
        elements.forEach((el) => {
          const target = Number(el.getAttribute('data-target') ?? el.textContent ?? '0');
          el.textContent = String(Math.round(target));
        });
        return;
      }

      hasRun.current = true;

      elements.forEach((el) => {
        const raw =
          el.getAttribute('data-target') ?? el.textContent ?? '0';
        const target = Number(raw);

        // Validation: skip non-numeric or already-animated cells
        if (Number.isNaN(target) || target === 0) return;

        gsap.fromTo(
          el,
          { innerText: 0 },
          {
            innerText: target,
            duration,
            delay,
            ease: 'power2.out',
            snap: { innerText: 1 },
            onUpdate(this: { targets: () => HTMLElement[] }) {
              const tgt = this.targets()[0];
              const val = Math.round(Number(tgt.innerText));
              tgt.innerText = String(val);
              // Append "+" suffix if the original text had it
              if (raw.includes('+')) {
                tgt.innerText = `${val}+`;
              }
            },
          },
        );
      });
    },
    {
      dependencies: [prefersReducedMotion],
      revertOnUpdate: true,
    },
  );
}

// ───────────────────────────────────────────────────────────
// useStaggeredReveal
// Generic staggered reveal for section children when they
// enter the viewport. Uses ScrollTrigger — only fires once
// by default (`toggleActions` = 'play none none none').
// ───────────────────────────────────────────────────────────

export function useStaggeredReveal(
  containerRef: RefObject<HTMLElement | null>,
  options: RevealOptions = {},
): void {
  const prefersReducedMotion = useReducedMotion();

  const {
    delay = 0,
    duration = 0.7,
    stagger = 0.1,
    y = 40,
    ease = 'power3.out',
    start = 'top 85%',
    toggleActions = 'play none none none',
  } = options;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const children = Array.from(containerRef.current.children);

      if (prefersReducedMotion) {
        gsap.set(children, { autoAlpha: 1, y: 0, clearProps: 'all' });
        return;
      }

      gsap.from(children, {
        y,
        autoAlpha: 0,
        stagger,
        duration,
        delay,
        ease,
        scrollTrigger: {
          trigger: containerRef.current,
          start,
          toggleActions,
        },
      });
    },
    {
      scope: containerRef,
      dependencies: [prefersReducedMotion],
      revertOnUpdate: true,
    },
  );
}