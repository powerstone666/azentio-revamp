import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createPublisherContent, listPublisherContent, type PublicContentInput } from '@/app/api/(services)/public-content/service';

const linkHref = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use an internal path or HTTPS link');
const contentSchema = z.object({
  kind: z.enum(['announcement', 'page']),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).nullable(),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000),
  link_label: z.string().trim().min(1).max(60).nullable(),
  link_href: linkHref.nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  starts_at: z.iso.datetime().nullable(),
  ends_at: z.iso.datetime().nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'page' && !value.slug) ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Public pages need a URL slug' });
  if (value.kind === 'announcement' && value.slug !== null) ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Announcements do not use a page slug' });
  if (value.kind === 'announcement' && value.body.length > 400) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Announcements must be 400 characters or fewer' });
  if (value.kind === 'announcement' && value.body.length > 400) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Announcements must be 400 characters or fewer' });
  if ((value.link_label === null) !== (value.link_href === null)) ctx.addIssue({ code: 'custom', path: ['link_href'], message: 'Provide both link label and link destination' });
  if (value.starts_at && value.ends_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at)) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End time must be after start time' });
});

async function publisherSession() {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) return null;
  const permission = await authorize({ action: 'content:manage' });
  return permission.allowed ? session : null;
}

function apiContent(content: z.infer<typeof contentSchema>): PublicContentInput {
  return content;
}

export async function GET(): Promise<Response> {
  const session = await publisherSession();
  if (!session) return Response.json({ error: 'Publisher access required' }, { status: 403 });
  const data = await listPublisherContent(session.user.id, session.activeWorkspace!.orgId);
  return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await publisherSession();
  if (!session) return Response.json({ error: 'Publisher access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = contentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createPublisherContent({
      userId: session.user.id, orgId: session.activeWorkspace!.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), content: apiContent(parsed.data),
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') return Response.json({ error: 'That public page slug is already in use' }, { status: 409 });
    console.error('Public content creation failed:', error);
    return Response.json({ error: 'Unable to create public content' }, { status: 500 });
  }
}
