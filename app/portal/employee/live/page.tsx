import { PageHeader, PortalContainer, Card, PillButton, Table, Th, Td } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { SESSIONS, type Session } from '@/app/(config)/mock/portal';

const STATUS_TONE: Record<Session['status'], 'navy' | 'mint' | 'grey'> = {
  Live: 'navy',
  Upcoming: 'mint',
  Recording: 'grey',
};

export default function EmployeeLivePage() {
  return (
    <>
      <PageHeader
        title="Live sessions"
        description="Employee-only webinars and recordings. Employees only."
        crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Live sessions' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <p className="mb-6 text-sm text-az-text-muted">Preview build: nothing is saved. Streaming is not connected in this preview.</p>

        <Card className="mb-8 border-l-4 border-az-mint">
          <p className="text-sm text-az-text">
            Only people with a publishing grant can create or edit sessions. Dana Whitfield, an employee without that grant, can view and join sessions only.
          </p>
        </Card>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SESSIONS.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <div className="flex flex-wrap gap-2">
                <Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill>
                <Pill>{s.audience}</Pill>
              </div>
              <h2 className="mt-4 text-[18px] font-semibold text-az-navy">{s.title}</h2>
              <p className="mt-2 text-sm text-az-text">{s.when}</p>
              <p className="mt-1 text-sm text-az-text-muted">Host: {s.host}</p>
              <div className="mt-5">
                {s.status === 'Live' ? (
                  <div className="space-y-2">
                    <PillButton disabled>Join</PillButton>
                    <p className="text-xs text-az-text-muted">Streaming is not connected in this preview.</p>
                  </div>
                ) : s.status === 'Recording' ? (
                  <PillButton tone="outline" disabled>Watch recording</PillButton>
                ) : (
                  <PillButton tone="outline" disabled>Add to calendar</PillButton>
                )}
              </div>
            </Card>
          ))}
        </div>

        <h2 className="mb-4 mt-12 text-[20px] font-semibold text-az-navy">All sessions</h2>
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>When</Th>
              <Th>Audience</Th>
              <Th>Status</Th>
              <Th>Host</Th>
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((s) => (
              <tr key={s.id}>
                <Td className="font-semibold text-az-navy">{s.title}</Td>
                <Td>{s.when}</Td>
                <Td>{s.audience}</Td>
                <Td><Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill></Td>
                <Td>{s.host}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-6 text-xs text-az-text-muted">All data on this page is synthetic.</p>
      </PortalContainer>
    </>
  );
}
