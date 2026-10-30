import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { queryAira, type ChatMessage } from '@/app/api/(services)/aira/ai';
import { query } from '@/app/api/(db)/client';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { searchApprovedCopies } from '@/app/api/(services)/learning/shared-learning';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(1500),
  })).max(12).optional(),
  allow_external_processing: z.boolean().optional().default(false),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid AIRA request', details: parsed.error.flatten() }, { status: 422 });
  }

  let sharedEvidence: { id: string; title: string; category: string; content: string }[] = [];
  let actor: Awaited<ReturnType<typeof getSession>> = null;
  try {
    actor = await getSession();
    if (actor?.activeWorkspace) {
      const permission = await authorize({ action: 'shared-learning:read' });
      if (permission.allowed) {
        const results = await searchApprovedCopies(
          { q: parsed.data.message, limit: 4 },
          actor.activeWorkspace.isSandbox ? actor.activeWorkspace.orgId : undefined,
        );
        sharedEvidence = results.data.map((item) => {
          const payload = item as typeof item & Record<string, unknown>;
          return {
            id: item.id,
            title: String(payload.title ?? 'Approved shared contribution'),
            category: String(payload.observation_type ?? 'Shared learning'),
            content: String(payload.body ?? ''),
          };
        });
      }
    }
  } catch {
    // Public guide remains available without active database session.
  }

  try {
    if (parsed.data.allow_external_processing && actor) {
      await query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
         VALUES ($1, 'aira.external_processing_consent', 'aira_request', $2, $3, $4, 'allowed', $5::jsonb)`,
        [actor.user.id, randomUUID(), actor.activeWorkspace?.orgId ?? null,
          request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
          JSON.stringify({ message_processing: true, recent_chat_processing: true })],
      );
    }
    const result = await queryAira(
      parsed.data.message,
      (parsed.data.history ?? []) as ChatMessage[],
      sharedEvidence,
      parsed.data.allow_external_processing,
      actor?.activeWorkspace?.isSandbox ? actor.activeWorkspace.orgId : undefined,
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (err: unknown) {
    console.error('AIRA query error:', err);
    return Response.json({ error: 'AIRA failure', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
