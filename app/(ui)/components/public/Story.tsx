import { Lightbulb, PencilSimpleLine, ShieldCheck, UsersThree } from '@phosphor-icons/react/ssr';
import PinnedSteps, { type PinnedStep } from '@/app/(ui)/motion/PinnedSteps';
import { Container } from './ui';
import ShapePhoto from './ShapePhoto';
import SectionHead from './SectionHead';

const Card = ({ children, photo, variant }: { children: React.ReactNode; photo: string; variant: number }) => (
  <div className="relative h-[26rem] w-full overflow-hidden rounded-3xl md:h-full">
    <ShapePhoto src={`/images/${photo}.jpg`} alt="" variant={variant} className="absolute inset-0" sizes="(min-width: 1024px) 40vw, 92vw" />
    <div className="absolute bottom-5 left-5 w-[min(86%,420px)] rounded-2xl border border-line bg-surface p-5 shadow-soft">{children}</div>
  </div>
);
const Note = () => <p className="mt-4 text-right font-medium text-[10px] uppercase tracking-wider text-faint">Illustrative · synthetic data</p>;

const STEPS: PinnedStep[] = [
  {
    label: 'Draft',
    icon: <PencilSimpleLine size={24} weight="duotone" aria-hidden />,
    title: 'Write it down, privately.',
    body: 'A client user records a market observation inside their own organisation. Nothing leaves the workspace until they choose a sharing scope and give consent.',
    visual: (
      <Card photo="story-draft" variant={0}>
        <p className="text-sm font-semibold text-ink">New observation</p>
        <div className="mt-3 space-y-2">
          <div className="h-2.5 w-11/12 rounded bg-surface-2" />
          <div className="h-2.5 w-full rounded bg-surface-2" />
          <div className="h-2.5 w-7/12 rounded bg-surface-2" />
        </div>
        <div className="mt-4 flex gap-2 text-xs">
          <span className="rounded-full bg-accent px-3 py-1 font-medium text-on-accent">My organisation</span>
          <span className="rounded-full border border-line px-3 py-1 text-muted">Community (proposed)</span>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
          {['Store and process', 'Publish reviewed copy', 'Show attribution', 'Future training'].map((c) => (
            <li key={c} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2">
              <span className="h-3.5 w-3.5 rounded border border-faint" /> {c}
            </li>
          ))}
        </ul>
        <Note />
      </Card>
    ),
  },
  {
    label: 'Review',
    icon: <ShieldCheck size={24} weight="duotone" aria-hidden />,
    title: 'A human checks before anything is shared.',
    body: 'A moderator compares the private source with an editable shared copy, redacts what must go, and records the decision. Approve, return, reject or publish.',
    visual: (
      <Card photo="story-review" variant={1}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-semibold text-ink">Source · private</p>
            <div className="mt-2 space-y-1.5">
              <div className="h-2 w-full rounded bg-faint/40" />
              <div className="h-2 w-10/12 rounded bg-violet/50" />
              <div className="h-2 w-8/12 rounded bg-faint/40" />
            </div>
          </div>
          <div className="rounded-xl border border-accent-strong/40 bg-surface p-3">
            <p className="font-semibold text-ink">Shared copy</p>
            <div className="mt-2 space-y-1.5">
              <div className="h-2 w-full rounded bg-faint/40" />
              <div className="h-2 w-10/12 rounded bg-ink" />
              <div className="h-2 w-8/12 rounded bg-faint/40" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 text-xs font-medium">
          <span className="rounded-full bg-accent px-3 py-1 text-on-accent">Publish</span>
          <span className="rounded-full border border-line px-3 py-1 text-muted">Ask for changes</span>
          <span className="rounded-full border border-line px-3 py-1 text-muted">Reject</span>
        </div>
        <Note />
      </Card>
    ),
  },
  {
    label: 'Learn',
    icon: <UsersThree size={24} weight="duotone" aria-hidden />,
    title: 'Patterns appear, people stay anonymous.',
    body: 'Approved copies become searchable learning. A theme only shows once at least three distinct organisations raised it, so no single client can be picked out.',
    visual: (
      <Card photo="story-learn" variant={2}>
        <p className="text-sm font-semibold text-ink">Seasonality in SME credit</p>
        <div className="mt-3 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-violet/20 text-xs font-semibold text-violet">{String.fromCharCode(65 + i)}</span>
          ))}
          <span className="text-xs text-muted">3 organisations · small-sample warning</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-full rounded bg-surface-2" />
          <div className="h-2.5 w-9/12 rounded bg-surface-2" />
        </div>
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Withdrawn contributions leave search within 60 seconds.</p>
        <Note />
      </Card>
    ),
  },
  {
    label: 'Improve',
    icon: <Lightbulb size={24} weight="duotone" aria-hidden />,
    title: 'Insight turns into a better product.',
    body: 'Product owners connect themes to improvement ideas and share honest status, without exposing a client’s private information or promising delivery.',
    visual: (
      <Card photo="story-improve" variant={3}>
        <p className="text-sm font-semibold text-ink">Seasonality-aware comparison explanation</p>
        <ol className="mt-4 flex items-center justify-between text-[11px]">
          {['Proposed', 'Under review', 'Planned', 'Released'].map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${i < 2 ? 'bg-accent' : 'bg-line'}`} />
              <span className={i === 1 ? 'font-semibold text-ink' : 'text-faint'}>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Under review. This is not a promised delivery.</p>
        <Note />
      </Card>
    ),
  },
];

export default function Story() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <SectionHead
          eyebrow="Collective learning"
          title="From one client’s observation to everyone’s advantage."
          body="Private by default, shared by choice, reviewed by people. Here’s the loop behind the azentio.ai portal."
        />
        <div className="mt-8">
          <PinnedSteps steps={STEPS} />
        </div>
      </Container>
    </section>
  );
}
