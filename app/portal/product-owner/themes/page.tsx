import { THEMES } from '@/app/(config)/mock/portal';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';

// Product owners see theme-level aggregates and approved evidence ids only.
// No raw client text and no organisation names.
export default function ProductOwnerThemesPage() {
  return (
    <>
      <PageHeader
        title="Themes"
        description="Recurring patterns across approved contributions. A theme is shown only when enough organisations contribute to it."
        crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'Themes' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {THEMES.map((t) =>
            t.shown ? (
              <Card key={t.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="mint">{t.offering}</Pill>
                  <Pill>{t.orgs} organisations</Pill>
                  <Pill>{t.periods}</Pill>
                </div>
                <h2 className="mt-4 text-[22px] font-semibold text-az-navy">{t.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-az-text">{t.summary}</p>
                <p className="mt-2 text-sm text-az-text-muted">Confidence: {t.confidence}</p>
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-az-navy">Evidence</p>
                  <ul className="flex flex-wrap gap-2">
                    {t.evidence.map((e) => (
                      <li key={e}><Pill>{e}</Pill></li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : (
              <Card key={t.id} className="border-2 border-dashed border-az-grey-bg bg-white shadow-none">
                <p className="text-[15px] text-az-text-muted">Below threshold: not enough contributing organisations to show</p>
              </Card>
            ),
          )}
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
