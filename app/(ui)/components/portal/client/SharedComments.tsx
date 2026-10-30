'use client';

import { useState } from 'react';

type CommentItem = { id: string; body: string; created_at: string | Date; author_label: string; is_mine: boolean };

export function SharedComments({ sharedCopyId, initialComments }: { sharedCopyId: string; initialComments: CommentItem[] }) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [category, setCategory] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/shared-copies/${sharedCopyId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add comment.');
      setComments((current) => [...current, result.data as CommentItem]);
      setBody(''); setMessage('Comment added.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add comment.'); }
    finally { setBusy(false); }
  }

  async function reportComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportingId) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/shared-copy-comments/${reportingId}/reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, details }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to report comment.');
      setReportingId(null); setDetails(''); setMessage('Report sent to the learning moderation team.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to report comment.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 border-t border-az-grey-bg pt-6" aria-labelledby="community-comments-title">
    <h2 id="community-comments-title" className="text-lg font-semibold text-az-navy">Community discussion</h2>
    <p className="mt-1 text-sm text-az-text-muted">Comments are visible to members who can access this published shared contribution. Avoid confidential or identifying details.</p>
    <form onSubmit={addComment} className="mt-4 grid gap-3">
      <label htmlFor="shared-comment" className="text-sm font-semibold text-az-navy">Add a comment</label>
      <textarea id="shared-comment" required minLength={1} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 rounded-xl border border-az-grey-bg px-4 py-3 text-sm text-az-text" />
      <button type="submit" disabled={busy || !body.trim()} className="w-fit rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Post comment</button>
    </form>
    <ul className="mt-5 grid gap-3">
      {comments.map((comment) => <li key={comment.id} className="rounded-xl bg-az-grey-bg/50 p-4">
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-az-navy">{comment.author_label}</span><time className="text-xs text-az-text-muted" dateTime={new Date(comment.created_at).toISOString()}>{new Date(comment.created_at).toLocaleDateString()}</time></div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{comment.body}</p>
        {!comment.is_mine && <button type="button" onClick={() => { setReportingId(comment.id); setMessage(''); }} className="mt-3 text-xs font-semibold text-az-text-muted underline underline-offset-2">Report comment</button>}
        {reportingId === comment.id && <form onSubmit={reportComment} className="mt-3 grid gap-2 rounded-lg bg-white p-3">
          <label className="text-xs font-semibold text-az-navy">Reason<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block rounded-lg border border-az-grey-bg px-3 py-2"><option value="misleading">Misleading</option><option value="confidential">Confidential information</option><option value="inappropriate">Inappropriate</option><option value="other">Other</option></select></label>
          <label className="text-xs font-semibold text-az-navy">Details<textarea required minLength={10} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1 block w-full rounded-lg border border-az-grey-bg px-3 py-2" /></label>
          <div className="flex gap-3"><button disabled={busy} className="rounded-full bg-az-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Send report</button><button type="button" onClick={() => setReportingId(null)} className="text-xs text-az-text-muted">Cancel</button></div>
        </form>}
      </li>)}
    </ul>
    {comments.length === 0 && <p className="mt-4 text-sm text-az-text-muted">No comments yet.</p>}
    {message && <p role="status" className="mt-3 text-xs text-az-text-muted">{message}</p>}
  </section>;
}
