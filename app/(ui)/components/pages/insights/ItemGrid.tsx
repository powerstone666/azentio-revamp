import Reveal from '@/app/(ui)/motion/Reveal';
import InsightCard from './InsightCard';
import type { InsightItem } from './data';

export default function ItemGrid({ items }: { items: InsightItem[] }) {
  return (
    <Reveal stagger={0.07} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <InsightCard key={`${item.title}-${i}`} item={item} variant={i} />
      ))}
    </Reveal>
  );
}
