/**
 * @azentio/api-client
 *
 * Typed API client placeholder for the portal.
 *
 * Wraps the native `fetch` API with JSON serialisation,
 * typed request/response generics, and a centralised error
 * handler. Intended to be extended later when auth headers,
 * refresh-token rotation, and a real API base URL are wired
 * in.
 *
 * ── Usage ─────────────────────────────────────────────────
 * ```ts
 * import { createApiClient } from '@/ui/lib/api-client';
 *
 * const api = createApiClient('/api');
 * const ideas = await api.get<Idea[]>('/ideas');
 * const created = await api.post<Idea>('/ideas', { title: '…' });
 * ```
 */

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  status: number;
  /** Server-supplied detail (validation errors, etc.) */
  detail?: unknown;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

/**
 * Normalise a fetch Response that returned a non-2xx status
 * into a typed `ApiError`.
 *
 * Extracts structured `detail` when the server responds with
 * JSON, or falls back to `statusText` / generic message.
 */
export async function handleApiError(response: Response): Promise<ApiError> {
  let detail: unknown;

  // Attempt to parse JSON body for richer error info
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      detail = body.detail ?? body.message ?? body;
    }
  } catch {
    // Body is not JSON — fall through
  }

  return {
    message: (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>)
      ? String((detail as Record<string, unknown>).message)
      : response.statusText) || `Request failed with status ${response.status}`,
    status: response.status,
    detail,
  };
}

/**
 * Create a typed API client bound to an optional base URL.
 *
 * Each method (get / post / patch / delete) accepts a path
 * relative to the base and an optional `RequestInit` for
 * headers, AbortSignal, caching, etc.
 *
 * If the response is not OK the client throws `ApiError`.
 *
 * @param baseUrl  Origin + prefix, e.g. `'https://azentio.ai/api'`.
 *                 Defaults to `''` (same-origin, relative paths).
 */
export function createApiClient(baseUrl = ''): ApiClient {
  const base = baseUrl.replace(/\/+$/, ''); // strip trailing slashes

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${base}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    };

    const config: RequestInit = {
      ...init,
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      throw await handleApiError(response);
    }

    // Handle 204 No Content (DELETE often returns nothing)
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    get<T>(path: string, init?: RequestInit) {
      return request<T>('GET', path, undefined, init);
    },
    post<T>(path: string, body?: unknown, init?: RequestInit) {
      return request<T>('POST', path, body, init);
    },
    patch<T>(path: string, body?: unknown, init?: RequestInit) {
      return request<T>('PATCH', path, body, init);
    },
    delete<T>(path: string, init?: RequestInit) {
      return request<T>('DELETE', path, undefined, init);
    },
  };
}