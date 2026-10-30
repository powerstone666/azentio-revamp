/**
 * Shared helpers for the UI tests. Deliberately not named *.test.* so Jest never runs it directly.
 */

/** Minimal Response-like object for a mocked fetch. */
export function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  return {
    ok,
    status: init.status ?? (ok ? 200 : 400),
    json: async () => body,
  } as unknown as Response;
}

/** Installs a jest.fn as global fetch. Call restore() in afterEach. */
export function installFetch() {
  const fetchMock = jest.fn();
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/**
 * jsdom makes window.location non-configurable and does not implement page navigation, so a navigation
 * cannot be stubbed or its target read. jsdom reports the attempt as "Not implemented: navigation", which
 * is captured here. This proves a navigation was started (or not) but not where it went.
 */
export function watchNavigation() {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  return {
    attempted: () =>
      consoleError.mock.calls.some(([first]) =>
        String((first as Error | undefined)?.message ?? first).includes('Not implemented: navigation'),
      ),
    restore: () => consoleError.mockRestore(),
  };
}

/** Reads the JSON body of the nth (0-based) fetch call. */
export function bodyOf(fetchMock: jest.Mock, index = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? 'null'));
}

/** Returns a promise plus its resolver, for holding a request in flight. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
