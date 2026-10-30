import 'server-only';

import { z } from 'zod';
import { createPublicSubmission } from '@/app/api/(services)/public-submissions/service';
import { deliverEmailOutboxItem } from '@/app/api/(services)/email/outbox';

const email = z.string().trim().email().max(254);
const demoSchema = z.object({
  type: z.literal('demo_enquiry'),
  first: z.string().trim().min(1).max(100),
  last: z.string().trim().min(1).max(100),
  email,
  phone: z.string().trim().max(40).default(''),
  title: z.string().trim().max(120).default(''),
  company: z.string().trim().min(1).max(180),
  country: z.string().trim().min(1).max(100),
  enquiry: z.enum(['Request a demo', 'Sales', 'Support', 'Partnership']),
  comments: z.string().max(1000).default(''),
  consent: z.literal(true),
  website: z.string().max(200).optional(),
});
const hackathonSchema = z.object({
  type: z.literal('hackathon_registration'),
  name: z.string().trim().min(1).max(180),
  email,
  org: z.string().trim().min(1).max(180),
  role: z.string().trim().min(1).max(120),
  team: z.enum(['Solo', 'Team']),
  skills: z.array(z.enum(['Data science', 'Engineering', 'Design', 'Domain expertise'])).min(1).max(4),
  idea: z.string().max(800).default(''),
  consent: z.literal(true),
  website: z.string().max(200).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 16_384) return Response.json({ error: 'Request is too large' }, { status: 413 });
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return Response.json({ error: 'Expected a JSON request' }, { status: 415 });
  }

  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Request body is required' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 16_384) {
        await reader.cancel();
        return Response.json({ error: 'Request is too large' }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !('type' in body)) {
    return Response.json({ error: 'Invalid submission' }, { status: 422 });
  }

  const type = (body as { type: unknown }).type;
  const parsed = type === 'demo_enquiry' ? demoSchema.safeParse(body)
    : type === 'hackathon_registration' ? hackathonSchema.safeParse(body)
      : null;
  if (!parsed) return Response.json({ error: 'Unsupported submission type' }, { status: 422 });
  if (!parsed.success) {
    return Response.json({ error: 'Please review the submitted fields', details: parsed.error.flatten() }, { status: 422 });
  }

  // Quietly accept, but do not persist, common bot trap submissions.
  if (parsed.data.website) return Response.json({ accepted: true }, { status: 202 });

  const data = parsed.data;
  try {
    const submission = await createPublicSubmission(data.type === 'demo_enquiry'
      ? { type: data.type, email: data.email, organization: data.company, payload: data, origin: new URL(request.url).origin }
      : { type: data.type, email: data.email, organization: data.org, payload: data, origin: new URL(request.url).origin });
    if (submission.email_outbox_id) {
      // The submission is already committed. An SMTP failure stays queued for the scheduled outbox retry.
      await deliverEmailOutboxItem(submission.email_outbox_id, new URL(request.url).origin).catch(() => 'queued');
    }
    return Response.json({ accepted: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Public form submission could not be stored:', error);
    return Response.json({ error: 'We could not save your submission. Please try again shortly.' }, { status: 503 });
  }
}
