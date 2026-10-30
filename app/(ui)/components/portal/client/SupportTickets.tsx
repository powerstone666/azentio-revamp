'use client';

import { useState } from 'react';

type Ticket = {
  id: string; subject: string; details: string; category: string; status: string;
  priority: string; requester: string; created_at: string | Date; updated_at: string | Date;
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

export function SupportTickets({ initialTickets, canSeeOrgTickets, providerConnected = false }: { initialTickets: Ticket[]; canSeeOrgTickets: boolean; providerConnected?: boolean }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical_issue');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/support-tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, details, category }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to submit support request.');
      setTickets((current) => [{ ...result.data, requester: 'You' } as Ticket, ...current]);
      setSubject(''); setDetails(''); setCategory('technical_issue');
      setMessage('Support request received. Its current status is Open.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit support request.'); }
    finally { setBusy(false); }
  }

  return <section id="support-tickets" className="mt-10 grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="support-tickets-title">
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h2 id="support-tickets-title" className="text-lg font-semibold text-az-navy">Contact support</h2>
      <p className="mt-1 text-sm text-az-text-muted">Requests are private to {canSeeOrgTickets ? 'this organisation' : 'you and your organisation support team'}. {providerConnected && 'A connected support system will also receive the request details. '}Avoid including credentials, account numbers, or customer-level records.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <label className="text-sm font-semibold text-az-navy">Subject<input required minLength={5} maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg bg-white px-4 py-2.5 font-normal"><option value="product_question">Product question</option><option value="access">Product access</option><option value="technical_issue">Technical issue</option><option value="other">Other</option></select></label>
        <label className="text-sm font-semibold text-az-navy">How can we help?<textarea required minLength={10} maxLength={5000} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal" /></label>
        <button type="submit" disabled={busy} className="w-fit rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Submit request</button>
      </form>
    </div>
    <div>
      <h2 className="text-lg font-semibold text-az-navy">{canSeeOrgTickets ? 'Organisation requests' : 'Your requests'}</h2>
      <ul className="mt-3 space-y-3">
        {tickets.map((ticket) => <li key={ticket.id} className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold text-az-navy">{ticket.subject}</h3><span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy">{STATUS_LABEL[ticket.status] ?? ticket.status}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-az-text">{ticket.details}</p>
          <p className="mt-3 text-xs text-az-text-muted">{ticket.category.replaceAll('_', ' ')} · {canSeeOrgTickets ? `Submitted by ${ticket.requester} · ` : ''}Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
        </li>)}
      </ul>
      {tickets.length === 0 && <p className="mt-3 rounded-xl bg-white p-4 text-sm text-az-text-muted">No support requests yet.</p>}
    </div>
    {message && <p role="status" className="text-sm text-az-text-muted lg:col-span-2">{message}</p>}
  </section>;
}
