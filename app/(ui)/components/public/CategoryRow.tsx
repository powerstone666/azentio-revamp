'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useStaggeredReveal } from '@/app/(ui)/motion/hero-animations';

/**
 * Product category row — 5-column grid with line icons.
 * Azentio.com pattern: icon, bold title, short description,
 * "Find out more" link.
 * GSAP staggered reveal on scroll.
 */

const CATEGORIES = [
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Banking',
    description: 'Core banking, lending, and digital banking platforms for financial institutions.',
    href: '/products/banking',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Insurance',
    description: 'End-to-end insurance solutions from underwriting to claims management.',
    href: '/products/insurance',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Capital Markets',
    description: 'Treasury, asset management, and investment banking solutions.',
    href: '/products/capital-markets',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Risk & Compliance',
    description: 'Anti-money laundering, fraud detection, and regulatory compliance tools.',
    href: '/products/risk-compliance',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: 'ERP',
    description: 'Enterprise resource planning for financial services organisations.',
    href: '/products/erp',
  },
];

export default function CategoryRow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  useStaggeredReveal(sectionRef as React.RefObject<HTMLElement | null>, { start: 'top 80%' });

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-[1280px] px-5 md:px-20">
        {/* Section header */}
        <div className="mb-14 flex items-end justify-between">
          <div>
            <p className="text-[15px] font-medium text-az-navy">Our products</p>
            <h2 className="mt-1 text-[36px] font-semibold text-az-navy md:text-[40px]">
              <span className="az-underline">Solutions</span> for financial services
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden rounded-[50px] bg-az-navy px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-az-navy/90 md:inline-block"
          >
            View all
          </Link>
        </div>

        {/* 5-column grid */}
        <div ref={sectionRef} className="grid gap-8 md:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className="group">
              <div className="mb-4 text-az-navy transition-colors group-hover:text-az-green">
                {cat.icon}
              </div>
              <h3 className="text-[18px] font-semibold text-az-navy">{cat.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-az-text-muted">
                {cat.description}
              </p>
              <Link
                href={cat.href}
                className="mt-3 inline-block text-[14px] font-semibold text-az-navy transition-colors hover:text-az-green"
              >
                Find out more &rarr;
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}