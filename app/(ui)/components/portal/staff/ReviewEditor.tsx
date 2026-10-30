'use client';

import { useId, useState } from 'react';

/** Editable shared copy for the moderator review. Edits stay in the browser; nothing is saved in this preview. */
export default function ReviewEditor({ initial }: { initial: string }) {
  const id = useId();
  const [text, setText] = useState(initial);

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
    </div>
  );
}
