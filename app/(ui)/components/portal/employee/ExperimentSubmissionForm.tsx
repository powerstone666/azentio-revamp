'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-4 py-3 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export default function ExperimentSubmissionForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/v1/employee/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'), problem_statement: form.get('problem_statement'),
          offering: form.get('offering'), proposed_approach: form.get('proposed_approach'),
          ...(form.get('review_at') ? { review_at: form.get('review_at') } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Submission could not be saved.');
      formElement.reset();
      setMessage('Your experiment was submitted for internal review.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-az-grey-bg bg-white p-5">
    <h2 className="text-lg font-semibold text-az-navy">Submit an experiment</h2>
    <label className="block text-sm font-medium text-az-navy">Name<input name="title" required minLength={3} maxLength={160} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Offering<input name="offering" required maxLength={100} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Problem to explore<textarea name="problem_statement" required minLength={10} maxLength={2000} rows={3} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Proposed approach<textarea name="proposed_approach" maxLength={3000} rows={3} className={`${field} mt-1.5`} /></label>
    <label className="block text-sm font-medium text-az-navy">Review date (optional, defaults to 30 days)<input type="date" name="review_at" className={`${field} mt-1.5`} /></label>
    <p className="text-xs text-az-text-muted">Do not include client confidential information or customer records.</p>
    {message && <p role="status" className="text-sm text-az-text">{message}</p>}
    <button type="submit" disabled={busy} className="rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Submitting…' : 'Submit experiment'}</button>
  </form>;
}
