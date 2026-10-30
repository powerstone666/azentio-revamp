import { Bank, ChartLineUp, CirclesFour, GlobeHemisphereWest, Handshake, MapPin, MoonStars, ShieldCheck, Umbrella, FileText } from '@phosphor-icons/react/ssr';
import Marquee from '@/app/(ui)/motion/Marquee';

const TAGS = [
  { t: 'Banking', i: Bank }, { t: 'Insurance', i: Umbrella }, { t: 'Capital markets', i: ChartLineUp },
  { t: 'Risk & compliance', i: ShieldCheck }, { t: 'ERP', i: CirclesFour }, { t: 'Middle East', i: MapPin },
  { t: 'Africa', i: MapPin }, { t: 'South East Asia', i: MapPin }, { t: 'South Asia', i: GlobeHemisphereWest },
  { t: 'Islamic finance', i: MoonStars }, { t: 'AML & sanctions', i: ShieldCheck }, { t: 'Claims automation', i: FileText },
  { t: 'Partners', i: Handshake },
];

export default function TagMarquee() {
  return (
    <section aria-label="Industries and regions" className="border-y border-line bg-surface-2/50 py-5">
      <Marquee duration={45}>
        {TAGS.map(({ t, i: Icon }) => (
          <span key={t} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-5 py-2 text-sm font-medium text-muted">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent"><Icon size={16} weight="bold" aria-hidden /></span>
            {t}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
