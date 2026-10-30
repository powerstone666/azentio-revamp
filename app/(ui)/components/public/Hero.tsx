'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useHeroReveal } from '@/app/(ui)/motion/hero-animations';

/**
 * Homepage hero — Azentio signature pattern:
 * Left: large two-line headline with mint underline, paragraph,
 * mint pill CTA, dot pager.
 * Right: geometric green shape collage placeholder.
 * GSAP staggered entrance animation on children.
 */

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);

  // GSAP staggered reveal — disabled under reduced motion
  useHeroReveal(heroRef, { delay: 0.1, duration: 0.7, stagger: 0.15 });

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-20 md:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: Copy */}
          <div ref={heroRef}>
            <h1 className="text-[48px] font-semibold leading-[1.1] text-az-navy md:text-[70px]">
              Build intelligence.
              <br />
              <span className="az-underline">Create shared value.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-az-text-muted">
              Enterprise AI and secure collaboration portal for Azentio&apos;s banking,
              insurance, and capital markets offerings. Explore products, request demos,
              or join the collective learning community.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/request-demo"
                className="inline-block rounded-[50px] bg-az-mint px-8 py-3.5 text-[16px] font-semibold text-az-navy transition-all duration-300 hover:bg-az-mint/80 hover:shadow-lg"
              >
                Book a demo
              </Link>
              <Link
                href="/products"
                className="inline-block rounded-[50px] border-2 border-az-navy px-8 py-3.5 text-[16px] font-semibold text-az-navy transition-all duration-300 hover:bg-az-navy hover:text-white"
              >
                Explore solutions
              </Link>
            </div>

            {/* Dot pager (carousel indicator) */}
            <div className="mt-10 flex gap-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                    i === 0 ? 'w-8 bg-az-navy' : 'bg-gray-300'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Right: Geometric shape collage */}
          <div className="relative hidden lg:block">
            <div className="relative h-[500px] w-full">
              {/* Decorative geometric shapes in az-green */}
              <svg
                className="absolute right-0 top-0 h-full w-full"
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Large circle */}
                <circle cx="350" cy="180" r="120" fill="#2ED88E" opacity="0.15" />
                {/* Arc */}
                <path d="M50 400 Q200 250 400 350" stroke="#2ED88E" strokeWidth="8" opacity="0.3" fill="none" />
                {/* Triangle */}
                <polygon points="380,80 480,280 280,280" fill="#2ED88E" opacity="0.12" />
                {/* Horizontal bars */}
                <rect x="60" y="120" width="200" height="12" rx="6" fill="#2ED88E" opacity="0.25" />
                <rect x="100" y="150" width="160" height="12" rx="6" fill="#2ED88E" opacity="0.2" />
                <rect x="130" y="180" width="120" height="12" rx="6" fill="#2ED88E" opacity="0.15" />
                {/* Small dots grid */}
                {Array.from({ length: 6 }).map((_, i) =>
                  Array.from({ length: 4 }).map((_, j) => (
                    <circle
                      key={`${i}-${j}`}
                      cx={60 + j * 30}
                      cy={300 + i * 25}
                      r="4"
                      fill="#2ED88E"
                      opacity="0.2"
                    />
                  ))
                )}
              </svg>

              {/* Frosted glass chip — Insurance / Consistent risk management */}
              <div className="absolute bottom-16 left-4 flex items-center gap-2 rounded-xl bg-white/80 px-4 py-3 shadow-lg backdrop-blur-md">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-az-green">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-az-navy">Insurance</p>
                  <p className="text-[12px] text-az-text-muted">Consistent risk management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}