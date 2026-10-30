import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getVisibleTheme } from '@/app/api/(services)/learning/shared-learning';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageHeader, PortalContainer, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { THEMES, getObservation, getTheme } from '@/app/(config)/mock/portal';
import { isShared } from '@/app/(ui)/components/portal/client/shared';

export const instant = false;

export function generateStaticParams() {
  return THEMES.map((t) => ({ themeId: t.id }));
}

interface Props {
  params: Promise<{ themeId: string }>;
}

export default async function ThemeDetailPage({ params }: Props) {
  const session = await requirePortalPage('portal:client:read');
  const { themeId } = await params;
  if (session) {
    const theme = await getVisibleTheme(themeId, session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined);
    if (!theme) notFound();
    return (
      <>
        <PageHeader title={theme.title} description={theme.safe_summary} crumbs={[{ label: 'Community themes', href: '/portal/client/themes' }, { label: theme.title }]} />
        <PortalContainer className="py-8 md:py-10">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <SectionTitle>About this theme</SectionTitle>
                <div className="flex flex-wrap gap-2"><Pill tone="grey">{theme.offering ?? 'Multiple offerings'}</Pill><Pill tone="mint">Based on {theme.distinct_org_count} organisations</Pill></div>
                <p className="mt-4 text-sm leading-relaxed text-az-text">{theme.sample_note}</p>
                {theme.distinct_org_count <= 3 && <p className="mt-4 rounded-[12px] border-l-4 border-az-navy bg-az-grey-bg/60 p-4 text-sm text-az-text">Small sample. Treat as a signal, not as market prevalence.</p>}
              </Card>
              <Card><SectionTitle>Evidence</SectionTitle>
                {theme.evidence.length === 0 ? <p className="text-sm text-az-text-muted">No currently approved evidence is linked to this theme.</p> : <ul className="divide-y divide-az-grey-bg">{theme.evidence.map((item) => <li key={item.id} className="py-3"><Link href={`/portal/client/shared-learning/${item.id}`} className="font-semibold text-az-navy underline-offset-4 hover:underline">{String(item.title ?? 'Shared contribution')}</Link><p className="mt-1 text-xs text-az-text-muted">{String(item.observation_type ?? 'Observation')} · Confidence: {String(item.confidence ?? 'Unrated')}</p></li>)}</ul>}
              </Card>
            </div>
            <Card className="h-fit"><SectionTitle>Profile</SectionTitle><dl className="space-y-4 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Periods</dt><dd className="mt-1 text-az-text">{new Date(theme.period_start).toLocaleDateString()} – {new Date(theme.period_end).toLocaleDateString()}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Contributing organisations</dt><dd className="mt-1 text-az-text">{theme.distinct_org_count}</dd></div></dl></Card>
          </div>
        </PortalContainer>
      </>
    );
  }
  const t = getTheme(themeId);
  if (!t) notFound();

  if (!t.shown) {
    return (
      <>
        <PageHeader title="Theme not shown" crumbs={[{ label: 'Community themes', href: '/portal/client/themes' }, { label: 'Theme' }]} />
        <PortalContainer className="py-8 md:py-10">
          <Card className="max-w-2xl">
            <p className="text-sm text-az-text-muted">Not enough contributing organisations to show.</p>
          </Card>
        </PortalContainer>
      </>
    );
  }

  const evidence = t.evidence.flatMap((id) => {
    const o = getObservation(id);
    return o && isShared(o) ? [o] : [];
  });

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.summary}
        crumbs={[{ label: 'Community themes', href: '/portal/client/themes' }, { label: t.title }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <SectionTitle>About this theme</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <Pill tone="grey">{t.offering}</Pill>
                <Pill tone="mint">Based on {t.orgs} organisations</Pill>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-az-text">{t.summary}</p>
              {t.orgs === 3 && (
                <p className="mt-4 rounded-[12px] border-l-4 border-az-navy bg-az-grey-bg/60 p-4 text-sm text-az-text">
                  Small sample: three organisations contributed. Do not treat this theme as market prevalence.
                </p>
              )}
            </Card>
            <Card>
              <SectionTitle>Evidence</SectionTitle>
              {evidence.length === 0 ? (
                <p className="text-sm text-az-text-muted">No published evidence is linked to this theme.</p>
              ) : (
                <ul className="divide-y divide-az-grey-bg">
                  {evidence.map((o) => (
                    <li key={o.id} className="py-3">
                      <Link href={`/portal/client/shared-learning/${o.id}`} className="font-semibold text-az-navy underline-offset-4 hover:underline">{o.title}</Link>
                      <p className="mt-1 text-xs text-az-text-muted">{o.type} · {o.period} · Confidence: {o.confidence}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card className="h-fit">
            <SectionTitle>Profile</SectionTitle>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Periods</dt>
                <dd className="mt-1 text-az-text">{t.periods}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Confidence mix</dt>
                <dd className="mt-1 text-az-text">{t.confidence}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Contributing organisations</dt>
                <dd className="mt-1 text-az-text">{t.orgs}</dd>
              </div>
            </dl>
          </Card>
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
