'use client';

import { useState } from 'react';
import AnnouncementBar from '@/app/(ui)/components/public/AnnouncementBar';
import Header from '@/app/(ui)/components/public/Header';
import Footer from '@/app/(ui)/components/public/Footer';

/**
 * Public marketing layout — Azentio.com visual patterns:
 * Announcement bar → Header → Page content → Footer
 * GSAP animations only in this boundary (portal uses ≤150ms transitions).
 */

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  return (
    <>
      {showAnnouncement && (
        <AnnouncementBar
          message="Azentio recognised for banking technology innovation"
          ctaLabel="Read the report"
          ctaHref="/insights"
          onDismiss={() => setShowAnnouncement(false)}
        />
      )}
      <Header />
      <main>{children}</main>
      <Footer />

      {/* Floating "Book a Demo" tab — pinned to right edge */}
      <a
        href="/request-demo"
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-az-navy px-3 py-6 text-[13px] font-semibold text-white transition-all duration-300 hover:bg-az-navy/90 hover:pr-5"
        style={{ writingMode: 'vertical-rl' }}
      >
        Book a Demo
      </a>
    </>
  );
}