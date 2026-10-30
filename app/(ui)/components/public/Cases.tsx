import Link from 'next/link';
import ShapePhoto from './ShapePhoto';
import { ArrowRight, Bank, CirclesFour, Umbrella } from '@phosphor-icons/react/ssr';
import HorizontalTrack from '@/app/(ui)/motion/HorizontalTrack';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { CASES } from '@/app/(config)/home';
import { Container, Eyebrow } from './ui';

const CASE_PHOTOS = ['case-qiic', 'case-bahrain', 'case-pnb', 'case-mh', 'case-boubyan', 'case-printing'];
const TAG_ICON = { Banking: Bank, Insurance: Umbrella, ERP: CirclesFour } as const;

export default function Cases() {
  return (
    <section className="bg-surface-2/50 py-14 md:py-20">
      <Container className="!max-w-none !px-0">
        <HorizontalTrack
          header={
            <div className="mx-auto w-full max-w-[1240px] px-5 md:px-8">
              <Eyebrow>Case studies</Eyebrow>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-ink md:text-5xl">
                Proof in production, <span className="text-accent-strong">across three regions.</span>
              </h2>
            </div>
          }
        >
          {CASES.map((c, i) => (
            <Spotlight key={c.title} className="w-[82vw] shrink-0 snap-start rounded-2xl sm:w-[420px]">
              <article className="group flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-line bg-surface p-7">
                <ShapePhoto src={`/images/${CASE_PHOTOS[i]}.jpg`} alt={c.title} mode="wide" variant={i} className="-mx-7 -mt-7 mb-6 h-44" sizes="420px" />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/15 px-3 py-1 text-xs font-semibold text-violet">{(() => { const I = TAG_ICON[c.tag as keyof typeof TAG_ICON] ?? Bank; return <I size={14} weight="duotone" aria-hidden />; })()}{c.tag}</span>
                  <span className="font-medium text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-6 text-xl font-semibold leading-snug tracking-tight text-ink">{c.title}</h3>
                <p className="mt-3 line-clamp-5 text-[15px] leading-relaxed text-muted">{c.text}</p>
                <Link href="/insights/case-studies-and-testimonials" className="focus-ring mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-ink hover:text-accent-strong">
                  Read more <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
              </article>
            </Spotlight>
          ))}
        </HorizontalTrack>
      </Container>
    </section>
  );
}
