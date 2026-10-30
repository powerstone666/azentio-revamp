import { createApiClient, handleApiError } from '@/app/(ui)/lib/api-client';
import { getIcon } from '@/app/(ui)/lib/icons';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });
}

describe('handleApiError', () => {
  it('uses the message from a JSON detail object as the error message', async () => {
    const error = await handleApiError(jsonResponse({ detail: { message: 'Invitation expired' } }, { status: 409, statusText: 'Conflict' }));
    expect(error).toEqual({ message: 'Invitation expired', status: 409, detail: { message: 'Invitation expired' } });
  });

  it('falls back to the status text when the JSON body has no message', async () => {
    const error = await handleApiError(jsonResponse({ error: 'nope' }, { status: 422, statusText: 'Unprocessable Entity' }));
    expect(error.status).toBe(422);
    expect(error.message).toBe('Unprocessable Entity');
    expect(error.detail).toEqual({ error: 'nope' });
  });

  it('uses the status text for a non-JSON body and keeps no detail', async () => {
    const error = await handleApiError(new Response('<html>oops</html>', { status: 500, statusText: 'Server Error' }));
    expect(error).toEqual({ message: 'Server Error', status: 500, detail: undefined });
  });

  it('falls back to a generic message when there is no status text', async () => {
    const error = await handleApiError(new Response('', { status: 503, statusText: '' }));
    expect(error.message).toBe('Request failed with status 503');
  });
});

describe('createApiClient', () => {
  it.each([
    ['get', 'GET'],
    ['delete', 'DELETE'],
  ] as const)('%s sends a %s request without a body', async (method, verb) => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await createApiClient('/api')[method]('/ideas');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ideas');
    expect(init.method).toBe(verb);
    expect(init.body).toBeUndefined();
  });

  it.each([
    ['post', 'POST'],
    ['patch', 'PATCH'],
  ] as const)('%s serialises the body as JSON with the default headers', async (method, verb) => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ id: '1' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await createApiClient('https://azentio.ai/api/')[method]('/ideas', { title: 'Seasonality' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://azentio.ai/api/ideas');
    expect(init.method).toBe(verb);
    expect(init.body).toBe(JSON.stringify({ title: 'Seasonality' }));
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(result).toEqual({ id: '1' });
  });

  it('lets caller-supplied headers override the defaults', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;
    await createApiClient().get('/x', { headers: { Accept: 'text/plain' } });
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('text/plain');
  });

  it('returns undefined for a 204 No Content response', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 })) as unknown as typeof fetch;
    await expect(createApiClient('/api').delete('/ideas/1')).resolves.toBeUndefined();
  });

  it('rejects with a typed ApiError when the response is not OK', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ detail: { message: 'Forbidden here' } }, { status: 403, statusText: 'Forbidden' })) as unknown as typeof fetch;
    await expect(createApiClient('/api').patch('/ideas/1', {})).rejects.toMatchObject({ message: 'Forbidden here', status: 403 });
  });
});

describe('getIcon', () => {
  it('renders a known icon with the requested size and weight', () => {
    const element = getIcon('Star', { size: 20, weight: 'duotone', className: 'accent', alt: 'Starred' }) as { props: Record<string, unknown> };
    expect(element.props.size).toBe(20);
    expect(element.props.weight).toBe('duotone');
    expect(element.props.className).toBe('accent');
    expect(element.props['aria-label']).toBe('Starred');
  });

  it('defaults to 24px regular weight', () => {
    const element = getIcon('Lock') as { props: Record<string, unknown> };
    expect(element.props.size).toBe(24);
    expect(element.props.weight).toBe('regular');
  });

  it('falls back to the Question icon for an unknown name', () => {
    expect((getIcon('NotAnIcon') as { type: unknown }).type).toBe((getIcon('Question') as { type: unknown }).type);
    expect((getIcon('NotAnIcon') as { type: unknown }).type).not.toBe((getIcon('Star') as { type: unknown }).type);
  });
});
