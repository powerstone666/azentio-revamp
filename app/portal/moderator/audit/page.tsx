import Link from 'next/link';
import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listModerationAudit } from '@/app/api/(services)/moderation/service';
import { AUDIT } from '@/app/(config)/mock/portal';
import { PageHeader, PortalContainer, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ModeratorAuditPage() {
  const session = await requirePortalPage('portal:moderator:read');
  const globalModerator = session?.grants.some((grant) => grant.role === 'learning_moderator'
    && grant.org_id === null && !grant.revoked_at);
  const entries = session
    ? await listModerationAudit(globalModerator ? undefined : session.activeWorkspace?.orgId)
    : AUDIT.map((entry) => ({
        id: entry.request, actor: entry.actor, org_name: entry.org, action: entry.action,
        target_type: 'demo', target_id: entry.target, request_id: entry.request, created_at: entry.at,
      }));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only history of moderation decisions and report handling."
        crumbs={[{ label: 'Learning moderation', href: '/portal/moderator' }, { label: 'Audit' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Table>
          <thead>
            <tr><Th>When</Th><Th>Actor</Th><Th>Organisation</Th><Th>Action</Th><Th>Target</Th><Th>Request id</Th></tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap">{session ? new Date(entry.created_at).toLocaleString() : String(entry.created_at)}</Td>
                <Td>{entry.actor ?? 'System actor'}</Td>
                <Td>{entry.org_name ?? 'Platform'}</Td>
                <Td className="font-semibold text-az-navy">{entry.action}</Td>
                <Td>
                  {entry.target_type === 'contribution'
                    ? <Link className="font-mono text-xs underline" href={`/portal/moderator/review/${entry.target_id}`}>{entry.target_id}</Link>
                    : <span className="font-mono text-xs">{entry.target_type} · {entry.target_id}</span>}
                </Td>
                <Td className="font-mono text-xs">{entry.request_id}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {entries.length === 0 && <p className="mt-6 text-sm text-az-text-muted">No moderation events are recorded for this scope.</p>}
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
