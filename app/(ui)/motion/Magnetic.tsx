'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion, MOTION_POINTER } from './useMotion';

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

// Pulls its child toward the pointer, then springs back. Fine pointers only.
export default function Magnetic({ children, className, strength = 0.32 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useMotion(
    ref,
    (el, safe) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = safe(() => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: true });
      });
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      };
    },
    { query: MOTION_POINTER },
  );

  return (
    <span ref={ref} className={`inline-block ${className ?? ''}`}>
      {children}
    </span>
  );
}
