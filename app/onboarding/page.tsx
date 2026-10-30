import { redirect } from 'next/navigation';
import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';
import { getVerifiedIdentity, listOwnDemoRoles } from '@/app/api/(services)/onboarding/service';
import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { RolePicker } from '@/app/(ui)/components/portal/onboarding/RolePicker';
import { SignOutButton } from '@/app/(ui)/components/portal/onboarding/SignOutButton';

export const instant = false;

export default async function OnboardingPage() {
  if (!isDemoOnboardingEnabled()) redirect('/login');
  const identity = await getVerifiedIdentity();
  if (!identity) redirect('/login?redirect=/onboarding');
  if ((await listOwnDemoRoles(identity.email)).length > 0) redirect('/workspace/select');

  return (
    <main className="min-h-screen bg-white pb-16">
      <PageHeader
        title="What would you like to try?"
        description="Pick one role to join the shared sandbox workspace. Demo content is synthetic and separate from real client workspaces."
        crumbs={[{ label: 'Sign in', href: '/login' }, { label: 'Choose your role' }]}
        actions={<SignOutButton />}
      />
      <PortalContainer className="mt-10">
        <RolePicker email={identity.email} />
      </PortalContainer>
    </main>
  );
}
