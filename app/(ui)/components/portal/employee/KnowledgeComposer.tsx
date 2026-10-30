'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-4 py-3 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

function inDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function KnowledgeComposer() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(formElement: HTMLFormElement, status: 'draft' | 'published') {
    if (!formElement.reportValidity()) return;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/employee/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.get('title'), body: form.get('body'), review_at: form.get('review_at'), status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The guide could not be saved.');
      formElement.reset();
      setMessage(status === 'published' ? 'Guide published to employees.' : 'Draft saved. Only you can see it until you publish.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The guide could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="space-y-4 rounded-2xl border border-az-grey-bg bg-white p-5" aria-label="Add a guide" onSubmit={(event) => event.preventDefault()}>
    <h2 className="text-lg font-semibold text-az-navy">Add a guide</h2>
    <label className="block text-sm font-medium text-az-navy">Title<input name="title" required minLength={3} maxLength={160} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Guide<textarea name="body" required minLength={10} maxLength={10000} rows={6} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Review by<input type="date" name="review_at" required defaultValue={inDays(90)} min={inDays(0)} className={`${field} mt-1.5`} /></label>
    <p className="text-xs text-az-text-muted">You will be listed as the owner. Do not include client confidential information or customer records.</p>
    {message && <p role="status" className="text-sm text-az-text">{message}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={(event) => void submit(event.currentTarget.form!, 'draft')} className="cursor-pointer rounded-full border-2 border-az-navy px-5 py-2.5 text-sm font-semibold text-az-navy transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50">Save draft</button>
      <button type="button" disabled={busy} onClick={(event) => void submit(event.currentTarget.form!, 'published')} className="cursor-pointer rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50">Publish</button>
    </div>
  </form>;
}
