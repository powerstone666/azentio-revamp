import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';
import { getInvitation } from '@/app/api/(services)/invitations/service';
import { AcceptInvitationForm } from '@/app/(ui)/components/portal/signin/AcceptInvitationForm';
import { PillLink } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) notFound();
  const invite = await getInvitation(token);
  if (!invite) notFound();
  const incomingHeaders = await headers();
  createAuthApiRequest(incomingHeaders); // validates the host
  const authSession = await auth.api.getSession({ headers: incomingHeaders });
  const roleName = invite.proposed_role === 'client_admin' ? 'Client administrator' : 'Client member';
  const emailMismatch = Boolean(authSession?.user?.email && authSession.user.email.toLowerCase() !== invite.email.toLowerCase());
  const loginHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-az-grey-bg px-5 py-12">
      <div className="w-full max-w-[560px] rounded-[12px] bg-white p-8 shadow-card md:p-10">
        <Image src="/brand/azentio-logo.svg" width={132} height={36} alt="Azentio" />
        {invite.status === 'pending' ? (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              You are invited to join <span className="border-b-[3px] border-az-mint pb-1">{invite.org_name}</span>
            </h1>
            <dl className="mt-8 divide-y divide-az-grey-bg text-[15px]">
              <Row label="Organisation" value={invite.org_name} />
              <Row label="Role" value={roleName} />
              <Row label="Invitation for" value={invite.email} />
              <Row label="Expires" value={new Date(invite.expires_at).toLocaleString()} />
              <Row label="Use" value="Single use" />
            </dl>
            <div className="mt-8 rounded-[12px] bg-az-mint-tint p-5 text-[15px] leading-relaxed text-az-text">
              <p className="font-semibold text-az-navy">Workspace terms</p>
              <p className="mt-2">Use only information you are authorised to share. Keep customer identities, account numbers, credentials, and confidential contract details out of contributions.</p>
              <p className="mt-3">Joining grants workspace access only. Each contribution has its own private, organisation, or proposed community-sharing choice, and model-training consent is separate.</p>
            </div>
            {emailMismatch ? (
              <div className="mt-8">
                <p className="text-sm leading-relaxed text-az-error">You are signed in as {authSession?.user?.email}. This invitation is for {invite.email}; sign in with that email to accept it.</p>
                <PillLink href={loginHref} tone="navy" className="mt-4">Switch account</PillLink>
              </div>
            ) : authSession?.user?.email ? (
              <AcceptInvitationForm token={token} />
            ) : (
              <div className="mt-8">
                <p className="text-sm leading-relaxed text-az-text-muted">Sign in with the invited email address using the emailed code. The invitation is accepted only after identity verification.</p>
                <PillLink href={loginHref} tone="mint" className="mt-4">Sign in to accept</PillLink>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              <span className="border-b-[3px] border-az-mint pb-1">{invite.status === 'expired' ? 'This invitation has expired' : invite.status === 'accepted' ? 'This invitation was already used' : 'This invitation was revoked'}</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-az-text">
              Ask an administrator at {invite.org_name} for a new invitation if you still need access.
            </p>
            <PillLink href="/login" tone="navy" className="mt-8">Go to sign in</PillLink>
          </>
        )}
        <p className="mt-8 text-xs text-az-text-muted"><Link href="/" className="underline underline-offset-4">Azentio.ai</Link></p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]">
      <dt className="font-semibold text-az-navy">{label}</dt>
      <dd className="text-az-text">{value}</dd>
    </div>
  );
}
