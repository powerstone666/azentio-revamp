import { ArrowRight } from '@phosphor-icons/react/ssr';
import { Container, ButtonLink } from '@/app/(ui)/components/public/ui';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import ContentSections from '@/app/(ui)/components/pages/ContentSections';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { insightSections } from '@/app/(ui)/components/pages/insights/data';

export const metadata = {
  title: 'Media & videos',
  description: 'Azentio sessions and recordings, shown only to the audience each one is configured for.',
};

export default function MediaPage() {
  return (
    <>
      <PageHero
        eyebrow="Media & videos"
        title="See Azentio in action"
        photo={{ src: '/images/media.jpg', alt: 'Presenter being filmed in a small studio' }}
      />
      <ContentSections sections={insightSections('/insights/events-and-webinars')} />
      <section className="py-12 md:py-16">
        <Container>
          <Spotlight className="rounded-2xl">
            <article className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold tracking-tight text-ink">Azentio Live</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">
                  Sessions and recordings are shown only to the audience each one is configured for. Public sessions are marked public.
                </p>
              </div>
              <ButtonLink href="/login">
                Sign in <ArrowRight size={16} weight="bold" aria-hidden />
              </ButtonLink>
            </article>
          </Spotlight>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
