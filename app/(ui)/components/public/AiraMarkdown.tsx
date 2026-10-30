import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import { ArrowRight } from '@phosphor-icons/react';

interface Source {
  title: string;
  url: string;
}

const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1.5 text-[13.5px] leading-relaxed text-az-navy/90 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-az-navy">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h4 className="mb-1 mt-3 text-[15px] font-bold text-az-navy first:mt-0">{children}</h4>,
  h2: ({ children }) => <h4 className="mb-1 mt-3 text-[15px] font-bold text-az-navy first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mb-1 mt-3 text-[14px] font-bold text-az-navy first:mt-0">{children}</h5>,
  h4: ({ children }) => <h5 className="mb-1 mt-2 text-[13.5px] font-semibold text-az-navy first:mt-0">{children}</h5>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-az-navy/90 marker:text-az-navy">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-az-navy/90 marker:font-semibold marker:text-az-navy">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  hr: () => <hr className="my-3 border-gray-300" />,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-az-mint pl-3 text-az-navy/80">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-white px-1 py-0.5 font-mono text-[12.5px] text-az-navy">{children}</code>,
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-white p-3 text-[12.5px]">{children}</pre>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-gray-300 px-2 py-1 font-semibold text-az-navy">{children}</th>,
  td: ({ children }) => <td className="border-b border-gray-200 px-2 py-1 align-top text-az-navy/90">{children}</td>,
  a: ({ href = '', children }) => {
    const className = 'inline-flex items-center gap-0.5 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline';
    if (href.startsWith('/')) {
      return (
        <Link href={href} className={className}>
          <span>{children}</span>
          <ArrowRight size={12} weight="bold" className="inline" aria-hidden="true" />
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  },
};

/** Turns [S1]-style citations into links to the matching source, leaving real markdown links alone. */
function linkCitations(text: string, sources: Source[]) {
  return text.replace(/\[S(\d+)\](?!\()/g, (match, n) => {
    const source = sources[Number(n) - 1];
    return source ? `[${match.slice(1, -1)}](${source.url} "${source.title.replace(/"/g, "'")}")` : match;
  });
}

export default function AiraMarkdown({ text, sources = [] }: { text: string; sources?: Source[] }) {
  return <ReactMarkdown components={COMPONENTS}>{linkCitations(text, sources)}</ReactMarkdown>;
}
