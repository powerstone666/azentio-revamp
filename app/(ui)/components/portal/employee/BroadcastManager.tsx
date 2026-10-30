'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Broadcast = { id: string; title: string; status: 'scheduled' | 'live' | 'recorded' | 'cancelled'; audience: 'employees' | 'clients'; invited_org_ids: string[] };
type ClientOrganization = { id: string; name: string };
const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export default function BroadcastManager({ sessions, clientOrganizations }: { sessions: Broadcast[]; clientOrganizations: ClientOrganization[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'employees' | 'clients'>('employees');

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    setBusy(true); setMessage('');
    try {
      const startsAt = new Date(String(values.get('starts_at')));
      const endsRaw = String(values.get('ends_at') ?? '');
      const response = await fetch('/api/v1/broadcasts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.get('title'), description: values.get('description'),
          starts_at: startsAt.toISOString(),
          ends_at: endsRaw ? new Date(endsRaw).toISOString() : null,
          join_url: values.get('join_url') || null,
          recording_url: values.get('recording_url') || null,
          audience: values.get('audience'),
          invited_org_ids: values.getAll('invited_org_ids'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The session could not be saved.');
      formElement.reset(); setMessage('Session saved.'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The session could not be saved.');
    } finally { setBusy(false); }
  }

  async function updateInvitations(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/broadcasts/${id}/invitations`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_org_ids: values.getAll('invited_org_ids') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Invitations could not be updated.');
      setMessage('Invited client workspaces updated.'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitations could not be updated.');
    } finally { setBusy(false); }
  }

  async function update(id: string, status: 'live' | 'recorded' | 'cancelled', form: HTMLFormElement) {
    setBusy(true); setMessage('');
    const values = new FormData(form);
    try {
      const response = await fetch(`/api/v1/broadcasts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, join_url: values.get('join_url') || null, recording_url: values.get('recording_url') || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The session could not be updated.');
      setMessage('Session updated.'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The session could not be updated.');
    } finally { setBusy(false); }
  }

  function updateFromButton(event: React.MouseEvent<HTMLButtonElement>, id: string, status: 'live' | 'recorded' | 'cancelled') {
    const form = event.currentTarget.form;
    if (form) void update(id, status, form);
  }

  return <section className="space-y-5">
    <form onSubmit={create} className="space-y-4 rounded-2xl border border-az-grey-bg bg-white p-5">
      <h2 className="text-lg font-semibold text-az-navy">Schedule a session</h2>
      <label className="block text-sm font-medium text-az-navy">Audience<select name="audience" value={audience} onChange={(event) => setAudience(event.target.value as 'employees' | 'clients')} className={`${field} mt-1.5`}><option value="employees">Employees in this workspace</option><option value="clients">Invited client workspaces</option></select></label>
      {audience === 'clients' && <fieldset className="space-y-2 rounded-xl border border-az-grey-bg p-3"><legend className="px-1 text-sm font-medium text-az-navy">Invite client workspaces</legend>{clientOrganizations.length === 0 ? <p className="text-sm text-az-text-muted">No active client workspaces are available.</p> : clientOrganizations.map((organization) => <label key={organization.id} className="flex items-center gap-2 text-sm text-az-text"><input type="checkbox" name="invited_org_ids" value={organization.id} />{organization.name}</label>)}</fieldset>}
      <label className="block text-sm font-medium text-az-navy">Title<input name="title" required minLength={3} maxLength={180} className={`${field} mt-1.5`} /></label>
      <label className="block text-sm font-medium text-az-navy">Description<textarea name="description" maxLength={3000} rows={3} className={`${field} mt-1.5`} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-az-navy">Starts at<input name="starts_at" type="datetime-local" required className={`${field} mt-1.5`} /></label><label className="block text-sm font-medium text-az-navy">Ends at<input name="ends_at" type="datetime-local" className={`${field} mt-1.5`} /></label></div>
      <label className="block text-sm font-medium text-az-navy">Join link (HTTPS)<input name="join_url" type="url" placeholder="https://…" className={`${field} mt-1.5`} /></label>
      <label className="block text-sm font-medium text-az-navy">Recording link (HTTPS)<input name="recording_url" type="url" placeholder="Add after the session" className={`${field} mt-1.5`} /></label>
      <p className="text-xs text-az-text-muted">Session links are released only to active members of the configured employee or invited client workspaces.</p>
      {message && <p role="status" className="text-sm text-az-text">{message}</p>}
      <button type="submit" disabled={busy} className="rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy disabled:opacity-50">{busy ? 'Saving…' : 'Schedule session'}</button>
    </form>
    <div className="space-y-3">{sessions.map((session) => <div key={session.id} className="space-y-3 rounded-xl border border-az-grey-bg p-4">
      <p className="text-sm font-semibold text-az-navy">Manage {session.title} <span className="font-normal text-az-text-muted">· {session.audience === 'clients' ? 'Client webinar' : 'Employee session'}</span></p>
      {session.audience === 'clients' && <form onSubmit={(event) => void updateInvitations(event, session.id)} className="space-y-2 rounded-lg bg-az-grey-bg/40 p-3"><p className="text-xs font-semibold text-az-navy">Invited client workspaces</p>{clientOrganizations.map((organization) => <label key={organization.id} className="flex items-center gap-2 text-sm text-az-text"><input type="checkbox" name="invited_org_ids" value={organization.id} defaultChecked={session.invited_org_ids.includes(organization.id)} />{organization.name}</label>)}<button type="submit" disabled={busy || ['recorded', 'cancelled'].includes(session.status)} className="rounded-full border border-az-grey-bg bg-white px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Save invitations</button></form>}
      <form onSubmit={(event) => event.preventDefault()} className="space-y-3">
      <label className="block text-xs font-medium text-az-text">Join link<input name="join_url" type="url" placeholder="Keep current link or enter HTTPS URL" className={`${field} mt-1`} /></label>
      <label className="block text-xs font-medium text-az-text">Recording link<input name="recording_url" type="url" placeholder="Enter HTTPS URL before publishing recording" className={`${field} mt-1`} /></label>
      <div className="flex flex-wrap gap-2">{session.status === 'scheduled' && <><button type="button" disabled={busy} onClick={(event) => updateFromButton(event, session.id, 'live')} className="rounded-full bg-az-green px-4 py-2 text-xs font-semibold text-az-navy">Go live</button><button type="button" disabled={busy} onClick={(event) => updateFromButton(event, session.id, 'cancelled')} className="rounded-full border border-az-grey-bg px-4 py-2 text-xs font-semibold text-az-navy">Cancel</button></>}{session.status === 'live' && <><button type="button" disabled={busy} onClick={(event) => updateFromButton(event, session.id, 'recorded')} className="rounded-full bg-az-green px-4 py-2 text-xs font-semibold text-az-navy">Publish recording</button><button type="button" disabled={busy} onClick={(event) => updateFromButton(event, session.id, 'cancelled')} className="rounded-full border border-az-grey-bg px-4 py-2 text-xs font-semibold text-az-navy">End without recording</button></>}</div>
      </form>
    </div>)}</div>
  </section>;
}
