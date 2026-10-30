'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion } from './useMotion';

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Percent of own height travelled across the viewport. Negative moves against scroll. */
  amount?: number;
}

export default function Parallax({ children, className, amount = 14 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    gsap.fromTo(
      el,
      { yPercent: -amount },
      {
        yPercent: amount,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
