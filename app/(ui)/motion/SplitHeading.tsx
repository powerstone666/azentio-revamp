'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, SplitText } from './gsap';
import { useMotion } from './useMotion';

interface SplitHeadingProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Play on load instead of on scroll (hero). */
  immediate?: boolean;
  delay?: number;
}

export default function SplitHeading({
  children,
  as: Tag = 'h2',
  className,
  immediate = false,
  delay = 0,
}: SplitHeadingProps) {
  const ref = useRef<HTMLElement>(null);

  useMotion(ref, (el) => {
    if (immediate) gsap.set(el, { autoAlpha: 1 });
    const split = SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, {
          yPercent: 115,
          rotate: 4,
          duration: 1.05,
          delay,
          stagger: 0.045,
          ease: 'power4.out',
          scrollTrigger: immediate
            ? { trigger: el, start: 'top 95%', end: 'bottom top', toggleActions: 'play none restart reset' }
            : { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        }),
    });
    return () => split.revert();
  });

  return (
    <Tag ref={ref} className={className} {...(immediate ? { 'data-hero': true } : {})}>
      {children}
    </Tag>
  );
}
