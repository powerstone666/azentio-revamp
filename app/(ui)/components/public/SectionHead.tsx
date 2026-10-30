import type { ReactNode } from 'react';
import SplitHeading from '@/app/(ui)/motion/SplitHeading';
import Reveal from '@/app/(ui)/motion/Reveal';
import { Eyebrow } from './ui';

export default function SectionHead({
  eyebrow,
  title,
  body,
  align = 'left',
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <Reveal variant="fade">
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <SplitHeading className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-ink md:text-5xl">{title}</SplitHeading>
      {body && (
        <Reveal delay={0.15}>
          <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p>
        </Reveal>
      )}
    </div>
  );
}
