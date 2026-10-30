'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Check } from '@phosphor-icons/react';

type Item = { id: string; event: string; safe_payload: Record<string, unknown>; read_at: string | null; created_at: string };
type Inbox = { data: Item[]; unread_count: number };

const labels: Record<string, string> = {
  'workspace.joined': 'You joined a workspace.',
  'workspace.access_revoked': 'Your workspace access changed.',
  'contribution.needs_clarification': 'A contribution needs your attention.',
  'contribution.rejected': 'A contribution review was completed.',
  'contribution.approved': 'A contribution was approved.',
  'contribution.published': 'A contribution was published to shared learning.',
  'contribution.withdrawn': 'A contribution was withdrawn.',
  'contribution.suspended': 'A shared contribution was temporarily unpublished for review.',
  'contribution.reinstated': 'A shared contribution was reinstated.',
  'contribution.revision_submitted': 'Your revised contribution was submitted for renewed review.',
  'contribution.acknowledged': 'A contribution you shared informed an improvement idea.',
  'idea.status_updated': 'An improvement idea status changed.',
  'support_ticket.status_updated': 'A support ticket status changed.',
  'broadcast.invited': 'Your organisation has been invited to a client webinar.',
};

function destination(item: Item) {
  const contributionId = item.safe_payload.contribution_id;
  if (typeof contributionId === 'string' && /^[0-9a-f-]{36}$/i.test(contributionId)) {
    return `/portal/client/observations/${contributionId}`;
  }
  if (item.event === 'support_ticket.status_updated') return '/portal/client/support';
  if (item.event === 'idea.status_updated') return '/portal/client/ideas';
  if (item.event === 'broadcast.invited') return '/portal/client#briefings-heading';
  return '/portal';
}

export function NotificationBell() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load notifications.');
      setInbox(await response.json() as Inbox);
      setError('');
    } catch {
      setError('Notifications are temporarily unavailable.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function markRead(id: string) {
    const response = await fetch(`/api/v1/notifications/${id}`, { method: 'PATCH' });
    if (response.ok) await refresh();
  }

  return (
    <div className="relative">
      <button type="button" aria-label={`Notifications${inbox?.unread_count ? `, ${inbox.unread_count} unread` : ''}`}
        aria-expanded={open} onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-az-grey-bg text-az-navy hover:bg-az-grey-bg cursor-pointer active:scale-95 transition-all">
        <Bell size={19} weight="bold" aria-hidden />
        {!!inbox?.unread_count && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-az-green px-1 text-[10px] font-bold text-az-navy">{inbox.unread_count > 99 ? '99+' : inbox.unread_count}</span>}
      </button>
      {open && <section aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-az-grey-bg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-az-navy">Notifications</h2><button type="button" onClick={() => void refresh()} className="text-xs text-az-navy underline cursor-pointer hover:opacity-80">Refresh</button></div>
        {error ? <p role="status" className="text-sm text-az-text-muted">{error}</p> : !inbox?.data.length ? <p className="text-sm text-az-text-muted">You’re all caught up.</p> : <ul className="max-h-80 space-y-2 overflow-auto">
          {inbox.data.map((item) => <li key={item.id} className={`rounded-xl p-3 text-sm ${item.read_at ? 'bg-white' : 'bg-az-mint-tint'}`}>
            <div className="flex items-start justify-between gap-2"><Link href={destination(item)} onClick={() => { if (!item.read_at) void markRead(item.id); }} className="font-medium text-az-navy hover:underline">{labels[item.event] ?? 'There is an update in your workspace.'}</Link>
              {!item.read_at && <button type="button" aria-label="Mark as read" onClick={() => void markRead(item.id)} className="text-az-navy cursor-pointer hover:opacity-80 active:scale-90 transition-all"><Check size={16} aria-hidden /></button>}</div>
            <time className="mt-1 block text-xs text-az-text-muted" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
          </li>)}
        </ul>}
      </section>}
    </div>
  );
}
