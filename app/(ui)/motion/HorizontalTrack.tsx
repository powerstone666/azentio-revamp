'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion, MOTION_DESKTOP } from './useMotion';

// Desktop + motion: pins the section and scrubs the cards sideways as you scroll.
// Otherwise the track is a native horizontal scroller with snap.
export default function HorizontalTrack({ children, header }: { children: ReactNode; header: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(
    ref,
    (el) => {
      const viewport = el.querySelector<HTMLElement>('[data-track-viewport]');
      const track = el.querySelector<HTMLElement>('[data-track]');
      const bar = el.querySelector<HTMLElement>('[data-track-bar]');
      if (!viewport || !track) return;
      gsap.set(viewport, { overflowX: 'hidden' });
      gsap.set(el, { minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: el,
          start: 'top top+=110',
          end: () => `+=${distance()}`,
          scrub: 0.7,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      tl.to(track, { x: () => -distance() }, 0);
      tl.to(bar, { scaleX: 1 }, 0);
      gsap.from(track.children, {
        y: 60,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 80%', toggleActions: 'play none none reverse' },
      });
    },
    { query: MOTION_DESKTOP },
  );

  return (
    <div ref={ref} className="py-4">
      {header}
      <div
        data-track-viewport
        className="mt-10 snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:thin]"
      >
        <div data-track className="flex w-max gap-6 pl-5 pr-5 md:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] md:pr-8">
          {children}
        </div>
      </div>
      <div className="mx-auto mt-6 w-full max-w-[1240px] px-5 md:px-8"><div className="h-px bg-line">
        <div data-track-bar className="h-full origin-left scale-x-0 bg-accent" />
      </div></div>
    </div>
  );
}
