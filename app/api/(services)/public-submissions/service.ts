import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderEmailTemplate } from '@/app/api/(services)/email/renderer';

export type PublicSubmissionType = 'demo_enquiry' | 'hackathon_registration';
export type PublicSubmissionStatus = 'new' | 'triaged' | 'closed';

const demoEnquiryPayloadSchema = z.object({
  type: z.literal('demo_enquiry'),
  first: z.string().trim().min(1).max(100),
  last: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40),
  title: z.string().trim().max(120),
  company: z.string().trim().min(1).max(180),
  country: z.string().trim().min(1).max(100),
  enquiry: z.enum(['Request a demo', 'Sales', 'Support', 'Partnership']),
  comments: z.string().max(1000),
  consent: z.literal(true),
});

const hackathonPayloadSchema = z.object({
  type: z.literal('hackathon_registration'),
  name: z.string().trim().min(1).max(180),
  email: z.string().trim().email().max(254),
  org: z.string().trim().min(1).max(180),
  role: z.string().trim().min(1).max(120),
  team: z.enum(['Solo', 'Team']),
  skills: z.array(z.enum(['Data science', 'Engineering', 'Design', 'Domain expertise'])).min(1).max(4),
  idea: z.string().max(800),
  consent: z.literal(true),
});

export type PublicSubmissionPayload =
  | z.infer<typeof demoEnquiryPayloadSchema>
  | z.infer<typeof hackathonPayloadSchema>;

export interface PublicSubmission {
  id: string;
  submission_type: PublicSubmissionType;
  email: string;
  organization_name: string;
  status: PublicSubmissionStatus;
  created_at: Date;
  consented_at: Date;
  payload: PublicSubmissionPayload | null;
  payload_valid: boolean;
}

type StoredSubmission = Omit<PublicSubmission, 'payload' | 'payload_valid'> & { payload: unknown };

function validatePayload(
  type: PublicSubmissionType,
  value: unknown,
  email: string,
  organizationName: string,
): PublicSubmissionPayload | null {
  if (type === 'demo_enquiry') {
    const parsed = demoEnquiryPayloadSchema.safeParse(value);
    if (!parsed.success || parsed.data.email.toLowerCase() !== email.toLowerCase()
      || parsed.data.company !== organizationName) return null;
    return parsed.data;
  }

  const parsed = hackathonPayloadSchema.safeParse(value);
  if (!parsed.success || parsed.data.email.toLowerCase() !== email.toLowerCase()
    || parsed.data.org !== organizationName) return null;
  return parsed.data;
}

/** Returns only the fields operators need, and strips any unrecognized stored payload keys. */
export async function listPublicSubmissions(): Promise<PublicSubmission[]> {
  const rows = await query<StoredSubmission>(
    `SELECT id, submission_type, email, organization_name, status, created_at,
            consented_at, payload
     FROM public_submissions
     ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'triaged' THEN 1 ELSE 2 END,
              CASE WHEN status = 'closed' THEN created_at END DESC,
              CASE WHEN status <> 'closed' THEN created_at END ASC,
              id
     LIMIT 200`,
  );

  return rows.map((row) => {
    const payload = validatePayload(row.submission_type, row.payload, row.email, row.organization_name);
    return { ...row, payload, payload_valid: payload !== null };
  });
}

export async function updatePublicSubmissionStatus(input: {
  id: string;
  actorId: string;
  requestId: string;
  status: Exclude<PublicSubmissionStatus, 'new'>;
}) {
  return transaction(async (tx) => {
    const rows = await tx<{ id: string; submission_type: PublicSubmissionType; status: PublicSubmissionStatus }>(
      'SELECT id, submission_type, status FROM public_submissions WHERE id = $1 FOR UPDATE',
      [input.id],
    );
    const submission = rows[0];
    if (!submission) throw new Error('Public submission not found');

    if (submission.status === input.status) return { id: submission.id, status: submission.status };
    const allowed: Record<PublicSubmissionStatus, PublicSubmissionStatus[]> = {
      new: ['triaged', 'closed'],
      triaged: ['closed'],
      closed: [],
    };
    if (!allowed[submission.status].includes(input.status)) {
      throw new Error('Public submission status transition is not allowed');
    }

    const updated = await tx<{ id: string; status: PublicSubmissionStatus }>(
      'UPDATE public_submissions SET status = $2 WHERE id = $1 RETURNING id, status',
      [input.id, input.status],
    );
    await tx(
      `INSERT INTO audit_log
         (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'public_submission.status_update', 'public_submission', $2, NULL, $3, 'allowed', $4::jsonb)`,
      [input.actorId, input.id, input.requestId, JSON.stringify({
        submission_type: submission.submission_type,
        from_status: submission.status,
        to_status: input.status,
      })],
    );
    return updated[0];
  });
}

export async function createPublicSubmission(input: {
  type: PublicSubmissionType;
  email: string;
  organization: string;
  payload: Record<string, unknown>;
  origin: string;
}) {
  const email = input.email.trim().toLowerCase();
  const requestId = randomUUID();
  return transaction(async (tx) => {
    // This form is public and every accepted submission emails the admin inbox, so a repeat from the same
    // address and form within 60 seconds is acknowledged without storing or mailing it again.
    await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`public-submission:${input.type}:${email}`]);
    const recent = await tx<{ id: string }>(
      `SELECT id FROM public_submissions
       WHERE submission_type = $1 AND lower(email) = $2 AND created_at > now() - interval '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [input.type, email],
    );
    if (recent[0]) return { accepted: true as const, id: recent[0].id, email_outbox_id: null };
    const inserted = await tx<{ id: string }>(
      `INSERT INTO public_submissions
         (submission_type, email, organization_name, payload, privacy_notice_version, request_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id`,
      [input.type, email, input.organization.trim(), JSON.stringify(input.payload), '2026-10-v1', requestId],
    );
    const submissionId = inserted[0].id;
    const configuredRecipient = process.env.PUBLIC_SUBMISSIONS_TO?.trim() || process.env.SMTP_FROM?.trim() || '';
    const recipient = configuredRecipient.match(/<([^<>]+)>/)?.[1]?.trim() || configuredRecipient;
    if (!z.string().email().safeParse(recipient).success) {
      return { accepted: true as const, id: submissionId, email_outbox_id: null };
    }

    const payload = input.payload;
    const fields = input.type === 'demo_enquiry'
      ? [
          ['Name', `${String(payload.first ?? '')} ${String(payload.last ?? '')}`.trim()],
          ['Email', email],
          ['Company', input.organization],
          ['Job title', String(payload.title ?? '')],
          ['Phone', String(payload.phone ?? '')],
          ['Country', String(payload.country ?? '')],
          ['Enquiry', String(payload.enquiry ?? '')],
          ['Comments', String(payload.comments ?? '')],
        ]
      : [
          ['Name', String(payload.name ?? '')],
          ['Email', email],
          ['Organisation', input.organization],
          ['Role', String(payload.role ?? '')],
          ['Team', String(payload.team ?? '')],
          ['Skills', Array.isArray(payload.skills) ? payload.skills.map(String).join(', ') : ''],
          ['Idea', String(payload.idea ?? '')],
        ];
    const details = fields.filter(([, value]) => value.length > 0).map(([label, value]) => `${label}: ${value}`);
    const subject = input.type === 'demo_enquiry' ? 'New Azentio website enquiry' : 'New Azentio hackathon registration';
    const rendered = renderEmailTemplate('general', {
      title: subject,
      subtitle: `Submission ${submissionId}`,
      paragraphs: [...details, 'Review and update this submission in the portal inbox.'],
      actionUrl: '/portal/admin/public-submissions',
      actionLabel: 'Open public enquiries',
    }, { subject, preheader: 'A new public form submission was received.' }, input.origin);
    const emailOutboxId = await enqueueEmail(tx, {
      idempotencyKey: `public-submission:${submissionId}:email`,
      recipient,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return { accepted: true as const, id: submissionId, email_outbox_id: emailOutboxId };
  });
}
