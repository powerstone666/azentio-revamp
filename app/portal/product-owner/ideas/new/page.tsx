import { THEMES } from '@/app/(config)/mock/portal';
import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import IdeaForm from '@/app/(ui)/components/portal/staff/IdeaForm';

export default function ProductOwnerNewIdeaPage() {
  // Only visible themes can be linked. Hidden themes are not passed to the client.
  const themes = THEMES.filter((t) => t.shown).map((t) => ({ id: t.id, title: t.title }));

  return (
    <>
      <PageHeader
        title="New idea"
        description="Turn a visible theme into an improvement idea for the FAI team."
        crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'New idea' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mx-auto max-w-3xl">
          <IdeaForm themes={themes} />
        </Card>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
