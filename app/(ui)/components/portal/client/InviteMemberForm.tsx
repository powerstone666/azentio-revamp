'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, PillButton } from '@/app/(ui)/components/portal/kit/ui';
import { PreviewNote } from './PreviewNote';

const LABEL = 'block text-sm font-semibold text-az-navy';
const FIELD = 'mt-2 w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-2.5 text-[15px] text-az-text outline-none transition-colors duration-150 focus:border-az-green';

export function InviteMemberForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'client_member' | 'client_admin'>('client_member');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Invitation could not be created.');
      setEmail('');
      setMessage(result.email_status === 'sent' ? 'Invitation sent by email.' : 'Invitation saved. Email is queued for delivery.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitation could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={invite} aria-label="Invite a member">
      <Card className="space-y-5 p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="invite-email" className={LABEL}>Email</label>
            <input id="invite-email" name="email" type="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organisation.example" className={FIELD} />
          </div>
          <div>
            <label htmlFor="invite-role" className={LABEL}>Role</label>
            <select id="invite-role" name="role" value={role} onChange={(event) => setRole(event.target.value as typeof role)} className={FIELD}>
              <option value="client_member">Client member</option>
              <option value="client_admin">Client admin</option>
            </select>
          </div>
        </div>
        <div>
          <PillButton type="submit" tone="mint" disabled={disabled || busy}>{busy ? 'Sending…' : 'Send invitation'}</PillButton>
        </div>
        {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
        {disabled && <PreviewNote />}
      </Card>
    </form>
  );
}
