import 'server-only';

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { AppSession } from '@/app/(common-lib)/types';
import { isMockPersonaEmail, MOCK_PERSONA_COOKIE } from '@/app/(ui)/components/portal/signin/mockSession';
import { authorize } from './authorize';
import { getSession } from './session';
import { redirectToLoginOrOnboarding } from './onboarding-redirect';

/** Server page guard. A recognized demo persona unlocks synthetic preview content in any deployment (this is a prototype). */
export async function requirePortalPage(action: string): Promise<AppSession | null> {
  const cookieStore = await cookies();
  if (isMockPersonaEmail(cookieStore.get(MOCK_PERSONA_COOKIE)?.value)) return null;

  const session = await getSession();
  if (!session) return redirectToLoginOrOnboarding();
  const permission = await authorize({ action });
  if (!permission.allowed) notFound();
  return session;
}
