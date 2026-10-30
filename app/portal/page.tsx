import { Buildings, GearSix, Lightbulb, ShieldCheck, UserCircle } from '@phosphor-icons/react/ssr';
import { Card, PageHeader, PillLink, PortalContainer, SectionTitle } from '@/app/(ui)/components/portal/kit/ui';

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

export default function PortalIndexPage() {
  return (
    <>
      <PageHeader
        title="Azentio portal"
        description="This preview shows each role's area with synthetic data. Real sign-in and server-side access control arrive next."
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
