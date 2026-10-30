import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getModerationReports } from '@/app/api/(services)/moderation/service';
import { ReportStatusControl } from '@/app/(ui)/components/portal/staff/ReportStatusControl';
import Link from 'next/link';
import { REPORTS } from '@/app/(config)/mock/portal';
import { listCommunityCommentReports } from '@/app/api/(services)/learning/comments';
import { CommentVisibilityControl } from '@/app/(ui)/components/portal/staff/CommentVisibilityControl';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

const REPORT_TONE: Record<string, 'red' | 'grey' | 'mint'> = { Open: 'red', open: 'red', investigating: 'red', Dismissed: 'grey', Resolved: 'mint', resolved: 'mint' };

export default async function ModeratorReportsPage() {
  const session = await requirePortalPage('portal:moderator:read');
  const globalModerator = session?.grants.some((grant) => grant.role === 'learning_moderator' && grant.org_id === null && !grant.revoked_at);
  let reports;
  if (session) {
    const [copyReports, commentReports] = await Promise.all([
      getModerationReports(globalModerator ? undefined : session.activeWorkspace?.orgId),
      listCommunityCommentReports(globalModerator ? undefined : session.activeWorkspace?.orgId),
    ]);
    reports = [
      ...copyReports.map((report) => ({
        id: report.id,
        contributionId: report.contribution_id,
        title: report.title || 'Reported shared contribution',
        category: report.category,
        status: report.status,
        details: report.details,
        created: report.created_at,
        target: 'Shared contribution',
        endpoint: '/api/v1/moderation/reports',
        comment: null as null | { id: string; status: string },
      })),
      ...commentReports.map((report) => ({
        id: report.id,
        contributionId: report.contribution_id,
        title: 'Reported community comment',
        category: report.category,
        status: report.status,
        details: `${report.comment_body}\n\nReport: ${report.details}`,
        created: report.created_at,
        target: 'Community comment',
        endpoint: '/api/v1/moderation/comment-reports',
          comment: { id: report.comment_id, status: report.comment_status },
      })),
    ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  } else {
    reports = REPORTS.map((report) => ({
        id: report.id,
        contributionId: '',
        title: report.target,
        category: report.category,
        status: report.status,
        details: report.note,
        created: report.when,
        target: 'Shared contribution',
        endpoint: '/api/v1/moderation/reports',
        comment: null as null | { id: string; status: string },
    }));
  }
  return (
    <>
      <PageHeader
        title="Content reports"
        description="Reports from members about shared content."
        crumbs={[{ label: 'Learning moderation', href: '/portal/moderator' }, { label: 'Reports' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mb-6 text-sm text-az-text">
          The reporter is never shown to the reported organisation. Reports are handled against the content, not the person who raised them.
        </Card>
        <Table>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Target</Th>
              <Th>Comment visibility</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Note</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <Td>{r.target}</Td>
                <Td className="font-semibold text-az-navy">{r.contributionId ? <Link href={`/portal/moderator/review/${r.contributionId}`} className="underline-offset-4 hover:underline">{r.title}</Link> : r.title}</Td>
                <Td>{session && r.comment ? <CommentVisibilityControl id={r.comment.id} status={r.comment.status} /> : '—'}</Td>
                <Td>{r.category}</Td>
                <Td>{session ? <ReportStatusControl id={r.id} status={r.status} endpoint={r.endpoint} /> : <Pill tone={REPORT_TONE[r.status] ?? 'grey'}>{r.status}</Pill>}</Td>
                <Td>{r.details}</Td>
                <Td className="whitespace-nowrap">{new Date(r.created).toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
