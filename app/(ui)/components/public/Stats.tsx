import { Buildings, CalendarCheck, GlobeHemisphereWest, MapPin, UsersThree } from '@phosphor-icons/react/ssr';
import CountUp from '@/app/(ui)/motion/CountUp';
import Reveal from '@/app/(ui)/motion/Reveal';
import Parallax from '@/app/(ui)/motion/Parallax';
import { STATS } from '@/app/(config)/home';
import { Container } from './ui';
import SectionHead from './SectionHead';

const STAT_ICONS = [Buildings, CalendarCheck, UsersThree, GlobeHemisphereWest, MapPin];

export default function Stats() {
  return (
    <section className="relative overflow-hidden bg-az-navy py-14 md:py-20">
      <Parallax amount={12} className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-accent/25 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-violet/30 blur-[120px]" />
      </Parallax>
      <Container className="relative">
        <div className="[&_h2]:!text-[#eaf2f6] [&_p]:!text-[#98aebb]">
          <SectionHead eyebrow="Key stats" title="Transforming technology every day." body="Proven impact across the Middle East, Africa, and South East Asia." />
        </div>
        <Reveal stagger={0.1} className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-5">
          {STATS.map((s, i) => {
            const Icon = STAT_ICONS[i];
            return (
            <div key={s.label} className="border-l border-white/15 pl-5">
              <Icon size={32} weight="duotone" className="mb-4 text-[#55ffbe]" aria-hidden />
              <CountUp value={s.value} suffix={s.suffix} className="block text-5xl font-semibold tracking-tight text-[#55ffbe] md:text-6xl" />
              <p className="mt-2 text-sm text-[#98aebb]">{s.label}</p>
            </div>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
