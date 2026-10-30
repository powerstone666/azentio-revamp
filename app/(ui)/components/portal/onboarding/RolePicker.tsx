'use client';

import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { SELF_SERVICE_ONBOARDING_ROLES, type SelfServiceOnboardingRole } from '@/app/(config)/onboarding';
import { Card } from '@/app/(ui)/components/portal/kit/ui';
import { SignOutButton } from './SignOutButton';

interface Workspace {
  membership_id: string;
  role: string;
}

const GROUPS = ['Client side', 'Azentio side'] as const;

export function RolePicker({ email }: { email: string }) {
  const [chosen, setChosen] = useState<SelfServiceOnboardingRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roles: chosen ? [chosen] : [] }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Could not set up your demo workspace.');
      const workspaces: Workspace[] = body.data.workspaces;
      if (workspaces.length === 1) {
        const selected = await fetch('/api/v1/workspaces', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ membership_id: workspaces[0].membership_id }),
        });
        if (!selected.ok) throw new Error('Your workspace was created but could not be opened. Choose it on the next page.');
        // Full page load: the client router may hold a cached redirect for /portal from before the workspace existed.
        window.location.assign('/portal');
      } else {
        window.location.assign('/workspace/select');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[15px] text-az-text">
        Signed in as <span className="font-semibold text-az-navy">{email}</span>. Each account tries one role in the shared synthetic workspace, and demo members share activity across roles. Never enter customer names, account numbers, credentials or confidential information.
      </p>

      {GROUPS.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-az-text-muted">{group}</h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {SELF_SERVICE_ONBOARDING_ROLES.filter((role) => role.group === group).map((role) => {
              const selected = chosen === role.id;
              return (
                <li key={role.id}>
                  <label className="block h-full cursor-pointer">
                    <input
                      type="radio"
                      name="demo-role"
                      className="peer sr-only"
                      checked={selected}
                      onChange={() => setChosen(role.id)}
                    />
                    <Card className={`h-full border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-az-green ${
                      selected ? 'border-az-green bg-az-mint-tint' : 'border-transparent hover:border-az-green/60'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[18px] font-semibold text-az-navy">{role.label}</h3>
                        <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-az-green bg-az-green text-white' : 'border-az-grey-bg'}`}>
                          {selected && <Check size={14} weight="bold" />}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-az-text">{role.pitch}</p>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-az-navy">Starter data</p>
                      <ul className="mt-1.5 space-y-1">
                        {role.starter.map((item) => (
                          <li key={item} className="flex gap-2 text-[13.5px] leading-snug text-az-text">
                            <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-az-green" aria-hidden /> {item}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-az-text-muted">
        The shared demo workspace contains synthetic data and stays separate from real client and employee workspaces.
      </p>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-az-error">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !chosen}
          className="inline-flex items-center gap-2 rounded-[50px] bg-az-mint px-7 py-3 text-[15px] font-semibold text-az-navy transition-colors hover:bg-az-mint/80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green"
        >
          {busy ? 'Setting up…' : 'Join the demo with this role'}
        </button>
        <SignOutButton variant="link" label="Not now, sign out" />
      </div>
    </div>
  );
}
