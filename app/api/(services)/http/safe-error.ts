import 'server-only';

interface ErrorRule {
  /** Message fragment or pattern that identifies a deliberate domain error thrown by a service. */
  match: string | RegExp;
  status: number;
}

/**
 * Turns a thrown service error into a response without leaking internals.
 * Only messages matching a rule (our own domain errors) are echoed; anything else, such as a driver or database message, becomes a generic 500.
 */
export function safeErrorResponse(error: unknown, rules: ErrorRule[], fallback: string, init?: ResponseInit): Response {
  const message = error instanceof Error ? error.message : '';
  const rule = message
    ? rules.find(({ match }) => (typeof match === 'string' ? message.includes(match) : match.test(message)))
    : undefined;
  if (rule) return Response.json({ error: message }, { ...init, status: rule.status });
  return Response.json({ error: fallback }, { ...init, status: 500 });
}
