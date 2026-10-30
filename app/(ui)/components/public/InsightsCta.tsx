import Link from 'next/link';
import { ArrowRight, Lightbulb, Megaphone, Newspaper } from '@phosphor-icons/react/ssr';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import Magnetic from '@/app/(ui)/motion/Magnetic';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import { INSIGHTS } from '@/app/(config)/home';
import { Container } from './ui';
import ShapePhoto from './ShapePhoto';
import SectionHead from './SectionHead';

const TAG_ICON = [Lightbulb, Newspaper, Megaphone];

export default function InsightsCta() {
  return (
    <>
      <section className="py-14 md:py-20">
        <Container>
          <SectionHead eyebrow="Insights" title="Explore our insights." body="Find out more about the latest Azentio news, innovations, and market trends shaping our industry." />
          <Reveal stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
            {INSIGHTS.map((a, idx) => {
              const Icon = TAG_ICON[idx];
              return (
              <Spotlight key={a.title} className="rounded-2xl">
                <Link href={a.href} className="focus-ring group flex h-full min-h-[240px] flex-col rounded-2xl border border-line bg-surface p-7 transition hover:border-accent-strong/60">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent"><Icon size={24} weight="duotone" aria-hidden /></span>
                  <span className="mt-4 font-medium text-xs uppercase tracking-[0.14em] text-accent-strong">{a.tag}</span>
                  <h3 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-ink">{a.title}</h3>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-ink group-hover:text-accent-strong">
                    Read <ArrowRight size={16} weight="bold" aria-hidden />
                  </span>
                </Link>
              </Spotlight>
              );
            })}
          </Reveal>
        </Container>
      </section>

      <section className="px-5 pb-14 md:px-8 md:pb-20">
        <div className="mx-auto grid max-w-[1240px] items-stretch overflow-hidden rounded-3xl bg-az-mint-tint md:grid-cols-2">
          <div className="flex flex-col justify-center px-8 py-14 md:px-14">
            <SplitHeading className="text-4xl font-semibold leading-[1.08] tracking-tight text-az-navy md:text-5xl">
              Let’s begin our journey together.
            </SplitHeading>
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-md text-lg text-az-navy/70">We’d love to hear from you and answer your questions.</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Magnetic>
                  <Link href="/connect" className="focus-ring inline-flex items-center gap-2 rounded-full bg-az-navy px-8 py-4 text-[16px] font-semibold text-white transition hover:bg-az-navy/90">
                    Book a demo <ArrowRight size={18} weight="bold" aria-hidden />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/hackathon/register" className="focus-ring inline-flex items-center rounded-full border border-az-navy/30 px-8 py-4 text-[16px] font-semibold text-az-navy transition hover:border-az-navy">
                    Join a hackathon
                  </Link>
                </Magnetic>
              </div>
            </Reveal>
          </div>
          <ShapePhoto src="/images/photo-team.jpg" alt="Colleagues collaborating around a laptop" mode="wide" variant={2} className="min-h-[280px]" sizes="(min-width: 768px) 620px, 92vw" />
        </div>
      </section>
    </>
  );
}
