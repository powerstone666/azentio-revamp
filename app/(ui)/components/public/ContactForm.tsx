'use client';

import Link from 'next/link';

/**
 * Contact form block — grey background, left headline, right two-column form.
 * Azentio.com pattern: "Let's begin our journey together".
 * Mint pill submit aligned right.
 */

export default function ContactForm() {
  return (
    <section className="bg-az-grey-bg py-20 md:py-24">
      <div className="mx-auto max-w-[1280px] px-5 md:px-20">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Left: Headline + illustration */}
          <div>
            <h2 className="text-[36px] font-semibold leading-tight text-az-navy md:text-[40px]">
              Let&apos;s begin our
              <br />
              <span className="az-underline">journey together</span>
            </h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-az-text-muted">
              Ready to see how our solutions can transform your financial operations?
              Fill out the form and our team will be in touch.
            </p>

            {/* Arrow illustration */}
            <svg
              className="mt-10 hidden h-20 w-20 text-az-green md:block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>

          {/* Right: Form */}
          <form
            className="grid grid-cols-2 gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="text"
              placeholder="First name"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green md:col-span-1"
            />
            <input
              type="text"
              placeholder="Last name"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green md:col-span-1"
            />
            <input
              type="email"
              placeholder="Business email"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green"
            />
            <input
              type="tel"
              placeholder="Phone"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green md:col-span-1"
            />
            <input
              type="text"
              placeholder="Job title"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green md:col-span-1"
            />
            <input
              type="text"
              placeholder="Company"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green"
            />
            <select className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green">
              <option value="">Country</option>
              <option>United Arab Emirates</option>
              <option>Saudi Arabia</option>
              <option>India</option>
              <option>Singapore</option>
              <option>Other</option>
            </select>
            <select className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green">
              <option value="">Enquiry type</option>
              <option>Product demo</option>
              <option>Partnership</option>
              <option>Support</option>
              <option>Other</option>
            </select>
            <textarea
              rows={3}
              placeholder="Comments"
              className="col-span-2 rounded-lg border-0 bg-white px-4 py-3 text-[15px] text-az-text outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-az-green"
            />

            {/* Consent */}
            <label className="col-span-2 flex items-start gap-2 text-[13px] text-az-text-muted">
              <input type="checkbox" className="mt-0.5" />
              I agree to Azentio processing my personal data in accordance with the Privacy Policy.
            </label>

            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-[50px] bg-az-mint px-8 py-3 text-[16px] font-semibold text-az-navy transition-all duration-300 hover:bg-az-mint/80"
              >
                Submit enquiry
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}