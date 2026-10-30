import Marquee from '@/app/(ui)/motion/Marquee';
import { Quotes } from '@phosphor-icons/react/ssr';
import { QUOTES } from '@/app/(config)/home';
import { Container } from './ui';
import SectionHead from './SectionHead';

export default function Testimonials() {
  return (
    <section className="bg-surface-2/50 py-14 md:py-20">
      <Container>
        <SectionHead eyebrow="Customers" title="What our customers say." />
      </Container>
      <div className="mt-12">
        <Marquee duration={90}>
          {QUOTES.map((q) => (
            <figure key={q.name} className="flex w-[420px] shrink-0 flex-col rounded-2xl border border-line bg-surface p-7">
              <Quotes size={28} weight="fill" className="text-accent" aria-hidden />
              <blockquote className="mt-4 line-clamp-6 text-[15px] leading-relaxed text-ink">{q.quote}</blockquote>
              <figcaption className="mt-5">
                <span className="block text-sm font-semibold text-ink">{q.name}</span>
                <span className="block text-sm text-muted">{q.role}</span>
              </figcaption>
            </figure>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
