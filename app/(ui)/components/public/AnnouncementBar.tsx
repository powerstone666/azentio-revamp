'use client';

import { useRef } from 'react';

/**
 * Announcement bar — full-width navy strip above header.
 * Pattern from azentio.com: one-line message + mint pill + close ×.
 * Shown on public pages only.
 */

interface Props {
  message: string;
  ctaLabel: string;
  ctaHref: string;
  onDismiss: () => void;
}

export default function AnnouncementBar({ message, ctaLabel, ctaHref, onDismiss }: Props) {
  return (
    <div className="relative bg-az-navy">
      <div className="mx-auto flex max-w-[1280px] items-center justify-center gap-4 px-5 py-2.5 md:px-20">
        <p className="text-[14px] text-white/90">{message}</p>
        <a
          href={ctaHref}
          className="inline-block rounded-[50px] bg-az-mint px-4 py-1 text-[13px] font-semibold text-az-navy transition-colors hover:bg-az-mint/80"
        >
          {ctaLabel}
        </a>
        <button
          onClick={onDismiss}
          className="absolute right-5 text-white/60 hover:text-white md:right-20"
          aria-label="Dismiss announcement"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}