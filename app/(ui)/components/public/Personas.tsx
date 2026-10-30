import { ArrowRight } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { Container } from './ui';
import SectionHead from './SectionHead';
import ShapePhoto from './ShapePhoto';

const PERSONAS = [
  { photo: 'photo-lender', who: 'Banks, insurers and lenders', q: 'Seeing a market problem your peers surely share, but no safe way to compare notes?', a: 'Write an observation privately, choose what to share, and learn from reviewed insights from other organisations.', cta: 'Join the learning community', href: '/login' },
  { photo: 'photo-privacy', who: 'Compliance and privacy leads', q: 'Worried that sharing knowledge means leaking client or tenant data?', a: 'Nothing is shared without your say-so, a moderator redacts each shared copy first, and you can withdraw a contribution at any time.', cta: 'See how trust works', href: '/technology' },
  { photo: 'photo-product-owner', who: 'Product owners', q: 'Tired of guessing which client feedback is a one-off and which is a real pattern?', a: 'Themes only appear once at least three different organisations raise the same issue, and each links to an improvement idea you can track.', cta: 'Request a demo', href: '/connect' },
  { photo: 'photo-moderator', who: 'Learning moderators', q: 'Reviewing submissions in spreadsheets, with no clear record of who approved what?', a: 'One review queue shows the original beside an editable shared copy, and every decision is recorded.', cta: 'Request a demo', href: '/connect' },
];

export default function Personas() {
  return (
    <section className="bg-surface-2/50 py-14 md:py-20">
      <Container>
        <SectionHead eyebrow="Who it’s for" title="Built for every role in the learning loop." body="Collective learning only works when each role gets something it needs. Find yours." />
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
