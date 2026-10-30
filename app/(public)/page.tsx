import Hero from '@/app/(ui)/components/public/Hero';
import CategoryRow from '@/app/(ui)/components/public/CategoryRow';
import StatsBand from '@/app/(ui)/components/public/StatsBand';
import ContactForm from '@/app/(ui)/components/public/ContactForm';

/**
 * Azentio.ai homepage — flagship product showcase.
 * Follows the section rhythm from azentio.com:
 * Hero → Category row → Stats band → Contact form
 */

export default function HomePage() {
  return (
    <>
      <Hero />
      <CategoryRow />
      <StatsBand />
      <ContactForm />
    </>
  );
}