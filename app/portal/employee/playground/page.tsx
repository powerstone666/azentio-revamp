import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { PlaygroundRunner } from '@/app/(ui)/components/portal/employee/PlaygroundRunner';

export const instant = false;

export default async function EmployeePlaygroundPage() {
  const session = await requirePortalPage('portal:employee:read');
  return (
    <>
      <PageHeader
        title="Playground"
        description="A guided sandbox with synthetic inputs. Outputs are simulated, not credit or business decisions. Employees only."
        crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Playground' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <p className="mb-6 text-sm text-az-text-muted">{session ? 'All inputs and outputs are synthetic. Runs and feedback are saved to your internal employee workspace.' : 'Demo preview: runs and feedback are not stored.'}</p>
        <PlaygroundRunner persist={Boolean(session)} />
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
