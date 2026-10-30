import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { KNOWLEDGE } from '@/app/(config)/mock/portal';

export default function EmployeeKnowledgePage() {
  return (
    <>
      <PageHeader
        title="Knowledge library"
        description="Internal guides with owners and review dates. Employees only."
        crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Knowledge library' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mb-8 border-l-4 border-az-navy">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="navy">Employees only</Pill>
            <p className="text-sm text-az-text">Employee-only content never appears in client or public search, or in the AIRA assistant.</p>
          </div>
        </Card>
        <p className="mb-6 text-sm text-az-text-muted">Preview build: nothing is saved. Guides shown here are synthetic summaries.</p>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {KNOWLEDGE.map((k) => (
            <Card key={k.id} className="flex flex-col">
              <div><Pill tone="navy">Employees only</Pill></div>
              <h2 className="mt-4 text-[18px] font-semibold text-az-navy">{k.title}</h2>
              <p className="mt-3 text-sm text-az-text">Owner: {k.owner}</p>
              <p className="mt-1 text-sm text-az-text-muted">{k.review}</p>
            </Card>
          ))}
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
