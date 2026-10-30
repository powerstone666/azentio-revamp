import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import Spotlight from '@/app/(ui)/motion/Spotlight';
import { ShapeArt } from '@/app/(ui)/components/public/ShapePhoto';

interface ProductCardProps {
  href: string;
  eyebrow: string;
  title: string;
  text: string;
  variant?: number;
  chips?: string[];
}

export default function ProductCard({ href, eyebrow, title, text, variant = 0, chips }: ProductCardProps) {
  return (
    <Spotlight className="rounded-2xl">
      <Link href={href} className="focus-ring group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition hover:border-accent-strong/60">
        <ShapeArt variant={variant} className="-mx-6 -mt-6 mb-5 h-28" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-strong">{eyebrow}</p>
          <ArrowUpRight size={20} className="shrink-0 text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-strong" aria-hidden />
        </div>
        <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink">{title}</h3>
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted">{text}</p>
        {chips && chips.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{c}</li>
            ))}
          </ul>
        )}
      </Link>
    </Spotlight>
  );
}
