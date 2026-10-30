import { ArrowRight } from '@phosphor-icons/react/ssr';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import SectionHead from '@/app/(ui)/components/public/SectionHead';
import { Container } from '@/app/(ui)/components/public/ui';
import Reveal from '@/app/(ui)/motion/Reveal';

const PRINCIPLES = [
  { title: 'Identity & SSO', body: 'Designed to sign in through your organisation’s single sign-on.' },
  { title: 'Role-based access', body: 'Designed so each role sees only the content and actions it is entitled to.' },
  { title: 'Auditability', body: 'Key actions are designed to leave a record that can be reviewed later.' },
  { title: 'Data protection', body: 'Private content is kept separate from shared learning by design.' },
  { title: 'Human oversight', body: 'People review AI output before it informs a decision.' },
  { title: 'Secure deployment', body: 'Deployment is planned around each client’s security requirements, agreed during onboarding.' },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="Innovation without compromising trust"
        intro="The principles behind how we build, deploy and govern our platform."
      />

      <section className="py-12 md:py-16">
        <Container>
          <SectionHead eyebrow="Our principles" title="Six commitments in the platform" />
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 0.05} className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
                <span className="font-semibold tabular-nums text-accent-strong">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{p.body}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-12 md:py-16">
        <Container className="grid gap-6 md:grid-cols-2">
          <Reveal className="rounded-3xl border border-line bg-surface p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">AIRA assistant</h2>
            <ul className="mt-5 space-y-3 leading-relaxed text-muted">
              <li className="flex gap-3"><ArrowRight size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent-strong" />Answers only from approved shared learning and public content.</li>
              <li className="flex gap-3"><ArrowRight size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent-strong" />Cites its sources so every answer can be checked.</li>
              <li className="flex gap-3"><ArrowRight size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent-strong" />Never reads private drafts.</li>
              <li className="flex gap-3"><ArrowRight size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent-strong" />Private text is never sent to an AI provider.</li>
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="rounded-3xl border border-line bg-az-mint-tint p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-az-navy">Withdrawal</h2>
            <p className="mt-5 leading-relaxed text-az-navy/80">
              When a contributor withdraws a contribution, it leaves search and AIRA within 60 seconds in the judging environment.
            </p>
            <p className="mt-4 leading-relaxed text-az-navy/80">
              The service level for the production environment is stated separately.
            </p>
          </Reveal>
        </Container>
      </section>

      <CtaBand title="See the platform in action." body="Talk to our team about how these principles apply to your organisation." />
    </>
  );
}
