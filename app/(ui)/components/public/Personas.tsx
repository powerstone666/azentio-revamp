import { ArrowRight } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { Container } from './ui';
import SectionHead from './SectionHead';
import ShapePhoto from './ShapePhoto';

const PERSONAS = [
  { photo: 'photo-lender', who: 'Client members', q: 'Want to try AI on your own workflows, and have your market insight shape the product?', a: 'Work in your organisation’s own workspace with entitled AI demos and sandboxes, record observations, and choose what is shared. Approved learning from other organisations is searchable.', cta: 'Sign in to your workspace', href: '/login' },
  { photo: 'photo-privacy', who: 'Client administrators', q: 'Need your team on the platform without losing control of who sees what?', a: 'Invite and revoke members and assign approved roles within your own organisation. Access is checked on the server, and roles can’t be escalated.', cta: 'See how access works', href: '/technology' },
  { photo: 'photo-product-owner', who: 'Product owners', q: 'Need to know which client feedback is a real pattern and which is a one-off?', a: 'AI-grouped themes link back to the approved evidence and show how many distinct organisations raised them. Turn a theme into an improvement idea and keep its status honest.', cta: 'Request a demo', href: '/connect' },
  { photo: 'photo-moderator', who: 'Learning moderators', q: 'Need to review AI-assisted submissions without risking client confidentiality?', a: 'Compare the private source with an editable shared copy, redact, request clarification, then publish or reject. Every decision is audited, and withdrawals reach search and AI retrieval.', cta: 'Request a demo', href: '/connect' },
];

export default function Personas() {
  return (
    <section className="bg-surface-2/50 py-14 md:py-20">
      <Container>
        <SectionHead eyebrow="Who it’s for" title="Built for every role in the learning loop." body="Each role gets its own experience, with access enforced by the server. Find yours." />
        <Reveal stagger={0.12} className="mt-10 grid gap-5 md:grid-cols-2">
          {PERSONAS.map((p, i) => (
            <Spotlight key={p.who} className="rounded-2xl">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface sm:flex-row">
                <ShapePhoto
                  src={`/images/${p.photo}.jpg`}
                  alt={p.who}
                  variant={i + 1}
                  className="h-56 shrink-0 sm:h-auto sm:w-[44%]"
                  sizes="(min-width: 640px) 22vw, 92vw"
                />
                <div className="flex flex-1 flex-col p-7">
                  <p className="font-medium text-xs uppercase tracking-[0.16em] text-accent-strong">{p.who}</p>
                  <h3 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-ink">{p.q}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{p.a}</p>
                  <Link href={p.href} className="focus-ring mt-auto inline-flex items-center gap-2 pt-5 font-semibold text-ink hover:text-accent-strong">
                    {p.cta} <ArrowRight size={18} weight="bold" aria-hidden />
                  </Link>
                </div>
              </article>
            </Spotlight>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
