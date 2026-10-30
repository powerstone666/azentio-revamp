'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger } from './gsap';
import { useMotion } from './useMotion';

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
}

// Infinite loop that speeds up with scroll velocity and eases to a halt on hover.
export default function Marquee({ children, className, duration = 40, reverse = false }: MarqueeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el, safe) => {
    const track = el.querySelector<HTMLElement>('[data-marquee-track]');
    if (!track) return;
    const loop = gsap.fromTo(
      track,
      { xPercent: reverse ? -50 : 0 },
      { xPercent: reverse ? 0 : -50, ease: 'none', duration, repeat: -1 },
    );
    const boost = ScrollTrigger.create({
      onUpdate: safe((self: ScrollTrigger) => {
        const v = Math.min(Math.abs(self.getVelocity()) / 350, 5);
        gsap.to(loop, { timeScale: 1 + v, duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2, overwrite: false });
      }),
    });
    const pause = safe(() => gsap.to(loop, { timeScale: 0, duration: 0.5 }));
    const play = safe(() => gsap.to(loop, { timeScale: 1, duration: 0.5 }));
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', play);
    return () => {
      boost.kill();
      el.removeEventListener('pointerenter', pause);
      el.removeEventListener('pointerleave', play);
    };
  });

  return (
    <div
      ref={ref}
      className={`marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] ${className ?? ''}`}
    >
      <div data-marquee-track className="marquee-track flex w-max gap-4">
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="marquee-copy flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
