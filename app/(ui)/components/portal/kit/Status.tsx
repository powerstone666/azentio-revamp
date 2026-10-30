import { CheckCircle, Circle, PauseCircle, ProhibitInset, Prohibit, PaperPlaneTilt, Question, Lightbulb, Wrench, Rocket, XCircle, MagnifyingGlass, CalendarCheck } from '@phosphor-icons/react/ssr';
import { STATE_LABEL, type IdeaStatus, type ObsState } from '@/app/(config)/mock/portal';

// Status is always an icon plus a text label, never colour alone.
const OBS: Record<ObsState, { icon: typeof Circle; cls: string }> = {
  private_draft: { icon: Circle, cls: 'bg-az-grey-bg text-az-text-muted' },
  submitted: { icon: PaperPlaneTilt, cls: 'bg-az-navy text-white' },
  needs_clarification: { icon: Question, cls: 'bg-az-mint-tint text-az-navy' },
  approved: { icon: CheckCircle, cls: 'bg-az-mint text-az-navy' },
  published: { icon: CheckCircle, cls: 'bg-az-green text-az-navy' },
  suspended: { icon: PauseCircle, cls: 'bg-az-error text-white' },
  rejected: { icon: XCircle, cls: 'border border-az-error bg-white text-az-error' },
  withdrawn: { icon: Prohibit, cls: 'bg-az-grey-bg text-az-text-muted' },
};
const IDEA: Record<IdeaStatus, { icon: typeof Circle; cls: string }> = {
  Proposed: { icon: Lightbulb, cls: 'bg-az-grey-bg text-az-navy' },
  'Under review': { icon: MagnifyingGlass, cls: 'bg-az-mint-tint text-az-navy' },
  Planned: { icon: CalendarCheck, cls: 'bg-az-mint text-az-navy' },
  'In progress': { icon: Wrench, cls: 'bg-az-navy text-white' },
  Released: { icon: Rocket, cls: 'bg-az-green text-az-navy' },
  'Not proceeding': { icon: ProhibitInset, cls: 'bg-az-grey-bg text-az-text-muted' },
};
const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[50px] px-3 py-1 text-xs font-semibold';

export function ObsStatus({ state }: { state: ObsState }) {
  const { icon: I, cls } = OBS[state];
  return <span className={`${base} ${cls}`}><I size={14} weight="bold" aria-hidden />{STATE_LABEL[state]}</span>;
}
export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  const { icon: I, cls } = IDEA[status];
  return <span className={`${base} ${cls}`}><I size={14} weight="bold" aria-hidden />{status}</span>;
}
export function Pill({ children, tone = 'grey' }: { children: React.ReactNode; tone?: 'grey' | 'mint' | 'navy' | 'red' }) {
  const t = { grey: 'bg-az-grey-bg text-az-navy', mint: 'bg-az-mint-tint text-az-navy', navy: 'bg-az-navy text-white', red: 'bg-az-error text-white' }[tone];
  return <span className={`${base} ${t}`}>{children}</span>;
}
