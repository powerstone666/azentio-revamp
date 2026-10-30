import Link from 'next/link';
import { ArrowUpRight, Broadcast, CalendarCheck, Fingerprint, Flask, LockKey, Rocket, Sparkle, UserCheck, UsersThree, CloudCheck, ClipboardText } from '@phosphor-icons/react/ssr';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { Container } from './ui';
import SectionHead from './SectionHead';

const ADDONS = [
  { icon: Flask, name: 'Playground', desc: 'Guided scenarios with synthetic data: pick an offering, inspect inputs, run a demonstration and give structured feedback.', gate: 'Sign-in required', href: '/lab' },
  { icon: Broadcast, name: 'Azentio Live', desc: 'Sessions, broadcasts and recordings, shown only to the audience each one is configured for.', gate: 'Sign-in required', href: '/media' },
  { icon: Sparkle, name: 'AIRA assistant', desc: 'Answers from approved shared learning and public content, with citations. Never from private drafts.', gate: 'Authorised members', href: '/technology' },
  { icon: Rocket, name: 'Hackathon registration', desc: 'Register your interest in an Azentio hackathon and build with our teams.', gate: 'Open to everyone', href: '/hackathon/register' },
  { icon: CalendarCheck, name: 'Request a demo', desc: 'Tell us what you are working on and we will line up the right product walkthrough.', gate: 'Open to everyone', href: '/connect' },
  { icon: UsersThree, name: 'Client workspace', desc: 'Entitled demos, sessions and your own observations, isolated per organisation.', gate: 'Invitation only', href: '/login' },
];

const TRUST = [
  { icon: Fingerprint, t: 'Identity & SSO', d: 'Verified work identity before any access.' },
  { icon: UserCheck, t: 'Role-based access', d: 'Least privilege, enforced on the server.' },
  { icon: ClipboardText, t: 'Auditability', d: 'Every moderation and status change recorded.' },
  { icon: LockKey, t: 'Data protection', d: 'Private text never reaches an AI provider.' },
  { icon: UsersThree, t: 'Human oversight', d: 'People review what gets shared.' },
  { icon: CloudCheck, t: 'Secure deployment', d: 'Tenant isolation by design.' },
];

export default function Explore() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <SectionHead eyebrow="Beyond the catalogue" title="Everything around the products, in one place." body="Discover, try, register and collaborate. Some doors are open to everyone; others open once you sign in." />
        <Reveal stagger={0.08} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ADDONS.map(({ icon: Icon, ...a }) => (
            <Spotlight key={a.name} className="rounded-2xl">
              <Link href={a.href} className="focus-ring group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-accent-strong/60">
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-on-accent"><Icon size={26} weight="duotone" aria-hidden /></span>
                  <ArrowUpRight size={20} className="text-faint transition group-hover:text-accent-strong" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{a.name}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{a.desc}</p>
                <span className="mt-5 inline-flex w-fit rounded-full bg-surface-2 px-3 py-1 font-medium text-[11px] uppercase tracking-wider text-faint">{a.gate}</span>
              </Link>
            </Spotlight>
          ))}
        </Reveal>

        <div className="mt-12">
          <SectionHead eyebrow="Trust by design" title="Innovation without compromising trust." />
          <Reveal stagger={0.07} className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="bg-surface p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent"><Icon size={24} weight="duotone" aria-hidden /></span>
                  <span className="font-medium text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 font-semibold text-ink">{t}</h3>
                <p className="mt-1.5 text-[15px] text-muted">{d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
