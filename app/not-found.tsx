import Image from 'next/image';
import Link from 'next/link';
import { ButtonLink } from '@/app/(ui)/components/public/ui';

// Rendered under the root layout only (no public header), so the logo links back home.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-[1240px] items-center px-5 py-6 md:px-8">
        <Link href="/" className="focus-ring rounded-md" aria-label="Azentio home">
          <Image src="/brand/azentio-logo.svg" width={132} height={36} alt="Azentio" priority />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center px-5 py-12 md:px-8">
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-line bg-surface p-8 text-center shadow-soft md:p-12">
          <p className="text-sm font-semibold tracking-[0.18em] text-accent-strong">404</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">This page could not be found</h1>
          <p className="mt-4 leading-relaxed text-muted">
            The address may be mistyped, or the page may have moved. Try one of these instead.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/">Home</ButtonLink>
            <ButtonLink href="/products" variant="ghost">Products</ButtonLink>
            <ButtonLink href="/connect" variant="ghost">Connect</ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
