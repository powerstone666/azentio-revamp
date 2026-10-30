import Hero from '@/app/(ui)/components/public/Hero';
import TagMarquee from '@/app/(ui)/components/public/TagMarquee';
import Story from '@/app/(ui)/components/public/Story';
import Personas from '@/app/(ui)/components/public/Personas';
import ProductBento from '@/app/(ui)/components/public/ProductBento';
import Cases from '@/app/(ui)/components/public/Cases';
import Awards from '@/app/(ui)/components/public/Awards';
import Stats from '@/app/(ui)/components/public/Stats';
import Explore from '@/app/(ui)/components/public/Explore';
import Testimonials from '@/app/(ui)/components/public/Testimonials';
import InsightsCta from '@/app/(ui)/components/public/InsightsCta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TagMarquee />
      <Story />
      <Personas />
      <ProductBento />
      <Cases />
      <Awards />
      <Stats />
      <Explore />
      <Testimonials />
      <InsightsCta />
    </>
  );
}
