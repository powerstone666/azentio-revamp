import { PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { PlaygroundRunner } from '@/app/(ui)/components/portal/employee/PlaygroundRunner';

export default function EmployeePlaygroundPage() {
  return (
    <>
      <PageHeader
        title="Playground"
        description="A guided sandbox with synthetic inputs. Outputs are simulated, not credit or business decisions. Employees only."
        crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Playground' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <p className="mb-6 text-sm text-az-text-muted">Preview build: nothing is saved. Employees only.</p>
        <PlaygroundRunner />
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
