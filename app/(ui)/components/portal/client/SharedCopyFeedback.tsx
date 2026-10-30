'use client';

import { useEffect, useState } from 'react';

type Vote = 'useful' | 'needs_evidence';

export function SharedCopyFeedback({ sharedCopyId, initialValue }: { sharedCopyId: string; initialValue: Vote | null }) {
  const [value, setValue] = useState<Vote | null>(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/shared-copies/${sharedCopyId}/feedback`, { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (active && (result?.data?.feedback === 'useful' || result?.data?.feedback === 'needs_evidence')) setValue(result.data.feedback);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sharedCopyId]);

  async function save(feedback: Vote) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/shared-copies/${sharedCopyId}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save your feedback.');
      setValue(result.data.feedback);
      setMessage('Feedback saved. You can change it any time.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your feedback.');
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby="shared-copy-feedback-title" className="border-t border-az-grey-bg pt-6">
    <h2 id="shared-copy-feedback-title" className="font-semibold text-az-navy">Was this useful?</h2>
    <p className="mt-1 text-sm text-az-text-muted">Your feedback helps reviewers improve the quality of shared learning.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={busy} aria-pressed={value === 'useful'} onClick={() => void save('useful')} className="cursor-pointer rounded-full border border-az-grey-bg px-4 py-2 text-sm font-semibold text-az-navy transition-colors hover:bg-az-mint-tint disabled:cursor-not-allowed disabled:opacity-50">Useful</button>
      <button type="button" disabled={busy} aria-pressed={value === 'needs_evidence'} onClick={() => void save('needs_evidence')} className="cursor-pointer rounded-full border border-az-grey-bg px-4 py-2 text-sm font-semibold text-az-navy transition-colors hover:bg-az-mint-tint disabled:cursor-not-allowed disabled:opacity-50">Needs more evidence</button>
    </div>
    {message && <p role="status" className="mt-2 text-xs text-az-text-muted">{message}</p>}
  </section>;
}
