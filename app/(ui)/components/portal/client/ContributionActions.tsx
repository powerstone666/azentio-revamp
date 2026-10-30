'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ContributionActions({ id, state, isAuthor }: { id: string; state: string; isAuthor: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const editable = isAuthor && (state === 'private_draft' || state === 'needs_clarification' || state === 'published');
  const canSubmit = isAuthor && (state === 'private_draft' || state === 'needs_clarification');
  const withdrawable = isAuthor && state !== 'withdrawn';

  async function act(action: 'submit' | 'withdraw') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(action === 'submit' ? `/api/v1/contributions/${id}/submit` : `/api/v1/contributions/${id}`, {
        method: action === 'submit' ? 'POST' : 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? `Unable to ${action} this contribution.`);
      }
      setMessage(action === 'submit' ? 'Submitted for review.' : 'Contribution withdrawn.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthor || state === 'withdrawn') return null;
  return <div className="flex flex-wrap items-center gap-3">
    {editable && <Link href={`/portal/client/observations/${id}/edit`} className="rounded-full border-2 border-az-navy px-5 py-2 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all">Edit</Link>}
    {canSubmit && <button type="button" disabled={busy} onClick={() => void act('submit')} className="rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Submit for review</button>}
    {withdrawable && <button type="button" disabled={busy} onClick={() => void act('withdraw')} className="rounded-full border border-az-error px-5 py-2 text-sm font-semibold text-az-error cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Withdraw</button>}
    {message && <span role="status" className="text-sm text-az-text-muted">{message}</span>}
    {withdrawable && state === 'published' && (
      <p className="basis-full text-xs leading-relaxed text-az-text-muted">
        Withdrawing removes the shared copy from search, themes and AIRA on the next request, and within 60 seconds in every case. Material that someone has already viewed, or copied outside the portal, cannot be recalled automatically.
      </p>
    )}
  </div>;
}
