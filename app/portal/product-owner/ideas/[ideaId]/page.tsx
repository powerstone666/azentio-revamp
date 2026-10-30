import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IDEAS, getIdea } from '@/app/(config)/mock/portal';
import { IdeaStatusBadge, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { AuditTimeline } from '@/app/(ui)/components/portal/staff/AuditTimeline';
import { PreviewNote } from '@/app/(ui)/components/portal/staff/PreviewNote';
import { IDEA_STATUSES } from '@/app/(ui)/components/portal/staff/rules';

export const instant = false;

interface Props {
  params: Promise<{ ideaId: string }>;
}

export function generateStaticParams() {
  return IDEAS.map((i) => ({ ideaId: i.id }));
}

export default async function ProductOwnerIdeaDetailPage({ params }: Props) {
  const { ideaId } = await params;
  const idea = getIdea(ideaId);
  if (!idea) notFound();

  return (
    <>
      <PageHeader
        title={idea.title}
        crumbs={[
          { label: 'Product owner', href: '/portal/product-owner' },
          { label: 'Ideas' },
          { label: idea.id },
        ]}
        actions={<IdeaStatusBadge status={idea.status} />}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <div><dt className="text-az-text-muted">Offering</dt><dd className="font-semibold text-az-navy">{idea.offering}</dd></div>
                <div><dt className="text-az-text-muted">Owner</dt><dd className="font-semibold text-az-navy">{idea.owner}</dd></div>
              </dl>

              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-az-navy">Evidence</p>
                {idea.evidence.length === 0 ? (
                  <p className="text-sm text-az-text-muted">No evidence linked yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {idea.evidence.map((e) => (
                      <li key={e}>
                        <Link href="/portal/product-owner/themes" className="inline-flex rounded-[50px] bg-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy transition-colors duration-150 hover:bg-az-mint-tint">
                          {e}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-az-navy">Client-visible message</p>
                {!idea.clientVisible && <Pill>Not visible to clients</Pill>}
              </div>
              <p className="text-[15px] leading-relaxed text-az-text">{idea.clientText}</p>
            </Card>

            {idea.internalNote && (
              <div className="rounded-[12px] border-2 border-dashed border-az-navy bg-white p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-az-navy">Internal note</p>
                  <Pill tone="navy">Internal only</Pill>
                </div>
                <p className="text-[15px] leading-relaxed text-az-text">{idea.internalNote}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <label htmlFor="idea-status" className="mb-1.5 block text-sm font-semibold text-az-navy">Status</label>
              <select id="idea-status" disabled defaultValue={idea.status} className="w-full rounded-[12px] border border-az-grey-bg bg-az-grey-bg/60 px-4 py-3 text-[15px] text-az-text">
                {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="mt-4">
                <PreviewNote />
              </div>
            </Card>

            <Card>
              <SectionTitle>History</SectionTitle>
              <AuditTimeline entries={idea.audit} />
            </Card>
          </div>
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
