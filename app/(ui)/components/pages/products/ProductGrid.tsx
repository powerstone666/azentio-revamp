import type { ReactNode } from 'react';
import Reveal from '@/app/(ui)/motion/Reveal';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import { Container } from '@/app/(ui)/components/public/ui';

// Section wrapper for a grid of cards, with a heading.
export default function ProductGrid({ title, body, children, tint = false }: { title: string; body?: string; children: ReactNode; tint?: boolean }) {
  return (
    <section className={`py-12 md:py-16 ${tint ? 'bg-surface-2/60' : ''}`}>
      <Container>
        <SplitHeading className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink md:text-4xl">{title}</SplitHeading>
        {body && <p className="mt-4 max-w-2xl text-lg text-muted">{body}</p>}
        <Reveal stagger={0.07} className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
