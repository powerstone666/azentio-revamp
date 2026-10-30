'use client';

import { useRef } from 'react';
import { useStatsCountUp } from '@/app/(ui)/motion/hero-animations';

/**
 * Key stats band — navy background with big white numbers.
 * Azentio.com pattern: 5 stats with "+" suffix, offset tiles on the right.
 * Animated count-up via GSAP.
 */

const STATS = [
  { value: '650', suffix: '+', label: 'Clients' },
  { value: '30', suffix: '+', label: 'Years' },
  { value: '1900', suffix: '+', label: 'Professionals' },
  { value: '60', suffix: '+', label: 'Countries' },
  { value: '19', suffix: '', label: 'Locations' },
];

export default function StatsBand() {
  const statRefs = useRef<(HTMLDivElement | null)[]>([]);
  useStatsCountUp({ current: statRefs.current }, { duration: 2 });

  return (
    <section className="bg-az-navy py-20 md:py-24">
      <div className="mx-auto max-w-[1280px] px-5 md:px-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: Stats grid */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            {STATS.map((stat, i) => (
              <div key={stat.label}>
                <div
                  ref={(el) => { statRefs.current[i] = el; }}
                  className="text-[44px] font-semibold leading-tight text-white md:text-[52px]"
                  data-target={stat.value}
                >
                  {stat.value}{stat.suffix}
                </div>
                <p className="mt-1 text-[15px] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Right: Offset decorative tiles */}
          <div className="relative hidden h-[300px] lg:block">
            <div className="absolute right-10 top-0 h-[140px] w-[180px] rounded-xl bg-white opacity-90 shadow-lg" />
            <div className="absolute right-0 top-10 h-[130px] w-[160px] rounded-xl bg-az-mint opacity-80 shadow-lg" />
            <div className="absolute right-20 top-20 h-[110px] w-[140px] rounded-xl bg-az-green opacity-70 shadow-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}