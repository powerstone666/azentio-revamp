import 'server-only';

import { queryAira, type ChatMessage } from '@/app/api/(services)/aira/ai';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { message, history } = (body || {}) as {
      message?: string;
      history?: ChatMessage[];
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return Response.json(
        { error: 'Message text is required' },
        { status: 400 }
      );
    }

    const result = await queryAira(message, history || []);
    return Response.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    console.error('AIRA API error:', err);
    return Response.json(
      { error: 'AIRA could not process the query', details: errorMessage },
      { status: 500 }
    );
  }
}
