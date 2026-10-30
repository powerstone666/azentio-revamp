import 'server-only';

import { cookies } from 'next/headers';
import { getSession } from '@/app/api/(services)/authz/session';
import { isMockPersonaEmail, MOCK_PERSONA_COOKIE } from '@/app/(ui)/components/portal/signin/mockSession';
import PortalShellClient from './PortalShellClient';

export default async function PortalShell({ children }: { children: React.ReactNode }) {
  const isDemoPreview = isMockPersonaEmail((await cookies()).get(MOCK_PERSONA_COOKIE)?.value);
  const session = isDemoPreview ? null : await getSession();
  const realUser = session ? {
    name: session.user.display_name,
    role: session.activeWorkspace?.role.replaceAll('_', ' ') ?? 'Member',
    org: session.activeWorkspace?.orgName ?? 'Select workspace',
    isSandbox: session.activeWorkspace?.isSandbox ?? false,
  } : null;
  return <PortalShellClient realUser={realUser}>{children}</PortalShellClient>;
}
