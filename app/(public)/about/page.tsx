import { Container } from '@/app/(ui)/components/public/ui';
import CountUp from '@/app/(ui)/motion/CountUp';
import Reveal from '@/app/(ui)/motion/Reveal';
import { STATS } from '@/app/(config)/home';
import ContentPage, { contentMetadata } from '@/app/(ui)/components/pages/company/ContentPage';

export const metadata = contentMetadata('/about-azentio');

export default function AboutPage() {
  return (
    <ContentPage
      path="/about-azentio"
      eyebrow="About"
      crumbs={[{ label: 'About' }]}
      photo={{ src: '/images/about-team.jpg', alt: 'Azentio team in an office lobby' }}
      variant={0}
    >
      <section className="py-12 md:py-16">
        <Container>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Azentio in numbers</h2>
          <Reveal as="ul" stagger={0.08} className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {STATS.map((s) => (
              <li key={s.label} className="rounded-2xl border border-line bg-surface p-6">
                <p className="text-4xl font-semibold tracking-tight text-ink">
                  <CountUp value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-[15px] text-muted">{s.label}</p>
              </li>
            ))}
          </Reveal>
        </Container>
      </section>
    </ContentPage>
  );
}
