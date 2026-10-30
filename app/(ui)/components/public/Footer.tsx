'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Navy footer — matches Azentio.com pattern:
 * Navy background, white logo, 4 columns, newsletter,
 * copyright row.
 */

const FOOTER_COLUMNS = [
  {
    title: 'SOLUTIONS',
    links: [
      { label: 'Banking', href: '/products/banking' },
      { label: 'Insurance', href: '/products/insurance' },
      { label: 'Capital Markets', href: '/products/capital-markets' },
    ],
  },
  {
    title: 'SOLUTIONS',
    links: [
      { label: 'Risk & Compliance', href: '/products/risk-compliance' },
      { label: 'ERP', href: '/products/erp' },
    ],
  },
  {
    title: 'RESOURCES',
    links: [
      { label: 'Insights', href: '/insights' },
      { label: 'Featured', href: '/insights/featured' },
    ],
  },
  {
    title: 'CONNECT',
    links: [
      { label: 'Support', href: '/support' },
      { label: 'Partners', href: '/partners' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-az-navy">
      <div className="mx-auto max-w-[1280px] px-5 py-16 md:px-20">
        <div className="grid gap-10 md:grid-cols-5">
          {/* Logo + Newsletter */}
          <div className="md:col-span-1">
            <Image
              src="/brand/azentio-logo-white.svg"
              alt="Azentio"
              width={164}
              height={45}
              className="h-[40px] w-auto"
            />
            <div className="mt-8">
              <label className="text-xs font-semibold uppercase tracking-wider text-az-green">
                Stay updated
              </label>
              <div className="mt-3 flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="w-full rounded-l-lg border-0 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50"
                />
                <button className="rounded-r-lg bg-az-mint px-4 py-2.5 text-sm font-semibold text-az-navy transition-colors hover:bg-az-mint/80">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Nav Columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title + col.links[0].label}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-az-green">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[13px] text-white/50 md:flex-row">
          <p>&copy; 2026 Azentio. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
            <Link href="/support-policy" className="hover:text-white">Support Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}