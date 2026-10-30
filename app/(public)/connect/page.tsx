import { ShieldCheck, ArrowRight } from '@phosphor-icons/react/ssr';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import ConnectForm from '@/app/(ui)/components/pages/front/ConnectForm';
import { Container, ButtonLink } from '@/app/(ui)/components/public/ui';

export default function ConnectPage() {
  return (
    <>
      <PageHero
        eyebrow="Connect with Azentio"
        title="Talk to an Expert"
        intro="Tell us a little about your organisation and what you need."
        photo={{ src: '/images/connect.jpg', alt: 'Consultant on a video call' }}
      />
      <section className="py-12 md:py-16">
        <Container className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <ConnectForm />
          <aside className="rounded-3xl border border-line bg-az-mint-tint p-6 md:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent">
              <ShieldCheck size={24} weight="duotone" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-az-navy">Free sanctions check</h2>
            <p className="mt-2 leading-relaxed text-az-navy/80">
              Before you get in touch, you can explore our sanctions screening product and see how it fits into a compliance workflow.
            </p>
            <div className="mt-6">
              <ButtonLink href="/products/risk-compliance/sanctions-screening" variant="ghost">
                Open sanctions screening <ArrowRight size={16} weight="bold" aria-hidden />
              </ButtonLink>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
