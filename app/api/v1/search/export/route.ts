import 'server-only';

import { searchQuerySchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { searchApprovedCopies } from '@/app/api/(services)/learning/shared-learning';

const MAX_EXPORT_ROWS = 500;
const COLUMNS = [
  'id', 'title', 'observation_type', 'offering', 'industry', 'region',
  'observation_period_start', 'observation_period_end', 'evidence_type',
  'confidence', 'body', 'published_at',
] as const;

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'search:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: 'Invalid search filters', details: parsed.error.flatten() }, { status: 422 });

  try {
    const rows: Array<Record<string, unknown>> = [];
    let cursor = parsed.data.cursor;
    let totalCount: number | null = null;
    while (rows.length < MAX_EXPORT_ROWS) {
      const page = await searchApprovedCopies(
        { ...parsed.data, cursor, limit: Math.min(100, MAX_EXPORT_ROWS - rows.length) },
        session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined,
      );
      if (rows.length === 0) totalCount = page.totalCount;
      rows.push(...page.data);
      if (!page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
    const lines = [COLUMNS.map(csvCell).join(','), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(','))];
    const filename = `shared-learning-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(`\uFEFF${lines.join('\r\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Exported-Rows': String(rows.length),
        ...(totalCount === null ? {} : { 'X-Total-Matching-Rows': String(totalCount) }),
      },
    });
  } catch {
    return Response.json({ error: 'Unable to export matching shared learning' }, { status: 400 });
  }
}
