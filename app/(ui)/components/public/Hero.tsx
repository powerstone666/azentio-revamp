'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Buildings, GlobeHemisphereWest, MapPin } from '@phosphor-icons/react';
import { gsap } from '@/app/(ui)/motion/gsap';
import { useMotion } from '@/app/(ui)/motion/useMotion';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import Magnetic from '@/app/(ui)/motion/Magnetic';
import Parallax from '@/app/(ui)/motion/Parallax';
import { HOME_INTRO } from '@/app/(config)/home';
import HeroVisual from './HeroVisual';
import { Container, Eyebrow } from './ui';

export default function Hero() {
  const ref = useRef<HTMLElement>(null);

  useMotion(ref, (el) => {
    const items = gsap.utils.toArray<HTMLElement>('[data-hero-item]', el);
    gsap.fromTo(
      items,
      { y: 28, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.9,
        stagger: 0.12,
        delay: 0.55,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'bottom top', toggleActions: 'play none restart reset' },
      },
    );
  });

  return (
    <section ref={ref} className="relative overflow-hidden">
      <Parallax amount={10} className="pointer-events-none absolute inset-0">
        <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,#000,transparent_70%)]" />
        <div className="absolute -top-40 left-1/3 h-[480px] w-[480px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[420px] w-[420px] rounded-full bg-violet/20 blur-[120px]" />
      </Parallax>

      <Container className="relative grid items-center gap-14 pb-12 pt-8 md:pb-16 md:pt-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div data-hero data-hero-item>
            <Eyebrow>azentio.ai · Intelligence & collaboration</Eyebrow>
          </div>
          <SplitHeading
            as="h1"
            immediate
            delay={0.15}
            className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[72px]"
          >
            Transformative technology that <span className="text-accent-strong">learns with you.</span>
          </SplitHeading>
          <p data-hero data-hero-item className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            {HOME_INTRO}
          </p>
          <div data-hero data-hero-item className="mt-9 flex flex-wrap items-center gap-4">
            <Magnetic>
              <Link href="/connect" className="focus-ring inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[16px] font-semibold text-on-accent shadow-[0_10px_40px_-10px_var(--glow)] transition hover:brightness-105">
                Request a demo <ArrowRight size={18} weight="bold" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/products" className="focus-ring inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-7 py-3.5 text-[16px] font-semibold text-ink transition hover:border-accent-strong">
                Explore solutions
              </Link>
            </Magnetic>
          </div>
          <ul data-hero data-hero-item className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted">
            {[[Buildings, '650+ clients'], [GlobeHemisphereWest, '60+ countries'], [MapPin, 'Middle East, Africa & Asia']].map(([I, t]) => {
              const Icon = I as typeof Buildings;
              return (
                <li key={t as string} className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-on-accent"><Icon size={18} weight="bold" aria-hidden /></span> {t as string}
                </li>
              );
            })}
          </ul>
        </div>
        <HeroVisual />
      </Container>
      <Container className="relative pb-8">
        <div data-hero data-hero-item className="text-sm text-faint">
          <p className="font-medium text-muted">Built by Tech Wizards for the Azentio Hackathon, 31 Oct 2026</p>
          <p className="mt-1">
            <a href="https://github.com/powerstone666" target="_blank" rel="noopener noreferrer" className="focus-ring underline-offset-4 hover:text-ink hover:underline">
              Imran Pasha
            </a>
            {' · '}Koora Sai Sujith{' · '}Sai Surya Teja Gontumukkala
          </p>
        </div>
      </Container>
    </section>
  );
}
