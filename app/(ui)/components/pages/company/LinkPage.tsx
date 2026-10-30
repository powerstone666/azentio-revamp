import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowSquareOut } from '@phosphor-icons/react/ssr';
import PageHero, { type Crumb } from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import { Container } from '@/app/(ui)/components/public/ui';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';

export interface LinkCardData {
  title: string;
  text: string;
  href: string;
  /** Opens a separate Azentio site in a new tab. */
  external?: boolean;
}

// A page made of an explicit hero and a grid of link cards. Used where the live azentio.com page has no copy to reuse.
export default function LinkPage({
  eyebrow, title, intro, crumbs, photo, variant = 0, cards, note, children,
}: {
  eyebrow: string; title: string; intro: string; crumbs: Crumb[]; photo?: { src: string; alt: string };
  variant?: number; cards: LinkCardData[]; note?: string; children?: ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} intro={intro} crumbs={crumbs} photo={photo} variant={variant} />
      {children}
      <section className="py-12 md:py-16">
        <Container>
          <Reveal stagger={0.08} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Spotlight key={c.title} className="rounded-2xl">
                <Link
                  href={c.href}
                  {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="focus-ring group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-accent-strong/60"
                >
                  <h2 className="text-xl font-semibold text-ink">{c.title}</h2>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{c.text}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink group-hover:text-accent-strong">
                    {c.external ? 'Open (new tab)' : 'Continue'}
                    {c.external ? <ArrowSquareOut size={16} weight="bold" aria-hidden /> : <ArrowRight size={16} weight="bold" aria-hidden />}
                  </span>
                </Link>
              </Spotlight>
            ))}
          </Reveal>
          {note && <p className="mt-8 max-w-2xl text-sm text-faint">{note}</p>}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
