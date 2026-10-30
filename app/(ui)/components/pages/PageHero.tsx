import type { ReactNode } from 'react';
import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react/ssr';
import { Container, Eyebrow, ButtonLink } from '@/app/(ui)/components/public/ui';
import ShapePhoto, { ShapeArt } from '@/app/(ui)/components/public/ShapePhoto';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import Reveal from '@/app/(ui)/motion/Reveal';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  crumbs?: Crumb[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Photo in an arch over green geometry. Omit to show geometry only. */
  photo?: { src: string; alt: string };
  /** 0-3: which green geometry to use. */
  variant?: number;
  children?: ReactNode;
}

export default function PageHero({ eyebrow, title, intro, crumbs, primary, secondary, photo, variant = 0, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      <Container className="grid items-center gap-10 py-10 md:py-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {crumbs && crumbs.length > 1 && (
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-1 text-sm text-faint">
                {crumbs.map((c, i) => (
                  <li key={c.label} className="flex items-center gap-1">
                    {i > 0 && <CaretRight size={12} aria-hidden />}
                    {c.href ? <Link href={c.href} className="focus-ring hover:text-ink">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <Eyebrow>{eyebrow}</Eyebrow>
          <SplitHeading as="h1" className="mt-4 text-4xl font-semibold leading-[1.06] tracking-tight text-ink md:text-6xl">{title}</SplitHeading>
          {intro && (
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{intro}</p>
            </Reveal>
          )}
          {(primary || secondary) && (
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap gap-3">
                {primary && <ButtonLink href={primary.href}>{primary.label}</ButtonLink>}
                {secondary && <ButtonLink href={secondary.href} variant="ghost">{secondary.label}</ButtonLink>}
              </div>
            </Reveal>
          )}
          {children}
        </div>
        <Reveal variant="scale" className="relative">
          {photo ? (
            <ShapePhoto src={photo.src} alt={photo.alt} variant={variant} className="h-72 rounded-3xl md:h-[26rem]" sizes="(min-width: 1024px) 40vw, 92vw" />
          ) : (
            <ShapeArt variant={variant} className="h-56 rounded-3xl md:h-[22rem]" />
          )}
        </Reveal>
      </Container>
    </section>
  );
}
