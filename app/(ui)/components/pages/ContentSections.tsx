import { CheckCircle, CaretDown } from '@phosphor-icons/react/ssr';
import { Container, Eyebrow } from '@/app/(ui)/components/public/ui';
import { ShapeArt } from '@/app/(ui)/components/public/ShapePhoto';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import type { ContentSection } from '@/app/(config)/content';

// Headings the scrape repeats on many pages (carousels, shared blocks). Pages render their own versions of these.
const NOISE_HEADINGS = [
  'explore our insights', 'what our customers say', 'committed to innovation', 'case studies', 'awards', 'impact by numbers',
  'let’s begin our journey', 'related products', 'products',
];
const NOISE_TEXT = /^(download|view|read more|learn more|find out more|request a demo|book a demo|explore|your browser|view all|eol |connect with azentio|insights$|awards$|products$)/i;

const isHeadingNoise = (h: string) => !h.trim() || NOISE_HEADINGS.some((n) => h.toLowerCase().startsWith(n));
const isProse = (t: string) => t.length >= 60 && !t.startsWith('• ') && !NOISE_TEXT.test(t);

interface ContentSectionsProps {
  sections: ContentSection[];
  /** Headings (prefix match, case-insensitive) to skip in addition to the built-in noise list. */
  exclude?: string[];
  /** Keep sections whose heading is normally treated as noise, e.g. ['products'] on category pages. */
  keep?: string[];
}

export default function ContentSections({ sections, exclude = [], keep = [] }: ContentSectionsProps) {
  const rows = sections.filter((s) => {
    const h = s.heading.toLowerCase();
    if (exclude.some((e) => h.startsWith(e.toLowerCase()))) return false;
    if (keep.some((k) => h.startsWith(k.toLowerCase()))) return true;
    return !isHeadingNoise(s.heading);
  });

  return (
    <>
      {rows.map((s, idx) => {
        const isFaq = /frequently asked/i.test(s.heading);
        const prose = s.text.filter((t) => isProse(t));
        const bullets = s.text.filter((t) => t.startsWith('• ')).map((t) => t.slice(2));
        const cards = s.cards.filter((c) => c.title && c.text);
        if (!isFaq && prose.length === 0 && bullets.length === 0 && cards.length === 0) return null;
        const alt = idx % 2 === 1;
        const plain = !isFaq && cards.length === 0 && bullets.length === 0;
        const asCards = plain && prose.length >= 3;
        const split = plain && prose.length > 0 && prose.length < 3;

        if (split) {
          return (
            <section key={`${idx}-${s.heading}`} className={`py-12 md:py-16 ${alt ? 'bg-surface-2/60' : ''}`}>
              <Container>
                <div className="grid items-center gap-10 lg:grid-cols-2">
                  <div>
                    {s.heading && <SplitHeading className="text-3xl font-semibold leading-[1.1] tracking-tight text-ink md:text-4xl">{s.heading}</SplitHeading>}
                    <Reveal className="mt-5 space-y-4">
                      {prose.map((t) => (
                        <p key={t} className="text-lg leading-relaxed text-muted">{t}</p>
                      ))}
                    </Reveal>
                  </div>
                  <Reveal variant="scale">
                    <ShapeArt variant={idx} className="h-64 rounded-3xl md:h-80" />
                  </Reveal>
                </div>
              </Container>
            </section>
          );
        }

        return (
          <section key={`${idx}-${s.heading}`} className={`py-12 md:py-16 ${alt ? 'bg-surface-2/60' : ''}`}>
            <Container>
              {s.heading && (
                <SplitHeading className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink md:text-4xl">{s.heading}</SplitHeading>
              )}
              {asCards && (
                <Reveal stagger={0.08} className={`mt-8 grid gap-5 md:grid-cols-2 ${prose.length === 3 ? 'lg:grid-cols-3' : ''}`}>
                  {prose.map((t) => (
                    <Spotlight key={t} className="rounded-2xl">
                      <article className="flex h-full gap-4 rounded-2xl border border-line bg-surface p-6">
                        <CheckCircle size={26} weight="fill" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
                        <p className="text-[16px] leading-relaxed text-ink">{t}</p>
                      </article>
                    </Spotlight>
                  ))}
                </Reveal>
              )}
              {!asCards && prose.length > 0 && (
                <Reveal className="mt-5 max-w-3xl space-y-4">
                  {prose.map((t) => (
                    <p key={t} className="text-lg leading-relaxed text-muted">{t}</p>
                  ))}
                </Reveal>
              )}
              {bullets.length > 0 && (
                <Reveal as="ul" stagger={0.06} className="mt-6 grid gap-3 sm:grid-cols-2">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[15px] text-ink">
                      <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
                      {b}
                    </li>
                  ))}
                </Reveal>
              )}
              {isFaq && cards.length > 0 ? (
                <Reveal as="div" stagger={0.06} className="mt-8 max-w-3xl divide-y divide-line rounded-2xl border border-line bg-surface">
                  {cards.map((c) => (
                    <details key={c.title} className="group px-6 py-5">
                      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                        {c.title}
                        <CaretDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden />
                      </summary>
                      <p className="mt-3 leading-relaxed text-muted">{c.text}</p>
                    </details>
                  ))}
                </Reveal>
              ) : (
                cards.length > 0 && (
                  <Reveal stagger={0.08} className={`mt-8 grid gap-5 ${cards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                    {cards.map((c, i) => (
                      <Spotlight key={c.title} className="rounded-2xl">
                        <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
                          <h3 className="mt-5 text-lg font-semibold text-ink">{c.title}</h3>
                          <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.text}</p>
                        </article>
                      </Spotlight>
                    ))}
                  </Reveal>
                )
              )}
            </Container>
          </section>
        );
      })}
    </>
  );
}

export { Eyebrow };
