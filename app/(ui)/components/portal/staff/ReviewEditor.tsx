'use client';

import { useId, useState } from 'react';

/**
 * Editable shared copy for the moderator review. Edits stay in the browser; nothing is saved in this preview.
 * Author reference links are private source: each one is dropped unless the moderator ticks "Keep in shared copy".
 */
export default function ReviewEditor({ initial, referenceLinks = [], onKeptLinksChange }: {
  initial: string;
  referenceLinks?: string[];
  onKeptLinksChange?: (kept: string[]) => void;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [kept, setKept] = useState<string[]>([]);

  function toggle(link: string, checked: boolean) {
    const next = checked ? [...kept, link] : kept.filter((item) => item !== link);
    setKept(next);
    onKeptLinksChange?.(next);
  }

  return (
    <div>
      <label htmlFor={id} className="sr-only">Shared copy</label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        placeholder="Write the redacted shared copy here."
        className="w-full rounded-[12px] border border-az-grey-bg bg-white p-4 text-[15px] leading-relaxed text-az-text transition-colors duration-150 focus-visible:border-az-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green"
      />
      {initial.trim() === '' && (
        <p className="mt-2 text-sm text-az-text-muted">No shared copy yet. Write a redacted version before you decide.</p>
      )}
      {referenceLinks.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-az-navy">Author reference links (private)</legend>
          <ul className="mt-2 space-y-2">
            {referenceLinks.map((link) => (
              <li key={link} className="flex items-start gap-3 text-sm text-az-text">
                <input
                  type="checkbox"
                  checked={kept.includes(link)}
                  onChange={(e) => toggle(link, e.target.checked)}
                  className="mt-1 accent-az-navy"
                  aria-label={`Keep in shared copy: ${link}`}
                />
                <span className="min-w-0 flex-1 break-all">
                  <span className="mr-2 text-xs font-semibold text-az-text-muted">Keep in shared copy</span>
                  <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">{link}</a>
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
