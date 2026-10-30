'use client';

import { useRef } from 'react';
import { gsap } from './gsap';
import { useMotion } from './useMotion';

interface CountUpProps {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}

// Markup holds the final number, so reduced-motion and no-JS users see real values.
export default function CountUp({ value, suffix = '', className, duration = 2.2 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => `${Math.round(n).toLocaleString('en-US')}${suffix}`;

  useMotion(ref, (el) => {
    const counter = { n: 0 };
    el.textContent = fmt(0);
    gsap.to(counter, {
      n: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmt(counter.n);
      },
      scrollTrigger: { trigger: el, start: 'top 90%', end: 'bottom top', toggleActions: 'restart none restart reset' },
    });
    return () => {
      el.textContent = fmt(value);
    };
  });

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
