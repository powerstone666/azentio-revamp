import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getPublishedPublicPage } from '@/app/api/(services)/public-content/service';

export const instant = false;

export default async function PublishedContentPage({ searchParams }: {
  searchParams: Promise<{ slug?: string | string[] }>;
}) {
  const rawSlug = (await searchParams).slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const page = await getPublishedPublicPage(slug);
  if (!page) notFound();

  return <article className="mx-auto max-w-4xl px-5 py-20 md:px-10 md:py-28">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Azentio</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-6xl">{page.title}</h1>
    <div className="prose prose-lg mt-8 max-w-none whitespace-pre-wrap text-ink prose-headings:text-ink prose-a:text-accent">
      <ReactMarkdown>{page.body}</ReactMarkdown>
    </div>
    {page.link_label && page.link_href && <a href={page.link_href} className="mt-8 inline-flex rounded-full bg-accent px-6 py-3 font-semibold text-on-accent transition hover:brightness-105">{page.link_label}</a>}
  </article>;
}
