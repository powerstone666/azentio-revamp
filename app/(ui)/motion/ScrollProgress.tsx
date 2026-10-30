'use client';

import { useRef } from 'react';
import { gsap } from './gsap';
import { useMotion } from './useMotion';

// Thin accent bar scrubbed to page scroll.
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    gsap.to(el, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.2 },
    });
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left scale-x-0 bg-gradient-to-r from-accent to-violet"
    />
  );
}
