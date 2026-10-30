'use client';

import { useState } from 'react';

export function OrgContinueButton({ membershipId, active = false }: { membershipId: string; active?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function selectWorkspace() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ membership_id: membershipId }),
      });
      if (!response.ok) throw new Error('This workspace is no longer available to your account.');
      // Full page load: /portal may have a cached redirect to this page from before a workspace was chosen.
      window.location.assign('/portal');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to select workspace.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={selectWorkspace} disabled={busy} className="inline-flex items-center gap-2 rounded-[50px] bg-az-mint px-6 py-2.5 text-[15px] font-semibold text-az-navy transition-colors duration-150 hover:bg-az-mint/80 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green">
        {busy ? 'Selecting…' : active ? 'Continue' : 'Select workspace'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-az-error">{error}</p>}
    </div>
  );
}
