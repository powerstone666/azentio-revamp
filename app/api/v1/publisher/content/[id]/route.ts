import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updatePublisherContent, type PublicContentInput } from '@/app/api/(services)/public-content/service';
import { z as zod } from 'zod';

const idSchema = zod.uuid();
const linkHref = zod.string().trim().max(2048).refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use an internal path or HTTPS link');
const contentSchema = zod.object({
  kind: zod.enum(['announcement', 'page']),
  slug: zod.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).nullable(),
  title: zod.string().trim().min(3).max(160),
  body: zod.string().trim().min(1).max(10000),
  link_label: zod.string().trim().min(1).max(60).nullable(),
  link_href: linkHref.nullable(),
  status: zod.enum(['draft', 'published', 'archived']),
  starts_at: zod.iso.datetime().nullable(),
  ends_at: zod.iso.datetime().nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'page' && !value.slug) ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Public pages need a URL slug' });
  if (value.kind === 'announcement' && value.slug !== null) ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Announcements do not use a page slug' });
  if (value.kind === 'announcement' && value.body.length > 400) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Announcements must be 400 characters or fewer' });
  if ((value.link_label === null) !== (value.link_href === null)) ctx.addIssue({ code: 'custom', path: ['link_href'], message: 'Provide both link label and link destination' });
  if (value.starts_at && value.ends_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at)) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End time must be after start time' });
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) return Response.json({ error: 'Publisher access required' }, { status: 403 });
  const permission = await authorize({ action: 'content:manage' });
  if (!permission.allowed) return Response.json({ error: 'Publisher access required' }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Content item not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = contentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  if (parsed.data.kind === 'announcement' && parsed.data.body.length > 400) return Response.json({ error: 'Announcements must be 400 characters or fewer' }, { status: 422 });
  try {
    const data = await updatePublisherContent({
      id: id.data, userId: session.user.id, orgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), content: parsed.data as PublicContentInput,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Content item not found' }, { status: 404 });
    if ((error as { code?: string })?.code === '23505') return Response.json({ error: 'That public page slug is already in use' }, { status: 409 });
    console.error('Public content update failed:', error);
    return Response.json({ error: 'Unable to update public content' }, { status: 500 });
  }
}
