import 'server-only';

import { redirect } from 'next/navigation';
import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';
import { getVerifiedIdentity } from '@/app/api/(services)/onboarding/service';

/** Signed-in visitors with no workspace yet choose a role; everyone else goes to sign in. */
export async function redirectToLoginOrOnboarding(): Promise<never> {
  if (isDemoOnboardingEnabled() && (await getVerifiedIdentity())) redirect('/onboarding');
  redirect('/login');
}
