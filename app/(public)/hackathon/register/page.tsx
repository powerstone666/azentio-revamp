import PageHero from '@/app/(ui)/components/pages/PageHero';
import HackathonForm from '@/app/(ui)/components/pages/front/HackathonForm';
import { Container } from '@/app/(ui)/components/public/ui';

export default function HackathonRegisterPage() {
  return (
    <>
      <PageHero
        eyebrow="Hackathon"
        title="Register your interest"
        intro="Tell us who you are and what you would like to build."
        photo={{ src: '/images/hackathon.jpg', alt: 'Developers collaborating at a hackathon' }}
      />
      <section className="py-12 md:py-16">
        <Container className="max-w-3xl">
          <HackathonForm />
        </Container>
      </section>
    </>
  );
}
