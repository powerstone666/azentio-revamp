'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion } from './useMotion';

type Variant = 'up' | 'left' | 'right' | 'scale' | 'fade';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  variant?: Variant;
  /** Seconds between direct children. 0 animates the element itself. */
  stagger?: number;
  delay?: number;
  start?: string;
}

const FROM: Record<Variant, gsap.TweenVars> = {
  up: { y: 48 },
  left: { x: -56 },
  right: { x: 56 },
  scale: { scale: 0.92, y: 24 },
  fade: {},
};

export default function Reveal({
  children,
  as: Tag = 'div',
  className,
  variant = 'up',
  stagger = 0,
  delay = 0,
  start = 'top 86%',
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useMotion(ref, (el) => {
    const targets = stagger > 0 ? Array.from(el.children) : [el];
    gsap.from(targets, {
      ...FROM[variant],
      autoAlpha: 0,
      duration: 0.9,
      delay,
      stagger,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start, toggleActions: 'play none none reverse' },
    });
  });

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
