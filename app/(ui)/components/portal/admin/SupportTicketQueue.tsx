'use client';

import { useState } from 'react';

type Organization = { id: string; name: string; expires_at: string | Date };
type Ticket = {
  id: string; requester: string; subject: string; details: string; category: string;
  status: string; priority: string; created_at: string | Date; updated_at: string | Date;
};

const STATUSES: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

export function SupportTicketQueue({ organizations, initialOrgId, initialTickets }: {
  organizations: Organization[]; initialOrgId: string | null; initialTickets: Ticket[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(initialOrgId ?? '');
  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load(orgId: string) {
    if (!orgId) { setTickets([]); setSelectedOrgId(''); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/support-tickets/admin?org_id=${encodeURIComponent(orgId)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to load support queue.');
      setSelectedOrgId(orgId); setTickets(result.data.tickets as Ticket[]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load support queue.'); }
    finally { setBusy(false); }
  }

  async function changeStatus(ticketId: string, status: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/support-tickets/admin/${ticketId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update ticket status.');
      setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, status: result.data.status, updated_at: result.data.updated_at } : ticket));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update ticket status.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5">
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <label htmlFor="support-org" className="text-sm font-semibold text-az-navy">Organisation with active support access</label>
      <select id="support-org" value={selectedOrgId} onChange={(event) => void load(event.target.value)} disabled={busy} className="mt-2 block w-full max-w-lg rounded-xl border border-az-grey-bg bg-white px-4 py-3 text-sm">
        <option value="">Select an organisation</option>
        {organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · access expires {new Date(org.expires_at).toLocaleDateString()}</option>)}
      </select>
      <p className="mt-2 text-xs text-az-text-muted">Only organisations with an active, organisation-wide support grant are listed. Access is checked again for every ticket request.</p>
    </div>
    {!selectedOrgId ? <div className="rounded-2xl bg-white p-5 text-sm text-az-text-muted">No active organisation-wide support grant is available.</div> : tickets.length === 0 ? <div className="rounded-2xl bg-white p-5 text-sm text-az-text-muted">No support tickets for this organisation.</div> : <div className="space-y-4">{tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-az-navy">{ticket.subject}</h2><p className="mt-1 text-xs text-az-text-muted">{ticket.requester} · {ticket.category.replaceAll('_', ' ')} · Priority: {ticket.priority}</p></div><span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy">{STATUSES[ticket.status] ?? ticket.status}</span></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-az-text">{ticket.details}</p>
      {ticket.status !== 'closed' && <div className="mt-4 flex flex-wrap gap-2">{(ticket.status === 'open' ? ['in_progress', 'resolved', 'closed'] : ticket.status === 'in_progress' ? ['open', 'resolved', 'closed'] : ['in_progress', 'closed']).map((status) => <button key={status} type="button" disabled={busy} onClick={() => void changeStatus(ticket.id, status)} className="rounded-full border border-az-grey-bg px-3 py-1.5 text-xs font-semibold text-az-navy disabled:opacity-50">Set {STATUSES[status]}</button>)}</div>}
    </article>)}</div>}
    {message && <p role="status" className="text-sm text-az-error">{message}</p>}
  </section>;
}
