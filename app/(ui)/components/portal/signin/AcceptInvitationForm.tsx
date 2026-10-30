'use client';

import { useState, type FormEvent } from 'react';
import { PillButton } from '@/app/(ui)/components/portal/kit/ui';

export function AcceptInvitationForm({ token }: { token: string }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [understandsSharing, setUnderstandsSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          accept_workspace_terms: acceptTerms,
          understands_sharing_is_separate: understandsSharing,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to accept this invitation.');
      // This changes the membership state that determines /portal routing. Do a
      // full navigation so Next.js cannot reuse a redirect cached before joining.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/workspace/select');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to accept this invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="flex items-start gap-3 text-sm leading-relaxed text-az-text">
        <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-1 accent-az-green" />
        <span>I have reviewed and accept the workspace terms shown above.</span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-az-text">
        <input type="checkbox" checked={understandsSharing} onChange={(event) => setUnderstandsSharing(event.target.checked)} className="mt-1 accent-az-green" />
        <span>I understand joining does not share observations or give permission for model training; those are separate choices.</span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-az-error">{error}</p>}
      <PillButton tone="mint" type="submit" disabled={busy || !acceptTerms || !understandsSharing}>
        {busy ? 'Joining workspace…' : 'Accept invitation'}
      </PillButton>
    </form>
  );
}
