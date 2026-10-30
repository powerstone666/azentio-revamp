'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from './gsap';
import { useMotion, MOTION_DESKTOP } from './useMotion';

export interface PinnedStep {
  label: string;
  icon: ReactNode;
  title: string;
  body: string;
  visual: ReactNode;
}

// Desktop + motion: the section pins and scroll scrubs through the steps.
// Otherwise (mobile, reduced motion) the steps stack as a plain list.
export default function PinnedSteps({ steps }: { steps: PinnedStep[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(
    ref,
    (el) => {
      const copies = gsap.utils.toArray<HTMLElement>('[data-step-copy]', el);
      const visuals = gsap.utils.toArray<HTMLElement>('[data-step-visual]', el);
      const dots = gsap.utils.toArray<HTMLElement>('[data-step-dot]', el);
      const bar = el.querySelector<HTMLElement>('[data-step-bar]');
      const stage = el.querySelector<HTMLElement>('[data-step-stage]');
      const copyStage = el.querySelector<HTMLElement>('[data-step-copystage]');
      if (!stage || !copyStage) return;

      // Fill the viewport below the floating navbar and centre the content, so tall screens have no dead space.
      gsap.set(el, { minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center' });
      gsap.set([stage, copyStage], { position: 'relative', height: 'min(60vh, 540px)' });
      gsap.set([...copies, ...visuals], { position: 'absolute', inset: 0, autoAlpha: 0 });
      gsap.set(el.querySelector('[data-step-mobile]'), { display: 'none' });
      gsap.set(el.querySelector('[data-step-desktop]'), { display: 'grid', width: '100%' });

      const n = steps.length;
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: el,
          start: 'top top+=110',
          end: `+=${n * 70}%`,
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
        },
      });
      tl.to(bar, { scaleY: 1, ease: 'none', duration: n }, 0);
      steps.forEach((_, i) => {
        const at = i;
        tl.fromTo(copies[i], { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at)
          .fromTo(visuals[i], { autoAlpha: 0, scale: 0.94, y: 28 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.4 }, at)
          .to(dots[i], { scale: 1.6, backgroundColor: 'var(--accent)', duration: 0.2 }, at);
        if (i < n - 1) {
          tl.to([copies[i], visuals[i]], { autoAlpha: 0, y: -28, duration: 0.3 }, at + 0.7)
            .to(dots[i], { scale: 1, duration: 0.2 }, at + 0.7);
        }
      });
    },
    { query: MOTION_DESKTOP },
  );

  return (
    <div ref={ref}>
      {/* Desktop pinned layout (revealed by GSAP). */}
      <div data-step-desktop className="hidden items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative flex gap-8">
          <div className="relative w-px shrink-0 bg-line">
            <div data-step-bar className="absolute inset-0 origin-top scale-y-0 bg-accent" />
            <div className="absolute -left-[5px] top-0 flex h-full flex-col justify-between py-1">
              {steps.map((s) => (
                <span key={s.label} data-step-dot className="h-[11px] w-[11px] rounded-full bg-line" />
              ))}
            </div>
          </div>
          <div data-step-copystage className="flex-1">
            {steps.map((s) => (
              <div key={s.label} data-step-copy className="flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent">{s.icon}</span>
                  <p className="font-medium text-xs uppercase tracking-[0.18em] text-accent-strong">{s.label}</p>
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{s.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div data-step-stage>
          {steps.map((s) => (
            <div key={s.label} data-step-visual className="flex items-center justify-center">
              {s.visual}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile / reduced-motion stacked layout. */}
      <ol data-step-mobile className="grid gap-6 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.label} className="rounded-2xl border border-line bg-surface p-6">
            <p className="flex items-center gap-2 font-medium text-xs uppercase tracking-[0.18em] text-accent-strong">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">{s.icon}</span>
              {String(i + 1).padStart(2, '0')} · {s.label}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{s.title}</h3>
            <p className="mt-2 text-muted">{s.body}</p>
            <div className="mt-5">{s.visual}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
