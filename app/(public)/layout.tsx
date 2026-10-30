import Header from '@/app/(ui)/components/public/Header';
import Footer from '@/app/(ui)/components/public/Footer';
import ScrollProgress from '@/app/(ui)/motion/ScrollProgress';
import AiraWidget from '@/app/(ui)/components/public/AiraWidget';

// GSAP animations only in this boundary (portal uses ≤150ms Tailwind transitions).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-canvas font-display text-ink antialiased`}>
      <ScrollProgress />
      <a href="#main" className="focus-ring sr-only z-[70] rounded-full bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <AiraWidget />
    </div>
  );
}
