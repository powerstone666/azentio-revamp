'use client';

import { useRef } from 'react';
import { gsap, DrawSVGPlugin, MotionPathPlugin } from '@/app/(ui)/motion/gsap';
import { useMotion } from '@/app/(ui)/motion/useMotion';

void DrawSVGPlugin;
void MotionPathPlugin;

// Azentio-style flat green geometry that stays in view beside the sign-in form and moves.
// Reduced motion: renders static.
export default function SigninGeometry() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    const q = gsap.utils.selector(el);
    const ring = gsap.utils.toArray<SVGPathElement>('[data-ring]', el)[0];
    gsap.set(q('[data-bar], [data-tri], [data-half], [data-quarter], [data-orb], [data-dot]'), { transformBox: 'fill-box' });
    gsap.set(q('[data-bar]'), { transformOrigin: '50% 100%' });
    gsap.set(q('[data-tri]'), { transformOrigin: '50% 100%' });
    gsap.set(q('[data-orb], [data-dot]'), { transformOrigin: '50% 50%' });

    // Entrance
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(q('[data-bar]'), { scaleY: 0, duration: 1, stagger: 0.14 }, 0.1)
      .from(q('[data-half]'), { y: 90, autoAlpha: 0, duration: 1.1 }, 0.2)
      .from(q('[data-tri]'), { y: 120, autoAlpha: 0, duration: 1.1 }, 0.35)
      .from(q('[data-quarter]'), { x: 90, autoAlpha: 0, duration: 1.1 }, 0.5)
      .from(ring, { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut' }, 0.4)
      .from(q('[data-orb]'), { scale: 0, duration: 0.7, ease: 'back.out(2.4)' }, 1.1)
      .from(q('[data-dot]'), { scale: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(3)' }, 1.2);

    // Ambient motion
    gsap.to(q('[data-bar]'), { scaleY: 0.72, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: { each: 0.35, from: 'start' }, delay: 1.2 });
    gsap.to(q('[data-half]'), { y: -14, duration: 4.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2 });
    gsap.to(q('[data-tri]'), { y: -18, rotation: 3, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.4 });
    gsap.to(q('[data-quarter]'), { x: -16, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.4 });
    gsap.to(q('[data-orb]'), {
      motionPath: { path: ring, align: ring, alignOrigin: [0.5, 0.5] },
      duration: 12, repeat: -1, ease: 'none', delay: 1.2,
    });
    gsap.to(q('[data-dot]'), { opacity: 0.25, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.4, delay: 1.5 });
  });

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-clip">
      <div className="sticky top-16 h-[min(calc(100vh-4rem),100%)]">
        <svg viewBox="0 0 520 200" preserveAspectRatio="xMaxYMax meet" className="absolute bottom-0 right-0 h-[26%] min-h-[190px] w-auto max-w-full overflow-visible">
          <path data-ring d="M394 62a46 46 0 1 0 92 0a46 46 0 1 0-92 0" fill="none" stroke="#55FFBE" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="4 8" />
          <g fill="#2ED88E">
            <rect data-bar x="300" y="92" width="22" height="108" />
            <rect data-bar x="334" y="92" width="22" height="108" />
            <rect data-bar x="368" y="92" width="22" height="108" />
            <path data-half d="M0 200V70a130 130 0 0 1 130 130z" opacity=".9" />
            <path data-tri d="M185 200l75-110 75 110z" opacity=".55" />
          </g>
          <g fill="#55FFBE">
            <path data-quarter d="M520 200V92a108 108 0 0 0-108 108z" opacity=".35" />
            <circle data-orb cx="440" cy="62" r="11" />
            <circle data-dot cx="96" cy="34" r="5" />
            <circle data-dot cx="190" cy="22" r="4" />
            <circle data-dot cx="486" cy="150" r="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}
