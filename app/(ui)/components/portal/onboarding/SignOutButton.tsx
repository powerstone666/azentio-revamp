'use client';

import { useState } from 'react';
import { SignOut } from '@phosphor-icons/react';

export function SignOutButton({ variant = 'header', label = 'Sign out' }: { variant?: 'header' | 'link'; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setBusy(true);
    setError('');
    // Better Auth rejects POSTs without a JSON content type (415), which would leave the session cookie in place.
    const response = await fetch('/api/v1/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: 'include',
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setError('Could not sign out. Please try again.');
      return;
    }
    window.location.assign('/login');
  }

  const className = variant === 'header'
    ? 'inline-flex items-center gap-1.5 rounded-[50px] border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-mint'
    : 'inline-flex items-center gap-1.5 rounded-[50px] border border-az-navy/25 px-6 py-3 text-[15px] font-semibold text-az-navy transition-colors hover:bg-az-grey-bg disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green';

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={signOut} disabled={busy} className={`${className} cursor-pointer disabled:cursor-not-allowed`}>
        <SignOut size={16} weight="bold" aria-hidden />
        {busy ? 'Signing out…' : label}
      </button>
      {error && <span role="alert" className="text-sm font-medium text-az-error">{error}</span>}
    </span>
  );
}
