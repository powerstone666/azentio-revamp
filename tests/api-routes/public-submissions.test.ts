/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/public-submissions/service', () => ({ createPublicSubmission: jest.fn() }));

import { createPublicSubmission } from '@/app/api/(services)/public-submissions/service';
import { POST } from '@/app/api/v1/public-submissions/route';
import { makeRequest, readJson, expectNoInternals } from './fixtures';

const createMock = jest.mocked(createPublicSubmission);

const demo = {
  type: 'demo_enquiry',
  first: 'Ada',
  last: 'Lovelace',
  email: 'ada@example.com',
  company: 'Analytical Bank',
  country: 'Singapore',
  enquiry: 'Request a demo',
  consent: true,
};

const hackathon = {
  type: 'hackathon_registration',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  org: 'Navy Labs',
  role: 'Engineer',
  team: 'Solo',
  skills: ['Engineering'],
  consent: true,
};

const submit = (init: Parameters<typeof makeRequest>[1]) => POST(makeRequest('/api/v1/public-submissions', init));

beforeEach(() => {
  createMock.mockResolvedValue({ accepted: true, id: 'sub-1', email_outbox_id: null } as never);
});

describe('POST /api/v1/public-submissions transport checks', () => {
  it('rejects a non-JSON content type with 415 and does not read the body', async () => {
    const response = await submit({ rawBody: JSON.stringify(demo), headers: { 'content-type': 'text/plain' } });
    expect(response.status).toBe(415);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a declared body over 16 KiB with 413 before parsing', async () => {
    const response = await submit({ rawBody: '{}', headers: { 'content-type': 'application/json', 'content-length': '20000' } });
    expect(response.status).toBe(413);
    expect(await readJson(response)).toEqual({ error: 'Request is too large' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('caps a streamed body that has no content-length header at 16 KiB', async () => {
    const chunk = new TextEncoder().encode(`{"type":"demo_enquiry","pad":"${'x'.repeat(4000)}"`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 6; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/v1/public-submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{"type": "demo_enquiry"'],
    ['an empty body', ''],
  ])('rejects %s with 400', async (_label, rawBody) => {
    const response = await submit({ rawBody, headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a JSON array', [demo]],
    ['a JSON null', null],
    ['an object with no type', { first: 'Ada' }],
  ])('rejects %s as an invalid submission with 422', async (_label, body) => {
    const response = await submit({ body });
    expect(response.status).toBe(422);
    expect(await readJson(response)).toEqual({ error: 'Invalid submission' });
  });

  it('rejects an unsupported submission type with 422', async () => {
    const response = await submit({ body: { type: 'newsletter', email: 'a@example.com' } });
    expect(response.status).toBe(422);
    expect(await readJson(response)).toEqual({ error: 'Unsupported submission type' });
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('demo enquiry validation', () => {
  it.each([
    ['a missing consent flag', { consent: undefined }],
    ['consent set to false', { consent: false }],
    ['consent given as the string "true"', { consent: 'true' }],
    ['an invalid email address', { email: 'ada-at-example' }],
    ['an email longer than 254 characters', { email: `${'a'.repeat(250)}@x.io` }],
    ['an enquiry type outside the allowed list', { enquiry: 'Careers' }],
    ['a blank company', { company: '   ' }],
    ['a first name longer than 100 characters', { first: 'f'.repeat(101) }],
    ['comments longer than 1000 characters', { comments: 'c'.repeat(1001) }],
  ])('rejects %s with 422 and does not store', async (_label, override) => {
    const response = await submit({ body: { ...demo, ...override } });
    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({ error: 'Please review the submitted fields' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('stores a valid enquiry with the company as organization and the full payload, and returns 201', async () => {
    const response = await submit({ body: { ...demo, first: '  Ada  ' } });
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ accepted: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(createMock).toHaveBeenCalledWith({
      type: 'demo_enquiry',
      email: 'ada@example.com',
      organization: 'Analytical Bank',
      payload: expect.objectContaining({ first: 'Ada', company: 'Analytical Bank', consent: true }),
      origin: 'http://localhost',
    });
  });
});

describe('hackathon registration validation', () => {
  it.each([
    ['an empty skills list', { skills: [] }],
    ['more than four skills', { skills: ['Data science', 'Engineering', 'Design', 'Domain expertise', 'Data science'] }],
    ['an unknown skill', { skills: ['Plumbing'] }],
    ['a team size outside the enum', { team: 'Pair' }],
    ['no consent', { consent: undefined }],
    ['an idea longer than 800 characters', { idea: 'i'.repeat(801) }],
  ])('rejects %s with 422', async (_label, override) => {
    const response = await submit({ body: { ...hackathon, ...override } });
    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('stores a valid registration with the org as organization and returns 201', async () => {
    const response = await submit({ body: { ...hackathon, idea: 'Explain loan decisions' } });
    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      type: 'hackathon_registration',
      email: 'grace@example.com',
      organization: 'Navy Labs',
      payload: expect.objectContaining({ name: 'Grace Hopper', idea: 'Explain loan decisions' }),
      origin: 'http://localhost',
    });
  });
});

describe('honeypot and storage failure', () => {
  it('accepts a honeypot submission with 202 but never stores it', async () => {
    const response = await submit({ body: { ...demo, website: 'http://spam.example' } });
    expect(response.status).toBe(202);
    expect(await readJson(response)).toEqual({ accepted: true });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns a 503 with a retry message and no internals when storage fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    createMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.1.2.3:5432'));
    const response = await submit({ body: demo });
    expect(response.status).toBe(503);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'We could not save your submission. Please try again shortly.' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });
});
