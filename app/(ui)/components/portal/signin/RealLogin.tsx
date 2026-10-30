'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { WarningCircle } from '@phosphor-icons/react';
import { PillButton } from '@/app/(ui)/components/portal/kit/ui';

export function RealLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/v1/auth/email-otp/send-verification-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: 'sign-in' }),
      });
      if (!response.ok) throw new Error('We could not send a sign-in code. Check the address or try again later.');
      setStep('code');
      setMessage('If this email is provisioned for an active workspace, a sign-in code is on its way.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a sign-in code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/sign-in/email-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code.trim() }),
      });
      if (!response.ok) throw new Error('That code could not be verified. Check it and try again.');
      router.replace('/portal');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify this code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === 'email' ? (
        <form className="space-y-4" onSubmit={requestCode}>
          <div>
            <label htmlFor="real-email" className="mb-1.5 block text-sm font-semibold text-az-navy">Work email</label>
            <input id="real-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="w-full rounded-[12px] border border-az-grey-bg bg-az-grey-bg px-4 py-3 text-[15px] text-az-text focus-visible:outline-2 focus-visible:outline-az-green" />
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <PillButton tone="mint" type="submit" disabled={busy} className="w-full justify-center">{busy ? 'Sending code…' : 'Send sign-in code'}</PillButton>
          <p className="text-sm leading-relaxed text-az-text-muted">Use the email address attached to your approved Azentio or client workspace membership.</p>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={verifyCode}>
          <p className="text-sm leading-relaxed text-az-text">Enter the six-digit code sent to <strong>{email}</strong>.</p>
          <div>
            <label htmlFor="real-code" className="mb-1.5 block text-sm font-semibold text-az-navy">Email code</label>
            <input id="real-code" type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="w-full rounded-[12px] border border-az-grey-bg bg-az-grey-bg px-4 py-3 text-[20px] tracking-[0.35em] text-az-text focus-visible:outline-2 focus-visible:outline-az-green" />
          </div>
          {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <PillButton tone="mint" type="submit" disabled={busy || code.length !== 6} className="w-full justify-center">{busy ? 'Verifying…' : 'Verify and sign in'}</PillButton>
          <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); setMessage(''); }} className="text-sm font-medium text-az-navy underline underline-offset-4">Use a different email</button>
        </form>
      )}
    </div>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-az-error"><WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />{children}</p>;
}
