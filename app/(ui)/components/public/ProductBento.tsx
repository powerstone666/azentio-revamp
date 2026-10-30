import Link from 'next/link';
import ShapePhoto from './ShapePhoto';
import { ArrowUpRight, Bank, CheckCircle, CirclesFour, ShieldCheck, TrendUp, Umbrella } from '@phosphor-icons/react/ssr';
import Reveal from '@/app/(ui)/motion/Reveal';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { CATEGORIES } from '@/app/(config)/home';
import { Container } from './ui';
import SectionHead from './SectionHead';

const ICONS = { banking: Bank, 'capital-markets': TrendUp, 'risk-compliance': ShieldCheck, insurance: Umbrella, erp: CirclesFour };
const SPAN = ['lg:col-span-4 lg:row-span-2', 'lg:col-span-2', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-3'];

export default function ProductBento() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <SectionHead
          eyebrow="Products"
          title={<>World class technology. <span className="text-accent-strong">Regional passion.</span></>}
          body="We provide technology that not only streamlines processes, but also delivers tangible results, empowering organizations to stay competitive and achieve sustainable success."
        />
        <Reveal stagger={0.1} className="mt-10 grid gap-5 lg:grid-cols-6">
          {CATEGORIES.map((c, i) => {
            const Icon = ICONS[c.slug as keyof typeof ICONS];
            return (
              <Spotlight key={c.slug} className={`rounded-2xl ${SPAN[i]}`}>
                <Link href={`/products/${c.slug}`} className="focus-ring group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-7 transition hover:border-accent-strong/60">
                  <ShapePhoto
                    src={`/images/photo-${c.slug}.jpg`}
                    alt={`${c.name} professional`}
                    variant={i}
                    className={`-mx-7 -mt-7 mb-6 ${i === 0 ? 'min-h-72 flex-1' : 'h-48'}`}
                  />
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-on-accent">
                      <Icon size={26} weight="duotone" aria-hidden />
                    </span>
                    <ArrowUpRight size={22} className="text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-strong" aria-hidden />
                  </div>
                  <h3 className={`mt-6 font-semibold tracking-tight text-ink ${i === 0 ? 'text-3xl' : 'text-2xl'}`}>{c.name}</h3>
                  <p className="mt-2 text-muted">{c.line}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {c.products.map((p) => (
                      <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted"><CheckCircle size={16} weight="fill" className="text-accent-strong" aria-hidden />{p}</li>
                    ))}
                  </ul>
                </Link>
              </Spotlight>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
