'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RevokeAccessButton({ id, kind, disabled = false }: { id: string; kind: 'member' | 'invitation'; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = kind === 'member' ? 'Revoke access' : 'Revoke invitation';

  async function revoke() {
    if (!window.confirm(`Are you sure you want to ${label.toLowerCase()}?`)) return;
    setBusy(true);
    setError('');
    try {
      const endpoint = kind === 'member' ? `/api/v1/members/${id}` : `/api/v1/invitations/${id}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Access could not be revoked.');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Access could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  return <div><button type="button" disabled={disabled || busy} onClick={() => void revoke()} className="cursor-pointer text-sm font-semibold text-az-error underline transition-opacity disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : label}</button>{error && <p role="status" className="text-xs text-az-error">{error}</p>}</div>;
}
