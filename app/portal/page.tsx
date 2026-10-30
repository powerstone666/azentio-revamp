import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Buildings, GearSix, Lightbulb, ShieldCheck, UserCircle } from '@phosphor-icons/react/ssr';
import { getSession } from '@/app/api/(services)/authz/session';
import { redirectToLoginOrOnboarding } from '@/app/api/(services)/authz/onboarding-redirect';
import { Card, PageHeader, PillLink, PortalContainer, SectionTitle } from '@/app/(ui)/components/portal/kit/ui';
import { isMockPersonaEmail, MOCK_PERSONA_COOKIE } from '@/app/(ui)/components/portal/signin/mockSession';

export const instant = false;

const AREAS: { title: string; href: string; icon: typeof Buildings; body: string }[] = [
  {
    title: 'Client workspace',
    href: '/portal/client',
    icon: Buildings,
    body: 'For client members at partner banks and lenders. Share observations, follow themes and open demos for your organisation.',
  },
  {
    title: 'Employee portal',
    href: '/portal/employee',
    icon: UserCircle,
    body: 'For Azentio staff. Use the knowledge base, the sandbox playground and live sessions. Experiments stay internal.',
  },
  {
    title: 'Learning moderation',
    href: '/portal/moderator',
    icon: ShieldCheck,
    body: 'For learning moderators. Review, redact and publish shared observations, and work through reports.',
  },
  {
    title: 'Product owner',
    href: '/portal/product-owner',
    icon: Lightbulb,
    body: 'For product owners. Turn shared evidence into improvement ideas and track each idea to release.',
  },
  {
    title: 'Administration',
    href: '/portal/admin',
    icon: GearSix,
    body: 'For portal admins. Manage organisations and role grants. Admins cannot open private client content.',
  },
];

export default async function PortalIndexPage() {
  const cookieStore = await cookies();
  const demoPreview = isMockPersonaEmail(cookieStore.get(MOCK_PERSONA_COOKIE)?.value);
  if (!demoPreview) {
    const session = await getSession();
    if (!session) return redirectToLoginOrOnboarding();
    if (!session.activeWorkspace) redirect('/workspace/select');
    const grants = session.grants.filter((grant) => !grant.revoked_at
      && (grant.org_id === session.activeWorkspace?.orgId || grant.org_id === null));
    const grantRoles = new Set(grants.map((grant) => grant.role));
    if (grantRoles.has('portal_admin')) redirect('/portal/admin');
    if (grantRoles.has('learning_moderator')) redirect('/portal/moderator');
    if (grantRoles.has('product_owner')) redirect('/portal/product-owner');
    if (['client_member', 'client_admin'].includes(session.activeWorkspace.role)
      || grantRoles.has('client_member') || grantRoles.has('client_admin')) redirect('/portal/client');
    if (session.activeWorkspace.role === 'employee' || grantRoles.has('employee')) redirect('/portal/employee');
    if (grantRoles.has('content_publisher')) redirect('/portal/employee/live');
    if (session.activeWorkspace.orgType === 'client') redirect('/portal/client');
    redirect('/login');
  }

  return (
    <>
      <PageHeader
        title="Azentio portal"
        description="Demo preview. Each area below uses synthetic data and is available only through Demo login."
      />
      <PortalContainer className="py-8 md:py-10">
        <SectionTitle>Choose a preview area</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map(({ title, href, icon: Icon, body }) => (
            <Card key={href} className="flex flex-col">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-az-green text-az-navy">
                <Icon size={24} weight="bold" aria-hidden />
              </span>
              <h2 className="mt-5 text-[20px] font-semibold text-az-navy">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-az-text">{body}</p>
              <div className="mt-6">
                <PillLink href={href} tone="mint">Open</PillLink>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-10">
          <PillLink href="/login" tone="outline">Back to sign in</PillLink>
        </div>
      </PortalContainer>
    </>
  );
}
