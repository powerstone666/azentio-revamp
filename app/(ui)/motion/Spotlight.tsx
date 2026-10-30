'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion, MOTION_POINTER } from './useMotion';

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  /** Pointer tilt in degrees; 0 disables. */
  tilt?: number;
}

// Cursor-following glow (and optional 3D tilt) for cards. Styles live in .spotlight.
export default function Spotlight({ children, className, tilt = 0 }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(
    ref,
    (el, safe) => {
      const mx = gsap.quickTo(el, '--mx', { duration: 0.35, ease: 'power3.out' });
      const my = gsap.quickTo(el, '--my', { duration: 0.35, ease: 'power3.out' });
      const rx = tilt ? gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' }) : null;
      const ry = tilt ? gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' }) : null;
      if (tilt) gsap.set(el, { transformPerspective: 900 });

      const enter = safe(() => gsap.to(el, { '--spot': 1, duration: 0.3, overwrite: 'auto' }));
      const leave = safe(() => {
        gsap.to(el, { '--spot': 0, duration: 0.4, overwrite: 'auto' });
        rx?.(0);
        ry?.(0);
      });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        mx(e.clientX - r.left);
        my(e.clientY - r.top);
        if (tilt) {
          ry?.(((e.clientX - r.left) / r.width - 0.5) * tilt * 2);
          rx?.(-((e.clientY - r.top) / r.height - 0.5) * tilt * 2);
        }
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('pointermove', move);
      return () => {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('pointermove', move);
      };
    },
    { query: MOTION_POINTER },
  );

  return (
    <div ref={ref} className={`spotlight ${className?.includes('absolute') ? '' : 'relative'} ${className ?? ''}`}>
      {children}
    </div>
  );
}
