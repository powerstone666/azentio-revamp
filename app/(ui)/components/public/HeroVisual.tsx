'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { CheckCircle, Sparkle, ShieldCheck, UsersThree } from '@phosphor-icons/react';
import { gsap, DrawSVGPlugin, MotionPathPlugin } from '@/app/(ui)/motion/gsap';
import { useMotion, MOTION_POINTER } from '@/app/(ui)/motion/useMotion';

void DrawSVGPlugin;
void MotionPathPlugin;

const W = 600;
const H = 600;
const HUB = { x: 300, y: 185 };
const NODES = [
  { photo: 'hero-bank', label: 'Retail bank', x: 80, y: 60 },
  { photo: 'hero-insurer', label: 'Insurer', x: 520, y: 55 },
  { photo: 'hero-wealth', label: 'Wealth manager', x: 70, y: 275 },
  { photo: 'hero-compliance', label: 'Compliance team', x: 530, y: 285 },
];
const pct = (v: number, total: number) => `${(v / total) * 100}%`;
const curve = (x: number, y: number) =>
  `M${x} ${y} C ${x + (HUB.x - x) * 0.55} ${y}, ${x + (HUB.x - x) * 0.45} ${HUB.y}, ${HUB.x} ${HUB.y}`;

export default function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);

  // Story: hub appears, then each organisation pops in, gets connected to the hub (and a packet starts flowing),
  // then the product card appears and ticks through its steps, then the chips. Replays whenever it scrolls back into view.
  useMotion(ref, (el) => {
    const q = gsap.utils.selector(el);
    const lines = gsap.utils.toArray<SVGPathElement>('[data-link]', el);
    const nodes = gsap.utils.toArray<HTMLElement>('[data-node]', el);
    const packets = gsap.utils.toArray<SVGCircleElement>('[data-packet]', el);
    const count = q('[data-count]')[0] as HTMLElement | undefined;
    const STEP = 1.05;

    const loops = packets.map((p, i) =>
      gsap.to(p, {
        motionPath: { path: lines[i], align: lines[i], alignOrigin: [0.5, 0.5] },
        duration: 2.6 + i * 0.3,
        repeat: -1,
        repeatDelay: 0.4,
        ease: 'power1.inOut',
        paused: true,
      }),
    );

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 5%', toggleActions: 'restart none restart reset' },
    });
    tl.call(() => { loops.forEach((l) => l.pause(0)); if (count) count.textContent = '0'; }, undefined, 0)
      .set(packets, { autoAlpha: 0 }, 0)
      .from(q('[data-orb]'), { autoAlpha: 0, scale: 0.6, duration: 1.4, stagger: 0.2 }, 0)
      .from(q('[data-hub]'), { scale: 0, duration: 0.8, ease: 'back.out(2)' }, 0.2)
      .from(q('[data-pulsewrap]'), { autoAlpha: 0, duration: 0.4 }, 0.6)
      .from(q('[data-ring]'), { scale: 0.4, autoAlpha: 0, duration: 1, stagger: 0.15 }, 0.5);

    nodes.forEach((node, i) => {
      const t = 1.1 + i * STEP;
      tl.from(node, { scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.4)' }, t)
        .from(lines[i], { drawSVG: '0%', duration: 0.65, ease: 'power2.inOut' }, t + 0.45)
        .to(q('[data-hub]'), { scale: 1.14, duration: 0.15, yoyo: true, repeat: 1 }, t + 1.05)
        .set(packets[i], { autoAlpha: 1 }, t + 1.05)
        .call(() => { loops[i].play(0); if (count) count.textContent = String(i + 1); }, undefined, t + 1.05);
    });

    const cards = 1.1 + nodes.length * STEP + 0.3;
    tl.from(q('[data-window]'), { y: 60, autoAlpha: 0, scale: 0.94, duration: 0.8 }, cards)
      .from(q('[data-row]'), { x: -24, autoAlpha: 0, duration: 0.45, stagger: 0.35 }, cards + 0.5)
      .from(q('[data-check]'), { drawSVG: '0%', duration: 0.4, stagger: 0.35, ease: 'power2.out' }, cards + 0.7)
      .from(q('[data-progress]'), { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power2.inOut' }, cards + 0.5)
      .from(q('[data-chip]'), { y: 26, scale: 0.7, autoAlpha: 0, duration: 0.6, stagger: 0.5, ease: 'back.out(2)' }, cards + 1.8);

    // Ambient motion that never stops.
    gsap.to(q('[data-spin="cw"]'), { rotation: 360, svgOrigin: `${HUB.x} ${HUB.y}`, duration: 28, repeat: -1, ease: 'none' });
    gsap.to(q('[data-spin="ccw"]'), { rotation: -360, svgOrigin: `${HUB.x} ${HUB.y}`, duration: 40, repeat: -1, ease: 'none' });
    gsap.to(q('[data-pulse]'), { scale: 2.1, autoAlpha: 0, transformOrigin: '50% 50%', duration: 2.4, repeat: -1, ease: 'power1.out' });
    gsap.to(q('[data-bob]'), { y: 'random(-7, 7)', duration: 'random(2.2, 3.6)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.3 });
    gsap.to(q('[data-float]'), { y: 'random(-12, 12)', x: 'random(-6, 6)', duration: 'random(3, 5)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.5 });
    gsap.to(q('[data-orb]'), { x: 'random(-30, 30)', y: 'random(-30, 30)', duration: 'random(6, 9)', repeat: -1, yoyo: true, ease: 'sine.inOut' });
  });

  // Pointer parallax: back, mid and front layers drift by different amounts.
  useMotion(
    ref,
    (el) => {
      const layers = [
        { sel: '[data-depth="1"]', k: 10 },
        { sel: '[data-depth="2"]', k: 22 },
        { sel: '[data-depth="3"]', k: 38 },
      ].map(({ sel, k }) => {
        const node = el.querySelector(sel);
        return { k, x: gsap.quickTo(node, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(node, 'y', { duration: 0.9, ease: 'power3.out' }) };
      });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach((l) => { l.x(nx * l.k); l.y(ny * l.k); });
      };
      const leave = () => layers.forEach((l) => { l.x(0); l.y(0); });
      window.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        window.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      };
    },
    { query: MOTION_POINTER },
  );

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[640px]" style={{ aspectRatio: `${W} / ${H}` }}>
      {/* depth 1: glows */}
      <div data-depth="1" className="absolute inset-0">
        <div data-orb className="absolute -left-4 top-6 h-52 w-52 rounded-full bg-accent/30 blur-3xl" />
        <div data-orb className="absolute -right-2 bottom-10 h-60 w-60 rounded-full bg-violet/25 blur-3xl" />
      </div>

      {/* depth 2: network */}
      <div data-depth="2" className="absolute inset-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" fill="none" aria-hidden>
          <g data-spin="cw">
            <circle data-ring cx={HUB.x} cy={HUB.y} r="64" stroke="var(--accent-strong)" strokeOpacity="0.5" strokeDasharray="3 7" strokeWidth="1.5" />
          </g>
          <g data-spin="ccw">
            <circle data-ring cx={HUB.x} cy={HUB.y} r="96" stroke="var(--violet)" strokeOpacity="0.4" strokeDasharray="2 9" strokeWidth="1.5" />
            <circle cx={HUB.x + 96} cy={HUB.y} r="4.5" fill="var(--violet)" />
          </g>
          {NODES.map((n) => (
            <path key={n.label} data-link d={curve(n.x, n.y)} stroke="var(--accent-strong)" strokeOpacity="0.5" strokeWidth="1.5" />
          ))}
          {NODES.map((n) => (
            <circle key={`p-${n.label}`} data-packet r="5" cx={n.x} cy={n.y} fill="var(--accent)" />
          ))}
          <g data-pulsewrap><circle data-pulse cx={HUB.x} cy={HUB.y} r="30" fill="var(--accent)" fillOpacity="0.3" /></g>
        </svg>

        <div data-hub className="absolute flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_10px_40px_-6px_var(--glow)]" style={{ left: pct(HUB.x, W), top: pct(HUB.y, H) }}>
          <Sparkle size={30} weight="duotone" />
        </div>
        <p className="absolute -translate-x-1/2 text-xs font-medium text-faint" style={{ left: pct(HUB.x, W), top: pct(HUB.y + 46, H) }}>Shared learning</p>

        {NODES.map(({ photo, ...n }) => (
          <div key={n.label} data-node className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pct(n.x, W), top: pct(n.y, H) }}>
            <div data-bob className="flex flex-col items-center gap-1.5">
              <span className="relative block h-[68px] w-[68px] overflow-hidden rounded-full ring-4 ring-accent shadow-soft">
                <Image src={`/images/${photo}.jpg`} alt="" fill sizes="68px" className="object-cover object-[50%_18%]" />
              </span>
              <span className="whitespace-nowrap rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-muted">{n.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* depth 3: product window + chips */}
      <div data-depth="3" className="absolute inset-0">
        <div data-window className="absolute bottom-0 left-1/2 w-[66%] -translate-x-1/2 rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <UsersThree size={18} weight="duotone" className="text-accent-strong" />
            <p className="text-[13px] font-semibold text-ink">Seasonality in SME credit</p>
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
              <span data-count>3</span> organisations
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div data-progress className="h-full w-full rounded-full bg-gradient-to-r from-accent to-violet" />
          </div>
          <ul className="mt-3 space-y-1.5">
            {['Consent captured', 'Moderator approved', 'De-identified shared copy'].map((t) => (
              <li key={t} data-row className="flex items-center gap-2 text-[12px] text-ink">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="11" fill="var(--accent)" fillOpacity="0.2" />
                  <path data-check d="M7 12.5l3.2 3.2L17 9" stroke="var(--accent-strong)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-faint">Illustrative · synthetic data</p>
        </div>

        <div data-float className="absolute right-[1%] top-[59%]">
          <div data-chip className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 whitespace-nowrap text-[12px] font-medium text-ink shadow-soft">
            <CheckCircle size={18} weight="fill" className="text-accent-strong" /> Approved to share
          </div>
        </div>
        <div data-float className="absolute left-[1%] top-[59%]">
          <div data-chip className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink shadow-soft">
            <ShieldCheck size={18} weight="fill" className="text-violet" /> Private by default
          </div>
        </div>
      </div>
    </div>
  );
}
