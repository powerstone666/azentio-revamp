'use client';

import { useEffect, useState } from 'react';

type DemoEnquiryPayload = {
  type: 'demo_enquiry';
  first: string;
  last: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  country: string;
  enquiry: string;
  comments: string;
  consent: true;
};

type HackathonPayload = {
  type: 'hackathon_registration';
  name: string;
  email: string;
  org: string;
  role: string;
  team: 'Solo' | 'Team';
  skills: string[];
  idea: string;
  consent: true;
};

type Submission = {
  id: string;
  submission_type: 'demo_enquiry' | 'hackathon_registration';
  email: string;
  organization_name: string;
  status: 'new' | 'triaged' | 'closed';
  created_at: string;
  consented_at: string;
  payload: DemoEnquiryPayload | HackathonPayload | null;
  payload_valid: boolean;
};

const STATUS_LABEL: Record<Submission['status'], string> = {
  new: 'New',
  triaged: 'Triaged',
  closed: 'Closed',
};

const TYPE_LABEL: Record<Submission['submission_type'], string> = {
  demo_enquiry: 'Demo enquiry',
  hackathon_registration: 'Hackathon registration',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

async function readResponse(response: Response) {
  return response.json().catch(() => null) as Promise<{
    data?: { submissions?: Submission[]; id?: string; status?: Submission['status'] };
    error?: string;
  } | null>;
}

async function requestSubmissions(signal?: AbortSignal) {
  const response = await fetch('/api/v1/admin/public-submissions', { cache: 'no-store', signal });
  const result = await readResponse(response);
  if (!response.ok) throw new Error(result?.error ?? 'Unable to load public submissions.');
  if (!Array.isArray(result?.data?.submissions)) throw new Error('The inbox returned an invalid response.');
  return result.data.submissions;
}

export function PublicSubmissionInbox() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      setSubmissions(await requestSubmissions(signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load public submissions.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    requestSubmissions(controller.signal).then((items) => {
      if (!controller.signal.aborted) setSubmissions(items);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load public submissions.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  async function updateStatus(submission: Submission, status: 'triaged' | 'closed') {
    setBusyId(submission.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/v1/admin/public-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result?.error ?? 'Unable to update this submission.');
      if (result?.data?.status !== status) throw new Error('The inbox returned an invalid update response.');
      setSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, status } : item));
      setNotice(`${TYPE_LABEL[submission.submission_type]} marked ${STATUS_LABEL[status].toLowerCase()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update this submission.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-5" aria-label="Public submission inbox">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-white p-5 shadow-card">
        <p className="text-sm text-az-text">Demo enquiries and hackathon registrations, newest operational items first. Contact details are visible only to platform administrators.</p>
        <button type="button" onClick={() => void load()} disabled={loading || busyId !== null} className="rounded-full border-2 border-az-navy px-4 py-2 text-sm font-semibold text-az-navy transition-colors hover:bg-az-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh inbox'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-az-error/30 bg-az-error/5 px-4 py-3 text-sm text-az-error">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-az-green/30 bg-az-mint/30 px-4 py-3 text-sm text-az-navy">{notice}</p>}

      {loading && submissions.length === 0 ? (
        <div role="status" className="rounded-[12px] bg-white p-8 text-center text-sm text-az-text-muted shadow-card">Loading public submissions…</div>
      ) : !loading && submissions.length === 0 ? (
        <div className="rounded-[12px] bg-white p-8 text-center shadow-card">
          <p className="font-semibold text-az-navy">The inbox is clear</p>
          <p className="mt-2 text-sm text-az-text-muted">New demo enquiries and hackathon registrations will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-[12px] bg-white p-5 shadow-card md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy">{TYPE_LABEL[submission.submission_type]}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${submission.status === 'new' ? 'bg-az-mint text-az-navy' : submission.status === 'triaged' ? 'bg-az-grey-bg text-az-navy' : 'bg-az-navy text-white'}`}>
                      {STATUS_LABEL[submission.status]}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-az-navy">
                    {submission.payload?.type === 'demo_enquiry'
                      ? `${submission.payload.first} ${submission.payload.last}`
                      : submission.payload?.type === 'hackathon_registration'
                        ? submission.payload.name
                        : 'Submission details need review'}
                  </h2>
                  <p className="mt-1 text-sm text-az-text-muted">Received {formatDate(submission.created_at)}</p>
                </div>
                {submission.status !== 'closed' && (
                  <div className="flex flex-wrap gap-2">
                    {submission.status === 'new' && <button type="button" onClick={() => void updateStatus(submission, 'triaged')} disabled={busyId !== null} className="rounded-full bg-az-mint px-4 py-2 text-sm font-semibold text-az-navy disabled:cursor-not-allowed disabled:opacity-50">{busyId === submission.id ? 'Saving…' : 'Mark triaged'}</button>}
                    <button type="button" onClick={() => void updateStatus(submission, 'closed')} disabled={busyId !== null} className="rounded-full border border-az-navy px-4 py-2 text-sm font-semibold text-az-navy disabled:cursor-not-allowed disabled:opacity-50">Close</button>
                  </div>
                )}
              </div>

              <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-az-grey-bg pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Contact email</dt><dd className="mt-1 break-all text-az-text"><a className="underline underline-offset-2" href={`mailto:${submission.email}`}>{submission.email}</a></dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Organisation</dt><dd className="mt-1 text-az-text">{submission.organization_name}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Privacy consent recorded</dt><dd className="mt-1 text-az-text">{formatDate(submission.consented_at)}</dd></div>
              </dl>

              {!submission.payload_valid || !submission.payload ? (
                <p className="mt-4 rounded-lg bg-az-grey-bg/70 p-3 text-sm text-az-text-muted">Stored form data did not pass validation and is withheld from this view.</p>
              ) : submission.payload.type === 'demo_enquiry' ? (
                <dl className="mt-4 grid gap-x-8 gap-y-3 rounded-xl bg-az-grey-bg/40 p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Enquiry</dt><dd className="mt-1 text-az-text">{submission.payload.enquiry}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Country</dt><dd className="mt-1 text-az-text">{submission.payload.country}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Job title</dt><dd className="mt-1 text-az-text">{submission.payload.title || 'Not provided'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Phone</dt><dd className="mt-1 text-az-text">{submission.payload.phone || 'Not provided'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Comments</dt><dd className="mt-1 whitespace-pre-wrap text-az-text">{submission.payload.comments || 'No comments provided.'}</dd></div>
                </dl>
              ) : (
                <dl className="mt-4 grid gap-x-8 gap-y-3 rounded-xl bg-az-grey-bg/40 p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Role</dt><dd className="mt-1 text-az-text">{submission.payload.role}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Participation</dt><dd className="mt-1 text-az-text">{submission.payload.team}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Skills</dt><dd className="mt-1 text-az-text">{submission.payload.skills.join(', ')}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">Idea</dt><dd className="mt-1 whitespace-pre-wrap text-az-text">{submission.payload.idea || 'No idea provided.'}</dd></div>
                </dl>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
