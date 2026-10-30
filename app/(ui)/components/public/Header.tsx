'use client';

import Link from 'next/link';
import Image from 'next/image';

/**
 * Public header — matches Azentio.com visual pattern:
 * White background, logo left, nav with chevron mega-menus,
 * navy "Contact us" pill + mint "Demo" pill + search icon.
 */

const NAV_ITEMS = [
  { label: 'About Azentio', href: '/about' },
  {
    label: 'Products',
    href: '/products',
    children: [
      { label: 'Banking', href: '/products/banking' },
      { label: 'Insurance', href: '/products/insurance' },
      { label: 'Capital Markets', href: '/products/capital-markets' },
      { label: 'Risk & Compliance', href: '/products/risk-compliance' },
      { label: 'ERP', href: '/products/erp' },
    ],
  },
  { label: 'Support', href: '/support' },
  { label: 'Insights', href: '/insights' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 md:px-20">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/brand/azentio-logo.svg"
            alt="Azentio"
            width={164}
            height={45}
            priority
            className="h-[36px] w-auto md:h-[45px]"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="group relative">
              <Link
                href={item.href}
                className="flex items-center gap-1 text-[15px] font-medium text-az-navy transition-colors duration-300 hover:text-az-green"
              >
                {item.label}
                {item.children && (
                  <svg
                    className="h-3 w-3 transition-transform group-hover:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </Link>

              {/* Dropdown */}
              {item.children && (
                <div className="absolute left-0 top-full mt-2 hidden min-w-[200px] rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5 group-hover:block">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      className="block rounded-lg px-4 py-2.5 text-[14px] text-az-navy transition-colors hover:bg-az-mint-tint hover:text-az-green"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="hidden rounded-[50px] bg-az-navy px-5 py-2.5 text-[15px] font-semibold text-white transition-all duration-300 hover:bg-az-navy/90 md:inline-block"
          >
            Contact us
          </Link>
          <Link
            href="/request-demo"
            className="rounded-[50px] bg-az-mint px-5 py-2.5 text-[15px] font-semibold text-az-navy transition-all duration-300 hover:bg-az-mint/80"
          >
            Demo
          </Link>
          {/* Mobile hamburger */}
          <button className="inline-flex items-center justify-center rounded-lg p-2 text-az-navy lg:hidden" aria-label="Menu">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}