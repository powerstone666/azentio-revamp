'use client';

import type { RefObject } from 'react';
import { gsap, scheduleScrollRefresh, useGSAP } from './gsap';

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export const MOTION_POINTER = `${MOTION_OK} and (hover: hover) and (pointer: fine)`;
export const MOTION_DESKTOP = `${MOTION_OK} and (min-width: 768px)`;

/** Wraps a callback so tweens it creates after setup (event handlers, ScrollTrigger callbacks) are cleaned up. */
export type ContextSafe = <T extends (...args: never[]) => unknown>(fn: T) => T;

interface MotionOptions {
  /** Media query that must match for the setup to run. Defaults to no reduced-motion preference. */
  query?: string;
  dependencies?: unknown[];
}

/**
 * Runs `setup` inside gsap.matchMedia(), scoped to `scope`. Under reduced motion (or when `query`
 * does not match) nothing is created, so markup stays in its final state. Everything is reverted on
 * unmount or when the query stops matching. Use the second argument (contextSafe) for any handler
 * that creates tweens later, such as pointer events.
 */
export function useMotion(
  scope: RefObject<HTMLElement | null>,
  setup: (el: HTMLElement, contextSafe: ContextSafe) => void | (() => void),
  { query = MOTION_OK, dependencies = [] }: MotionOptions = {},
): void {
  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      // matchMedia handlers receive (context, contextSafe) with contextSafe bound to the handler's OWN context.
      // Using the outer useGSAP contextSafe instead makes the two contexts reference each other when a ScrollTrigger
      // callback fires during setup, and reverting them then recurses forever ("Maximum call stack size exceeded").
      mm.add(query, ((_ctx: unknown, contextSafe: ContextSafe) => setup(el, contextSafe)) as never);
      scheduleScrollRefresh();
      return () => mm.revert();
    },
    { scope, dependencies, revertOnUpdate: true },
  );
}
