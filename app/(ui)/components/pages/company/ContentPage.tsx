import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageHero, { type Crumb } from '@/app/(ui)/components/pages/PageHero';
import ContentSections from '@/app/(ui)/components/pages/ContentSections';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import { getContentPage } from '@/app/(config)/content';

// Metadata for a scraped page; falls back to empty metadata if the path is unknown.
export function contentMetadata(path: string): Metadata {
  const page = getContentPage(path);
  if (!page) return {};
  return { title: page.metaTitle || page.title, description: page.description };
}

interface ContentPageProps {
  path: string;
  eyebrow: string;
  crumbs: Crumb[];
  photo?: { src: string; alt: string };
  variant?: number;
  /** Rendered between the hero and the scraped sections. */
  children?: ReactNode;
}

// Shared layout for company pages: hero, optional extra block, scraped sections, closing CTA.
export default function ContentPage({ path, eyebrow, crumbs, photo, variant = 0, children }: ContentPageProps) {
  const page = getContentPage(path);
  if (!page) notFound();

  const intro = page.intro.find((t) => t.length > 60) ?? page.description;

  return (
    <>
      <PageHero eyebrow={eyebrow} title={page.title} intro={intro} crumbs={crumbs} photo={photo} variant={variant} />
      {children}
      <ContentSections sections={page.sections} />
      <CtaBand />
    </>
  );
}
