'use client';

import { useState } from 'react';

export function ReportContributionForm({ sharedCopyId }: { sharedCopyId: string }) {
  const [category, setCategory] = useState('confidential');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/shared-copies/${sharedCopyId}/reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, details }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not report this contribution.');
      setDetails('');
      setMessage('Report submitted for moderator review.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit report.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 space-y-3 border-t border-az-grey-bg pt-5">
    <h3 className="text-sm font-semibold text-az-navy">Report this contribution</h3>
    <label className="block text-sm text-az-text">Reason
      <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block w-full rounded-xl border border-az-grey-bg bg-white px-3 py-2">
        <option value="confidential">May reveal confidential information</option>
        <option value="misleading">May be misleading</option>
        <option value="inappropriate">Inappropriate content</option>
        <option value="other">Other concern</option>
      </select>
    </label>
    <label className="block text-sm text-az-text">Details
      <textarea value={details} onChange={(event) => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={3} className="mt-1 block w-full rounded-xl border border-az-grey-bg px-3 py-2" />
    </label>
    <button disabled={busy} className="rounded-full bg-az-navy px-4 py-2 text-sm font-semibold text-white cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Sending…' : 'Send report'}</button>
    {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
  </form>;
}
