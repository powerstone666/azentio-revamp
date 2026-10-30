import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { ShapeArt } from '@/app/(ui)/components/public/ShapePhoto';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import type { InsightItem } from './data';

export default function InsightCard({ item, variant = 0 }: { item: InsightItem; variant?: number }) {
  return (
    <Spotlight className="rounded-2xl">
      <Link
        href={item.href}
        className="focus-ring group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent-strong/60"
      >
        <ShapeArt variant={variant} className="h-28 shrink-0" />
        <div className="flex flex-1 flex-col p-6">
          <span className="font-medium text-xs uppercase tracking-[0.14em] text-accent-strong">{item.tag}</span>
          <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-ink">{item.title}</h3>
          {item.text && <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-muted">{item.text}</p>}
          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-ink group-hover:text-accent-strong">
            Read <ArrowRight size={16} weight="bold" aria-hidden />
          </span>
        </div>
      </Link>
    </Spotlight>
  );
}
