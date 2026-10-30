import Image from 'next/image';
import { PillButton, PillLink } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

interface Props {
  params: Promise<{ token: string }>;
}

type InviteState =
  | { kind: 'valid'; org: string; role: string; email: string; expiresIn: string }
  | { kind: 'expired'; org: string }
  | { kind: 'wrong-account'; email: string }
  | { kind: 'invalid' };

// Demo invitations for the preview build. Any other token is treated as invalid.
const DEMO_INVITES: Record<string, InviteState> = {
  'demo-valid': {
    kind: 'valid',
    org: 'Kestrel Peak Microfinance',
    role: 'Client member',
    email: 'new.analyst@kestrelpeak.example',
    expiresIn: '6 days',
  },
  'demo-expired': { kind: 'expired', org: 'Harborline Commercial Bank' },
  'demo-wrong-account': { kind: 'wrong-account', email: 'sam.invited@emberfield.example' },
};

export function generateStaticParams() {
  return Object.keys(DEMO_INVITES).map((token) => ({ token }));
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const invite: InviteState = DEMO_INVITES[token] ?? { kind: 'invalid' };

  return (
    <main className="flex min-h-screen items-center justify-center bg-az-grey-bg px-5 py-12">
      <div className="w-full max-w-[560px] rounded-[12px] bg-white p-8 shadow-card md:p-10">
        <Image src="/brand/azentio-logo.svg" width={132} height={36} alt="Azentio" />

        {invite.kind === 'valid' && (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              You are invited to join{' '}
              <span className="border-b-[3px] border-az-mint pb-1">{invite.org}</span>
            </h1>
            <dl className="mt-8 divide-y divide-az-grey-bg text-[15px]">
              <Row label="Organisation" value={invite.org} />
              <Row label="Role" value={invite.role} />
              <Row label="Invitation for" value={invite.email} />
              <Row label="Expires" value={`In ${invite.expiresIn}`} />
              <Row label="Use" value="Single use" />
            </dl>
            <p className="mt-8 rounded-[12px] bg-az-mint-tint p-5 text-[15px] leading-relaxed text-az-text">
              Joining a workspace is not consent to share anything. You choose what to share, observation by observation.
            </p>
            <div className="mt-8">
              <PillButton tone="mint" disabled>
                Accept invitation
              </PillButton>
            </div>
            <p className="mt-4 text-sm text-az-text-muted">
              Accepting invitations is not active in this preview build. Nothing is joined and no account is created.
            </p>
          </>
        )}

        {invite.kind === 'expired' && (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              <span className="border-b-[3px] border-az-mint pb-1">This invitation has expired</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-az-text">
              The invitation to {invite.org} expired 1 day ago.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-az-text">
              Ask your administrator for a new invitation.
            </p>
            <div className="mt-8">
              <PillLink href="/login" tone="navy">Go to sign in</PillLink>
            </div>
          </>
        )}

        {invite.kind === 'wrong-account' && (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              <span className="border-b-[3px] border-az-mint pb-1">This invitation belongs to a different account</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-az-text">
              This invitation is addressed to {invite.email}. The account you are using does not match, so it cannot be accepted.
            </p>
            <div className="mt-8">
              <PillLink href="/login" tone="navy">Go to sign in</PillLink>
            </div>
          </>
        )}

        {invite.kind === 'invalid' && (
          <>
            <h1 className="mt-8 text-[28px] font-semibold leading-tight text-az-navy">
              <span className="border-b-[3px] border-az-mint pb-1">This invitation link is not valid</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-az-text">
              Check the link in your email, or ask your administrator for a new invitation.
            </p>
            <div className="mt-8">
              <PillLink href="/login" tone="navy">Go to sign in</PillLink>
            </div>
          </>
        )}
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
