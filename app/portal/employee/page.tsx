import Link from 'next/link';
import { Flask, Broadcast, Lightbulb, BookOpen, ArrowRight, Info, VideoCamera } from '@phosphor-icons/react/ssr';
import { PageHeader, PortalContainer, Card, SectionTitle, PillLink } from '@/app/(ui)/components/portal/kit/ui';
import { IdeaStatusBadge, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { IDEAS, SESSIONS } from '@/app/(config)/mock/portal';

const QUICK = [
  { href: '/portal/employee/playground', title: 'Playground', line: 'Walk through a synthetic offering demo step by step.', icon: Flask },
  { href: '/portal/employee/live', title: 'Live sessions', line: 'Employee-only webinars and recordings.', icon: Broadcast },
  { href: '/portal/employee/experiments', title: 'Experiments', line: 'Internal prototypes and their current status.', icon: Lightbulb },
  { href: '/portal/employee/knowledge', title: 'Knowledge library', line: 'Internal guides with owners and review dates.', icon: BookOpen },
];

export default function EmployeeDashboardPage() {
  const liveNow = SESSIONS.filter((s) => s.status === 'Live');

  return (
    <>
      <PageHeader
        title="Hello, Dana"
        description="Azentio employee portal"
        actions={<span className="inline-flex items-center rounded-[50px] bg-az-mint px-4 py-2 text-sm font-semibold text-az-navy">Employees only</span>}
      />
      <PortalContainer className="py-8 md:py-10">
        <p className="mb-6 text-sm text-az-text-muted">Preview build: nothing is saved. All data is synthetic.</p>

        <section aria-labelledby="quick-heading" className="mb-10">
          <h2 id="quick-heading" className="sr-only">Quick links</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK.map((q) => {
              const Icon = q.icon;
              return (
                <Card key={q.href} className="flex flex-col p-5">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-az-mint-tint text-az-navy" aria-hidden>
                    <Icon size={22} weight="regular" />
                  </span>
                  <h3 className="text-[18px] font-semibold text-az-navy">{q.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-az-text">{q.line}</p>
                  <div className="mt-5">
                    <Link href={q.href} className="inline-flex items-center gap-2 text-sm font-semibold text-az-navy transition-colors duration-150 hover:text-az-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green">
                      Open {q.title.toLowerCase()}<ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section aria-labelledby="live-heading">
              <SectionTitle>
                <span id="live-heading">Live now</span>
              </SectionTitle>
              {liveNow.length === 0 ? (
                <Card><p className="text-sm text-az-text-muted">No employee sessions are live right now.</p></Card>
              ) : (
                liveNow.map((s) => (
                  <Card key={s.id} className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[18px] font-semibold text-az-navy">{s.title}</p>
                      <p className="mt-1 text-sm text-az-text-muted">{s.when} · Host: {s.host}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone="navy">Live</Pill>
                        <Pill>{s.audience}</Pill>
                      </div>
                    </div>
                    <PillLink href="/portal/employee/live" tone="navy">
                      <VideoCamera size={16} weight="bold" aria-hidden />View sessions
                    </PillLink>
                  </Card>
                ))
              )}
            </section>

            <section aria-labelledby="ideas-heading">
              <SectionTitle>
                <span id="ideas-heading">Assigned improvement ideas</span>
              </SectionTitle>
              <Card className="p-0">
                <ul className="divide-y divide-az-grey-bg">
                  {IDEAS.map((idea) => (
                    <li key={idea.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-az-navy">{idea.title}</p>
                        <p className="mt-1 text-sm text-az-text-muted">Owner: {idea.owner}</p>
                      </div>
                      <IdeaStatusBadge status={idea.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </div>

          <aside aria-labelledby="access-heading">
            <Card>
              <div className="flex items-start gap-3">
                <Info size={22} weight="regular" className="mt-0.5 shrink-0 text-az-green" aria-hidden />
                <div>
                  <h2 id="access-heading" className="text-[18px] font-semibold text-az-navy">What you can do</h2>
                  <p className="mt-3 text-sm text-az-text">
                    Employee access is limited. You can use the Playground, watch sessions, read the knowledge library and review experiments.
                  </p>
                  <p className="mt-3 text-sm text-az-text">
                    Moderation, publishing and admin need separate grants and are not available from this account.
                  </p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </PortalContainer>
    </>
  );
}
