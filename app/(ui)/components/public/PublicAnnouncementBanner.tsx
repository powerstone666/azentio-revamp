'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from '@phosphor-icons/react';

type Announcement = { id: string; title: string; body: string; link_label: string | null; link_href: string | null };

export default function PublicAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/public-content/announcement', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.data?.id) setAnnouncement(result.data as Announcement); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!announcement || dismissed) return null;
  const link = announcement.link_href?.startsWith('/')
    ? <Link href={announcement.link_href} className="shrink-0 font-semibold underline underline-offset-2">{announcement.link_label}</Link>
    : announcement.link_href
      ? <a href={announcement.link_href} target="_blank" rel="noreferrer" className="shrink-0 font-semibold underline underline-offset-2">{announcement.link_label}</a>
      : null;

  return <aside aria-label="Announcement" className="relative z-[60] bg-ink px-5 py-3 text-center text-sm text-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 pr-8">
      <strong>{announcement.title}</strong><span>{announcement.body}</span>{link}
    </div>
    <button type="button" aria-label="Dismiss announcement" onClick={() => setDismissed(true)} className="focus-ring absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white">
      <X size={16} aria-hidden="true" />
    </button>
  </aside>;
}
