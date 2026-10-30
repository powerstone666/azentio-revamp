import { Flask, Sliders, ChartLineUp, Stack, GameController, ArrowRight } from '@phosphor-icons/react/ssr';
import type { Icon } from '@phosphor-icons/react';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import { Container, ButtonLink } from '@/app/(ui)/components/public/ui';
import Reveal from '@/app/(ui)/motion/Reveal';

const TAG = 'Illustrative sandbox, synthetic data, not a credit decision';

const SANDBOXES: { title: string; body: string; icon: Icon }[] = [
  {
    title: 'Credit Strategy Simulator',
    body: 'Explore how different credit policy settings could play out across a synthetic loan book. Compare scenarios side by side to build intuition before any real policy discussion.',
    icon: Sliders,
  },
  {
    title: 'SME Credit Decisioning Workbench',
    body: 'Walk through how an SME application is assessed, one step at a time, with the inputs and reasoning visible. It is designed to support analysts, not replace their judgement.',
    icon: ChartLineUp,
  },
  {
    title: 'Similar Portfolio Intelligence',
    body: 'Find portfolios that resemble one another so teams can learn from comparable books. Matches are illustrative and drawn from synthetic data.',
    icon: Stack,
  },
  {
    title: 'RIVA',
    body: 'A reporting environment for bringing risk and performance views together in one place. Layouts and metrics are indicative and will change as the lab evolves.',
    icon: Flask,
  },
];

export default function LabPage() {
  return (
    <>
      <PageHero
        eyebrow="AI Lab"
        title="Intelligence in every layer"
        intro="Experimental sandboxes where we test how AI can support credit, risk and reporting work."
        photo={{ src: '/images/lab.jpg', alt: 'Engineer in an innovation lab' }}
      />

      <section className="py-12 md:py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {SANDBOXES.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.title} delay={i * 0.06} className="h-full">
                  <article className="flex h-full flex-col rounded-3xl border border-line bg-surface p-6 shadow-soft md:p-8">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-az-mint-tint text-accent-strong">
                      <Icon size={24} weight="duotone" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">{s.title}</h2>
                    <p className="mt-3 flex-1 leading-relaxed text-muted">{s.body}</p>
                    <p className="mt-5 inline-flex w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{TAG}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={0.1} className="mt-6">
            <article className="grid items-center gap-6 rounded-3xl bg-az-navy p-6 text-white md:grid-cols-[auto_1fr_auto] md:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent">
                <GameController size={24} weight="duotone" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Playground</h2>
                <p className="mt-2 leading-relaxed text-white/80">Guided scenarios for employees and entitled clients</p>
              </div>
              <ButtonLink href="/login">
                Sign in <ArrowRight size={16} weight="bold" aria-hidden />
              </ButtonLink>
            </article>
          </Reveal>

          <p className="mt-8 text-sm text-faint">Product information is indicative and subject to validation.</p>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
