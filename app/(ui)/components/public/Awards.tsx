import Marquee from '@/app/(ui)/motion/Marquee';
import { Trophy } from '@phosphor-icons/react/ssr';
import { AWARDS } from '@/app/(config)/home';
import { Container, Eyebrow } from './ui';

export default function Awards() {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <Eyebrow>Awards & analyst recognition</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">We’re proud to be winners.</h2>
      </Container>
      <div className="mt-10">
        <Marquee duration={70} reverse>
          {AWARDS.map((a) => (
            <div key={a} className="flex w-[360px] shrink-0 items-start gap-3 rounded-2xl border border-line bg-surface p-5">
              <Trophy size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
              <p className="line-clamp-4 text-sm leading-relaxed text-ink">{a}</p>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
