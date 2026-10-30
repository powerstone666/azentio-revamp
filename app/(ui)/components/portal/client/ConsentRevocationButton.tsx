'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Purpose = 'store_process' | 'publish_reviewed' | 'attribute' | 'model_training' | 'semantic_analysis';

export function ConsentRevocationButton({ contributionId, purpose }: { contributionId: string; purpose: Purpose }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function revoke() {
    if (!window.confirm('Revoke this consent? Revoking storage/processing or community publication withdraws the contribution and removes it from shared retrieval.')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/contributions/${contributionId}/consent-revocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Consent could not be revoked.');
      if (purpose === 'store_process' || purpose === 'publish_reviewed') {
        router.push('/portal/client/observations');
        router.refresh();
      } else {
        setMessage('Consent revoked.');
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Consent could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex items-center gap-2">
    <button type="button" disabled={busy} onClick={() => void revoke()} className="text-xs font-semibold text-az-error underline underline-offset-2 disabled:opacity-50">
      {busy ? 'Revoking…' : 'Revoke'}
    </button>
    {message && <span role="status" className="text-xs text-az-text-muted">{message}</span>}
  </span>;
}
