import 'server-only';

import { z } from 'zod';
import { SELF_SERVICE_ONBOARDING_ROLE_IDS } from '@/app/(config)/onboarding';
import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';
import {
  OnboardingError,
  getVerifiedIdentity,
  listOwnDemoRoles,
  provisionDemoWorkspaces,
} from '@/app/api/(services)/onboarding/service';

const bodySchema = z.object({
  roles: z.array(z.enum(SELF_SERVICE_ONBOARDING_ROLE_IDS)).length(1),
});

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  if (!isDemoOnboardingEnabled()) return Response.json({ error: 'Not found' }, { status: 404 });
  const identity = await getVerifiedIdentity();
  if (!identity) return Response.json({ error: 'Authentication required' }, { status: 401 });
  return Response.json({ data: { roles: await listOwnDemoRoles(identity.email) } });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDemoOnboardingEnabled()) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const identity = await getVerifiedIdentity();
  if (!identity) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose one role.' }, { status: 400 });

  try {
    const workspaces = await provisionDemoWorkspaces(identity, parsed.data.roles);
    return Response.json({ data: { workspaces } }, { status: 201 });
  } catch (error) {
    if (error instanceof OnboardingError) return Response.json({ error: error.message }, { status: error.status });
    console.error('[onboarding] provisioning failed:', error);
    return Response.json({ error: 'Could not set up your demo workspace.' }, { status: 500 });
  }
}
