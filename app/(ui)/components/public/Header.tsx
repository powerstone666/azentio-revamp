'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ArrowRight, Bank, CaretDown, ChartLineUp, CirclesFour, Flask, Handshake, Lightbulb,
  List, Newspaper, PlayCircle, Rocket, ShieldCheck, Umbrella, X, Cpu,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { NAV, type NavItem } from '@/app/(config)/nav';
import Magnetic from '@/app/(ui)/motion/Magnetic';
import { gsap } from '@/app/(ui)/motion/gsap';
import { useMotion } from '@/app/(ui)/motion/useMotion';

const ICONS: Record<string, Icon> = {
  Banking: Bank, 'Capital markets': ChartLineUp, 'Risk & compliance': ShieldCheck, Insurance: Umbrella, 'Azentio ERP': CirclesFour,
  'AI Lab': Flask, Technology: Cpu, Hackathons: Rocket, 'Media & videos': PlayCircle, Insights: Newspaper, Support: Handshake,
};

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href && item.href !== '/') {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  }
  if (item.children) {
    return item.children.some(
      (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
    );
  }
  return false;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Full-width flat bar at the top of the page; condenses into the floating pill as you scroll.
  useMotion(ref, (el) => {
    gsap.to(el, { '--float': 1, ease: 'none', scrollTrigger: { start: 0, end: 180, scrub: 0.4 } });
  });

  return (
    <header ref={ref} className="nav-shell sticky top-0 z-50">
      <div className="nav-frame relative">
        {/* Floating navbar backdrop */}
        <div aria-hidden className="nav-shadow absolute inset-0">
          <div className="cutout-bar nav-bar h-full" />
        </div>

        <div className="relative flex h-16 items-center justify-between gap-4 pl-6 pr-3 sm:pr-4">
          <Link href="/" className="focus-ring shrink-0" aria-label="azentio.ai home">
            <Image src="/brand/azentio-logo.svg" alt="Azentio" width={132} height={36} className="h-8 w-auto" priority />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = isItemActive(item, pathname);
              return (
                <div key={item.label} className="group relative">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`focus-ring relative flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] transition ${
                        active
                          ? 'font-semibold text-ink'
                          : 'font-medium text-ink/80 hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {item.label}
                      {item.children && <CaretDown size={12} weight="bold" className="transition group-hover:rotate-180" />}
                      {active && (
                        <span
                          className="absolute bottom-1 left-3.5 right-3.5 h-[2.5px] rounded-full bg-accent shadow-[0_1px_4px_var(--glow)]"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`focus-ring relative flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] cursor-pointer transition ${
                        active
                          ? 'font-semibold text-ink'
                          : 'font-medium text-ink/80 hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {item.label}
                      <CaretDown size={12} weight="bold" className="transition group-hover:rotate-180" />
                      {active && (
                        <span
                          className="absolute bottom-1 left-3.5 right-3.5 h-[2.5px] rounded-full bg-accent shadow-[0_1px_4px_var(--glow)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}
                  {item.children && (
                    <div className="invisible absolute left-0 top-full w-80 pt-4 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      <ul className="rounded-2xl border border-line bg-surface p-2 shadow-soft">
                        {item.children.map((c) => {
                          const I = ICONS[c.label] ?? Lightbulb;
                          const isChildActive = pathname === c.href || pathname.startsWith(`${c.href}/`);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                className={`focus-ring flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                                  isChildActive
                                    ? 'bg-accent/10 border-l-2 border-accent text-ink'
                                    : 'hover:bg-surface-2'
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                    isChildActive ? 'bg-accent text-on-accent shadow-sm' : 'bg-surface-2 text-ink/80'
                                  }`}
                                >
                                  <I size={22} weight="duotone" />
                                </span>
                                <span>
                                  <span className={`block text-[15px] ${isChildActive ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                                    {c.label}
                                  </span>
                                  {c.desc && <span className="block text-sm text-muted">{c.desc}</span>}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="focus-ring hidden rounded-full px-3.5 py-2 text-[15px] font-medium text-ink/80 hover:text-ink md:block cursor-pointer"
            >
              Sign in
            </Link>
            <div className="hidden sm:block">
              <Magnetic>
                <Link
                  href="/connect"
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-[0_4px_16px_-4px_var(--glow)] transition hover:brightness-105 active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer"
                >
                  <span>Request demo</span>
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </Magnetic>
            </div>
            <button
              type="button"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-line lg:hidden cursor-pointer active:scale-[0.96]"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="Mobile" className="absolute inset-x-0 top-[72px] rounded-3xl border border-line bg-surface p-4 shadow-soft lg:hidden">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const active = isItemActive(item, pathname);
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block rounded-lg px-3 py-2 font-medium ${
                          active ? 'bg-accent/10 font-semibold text-ink border-l-2 border-accent' : 'text-ink'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-faint">{item.label}</p>
                    )}
                    {item.children && (
                      <ul className="ml-3 border-l border-line pl-3">
                        {item.children.map((c) => {
                          const isChildActive = pathname === c.href || pathname.startsWith(`${c.href}/`);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                onClick={() => setOpen(false)}
                                className={`block rounded-lg px-3 py-1.5 ${
                                  isChildActive ? 'bg-accent/10 font-semibold text-ink' : 'text-muted hover:text-ink'
                                }`}
                              >
                                {c.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
              <li className="flex gap-3 pt-3">
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-full border border-line px-5 py-2.5 font-medium text-ink cursor-pointer">
                  Sign in
                </Link>
                <Link href="/connect" onClick={() => setOpen(false)} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-on-accent cursor-pointer">
                  Request demo
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
