import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { Container } from '@/app/(ui)/components/public/ui';
import { ShapeArt } from '@/app/(ui)/components/public/ShapePhoto';
import Reveal from '@/app/(ui)/motion/Reveal';

// Closing call-to-action used at the bottom of inner pages.
export default function CtaBand({
  title = 'Let’s begin our journey together.',
  body = 'We’d love to hear from you and answer your questions.',
  href = '/connect',
  label = 'Book a demo',
  variant = 1,
}: { title?: string; body?: string; href?: string; label?: string; variant?: number }) {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <div className="grid overflow-hidden rounded-3xl bg-az-mint-tint md:grid-cols-[1.2fr_0.8fr]">
          <Reveal className="px-8 py-12 md:px-12">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-az-navy md:text-4xl">{title}</h2>
            <p className="mt-4 max-w-md text-lg text-az-navy/70">{body}</p>
            <Link href={href} className="focus-ring mt-7 inline-flex items-center gap-2 rounded-full bg-az-navy px-7 py-3.5 font-semibold text-white transition hover:bg-az-navy/90">
              {label} <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          </Reveal>
          <ShapeArt variant={variant} className="hidden min-h-[200px] md:block" />
        </div>
      </Container>
    </section>
  );
}
