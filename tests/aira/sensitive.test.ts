import { detectPotentialSensitiveContent } from '@/app/api/(services)/moderation/service';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  default: {},
}));

const EMAIL = 'Possible email address';
const CARD = 'Possible payment or account number';
const IBAN = 'Possible IBAN';
const CREDENTIAL = 'Possible credential';
const PHONE = 'Possible customer or phone identifier';

function flagsFor(text: string): string[] {
  return detectPotentialSensitiveContent({ message: text });
}

describe('detectPotentialSensitiveContent flags personal identifiers and secrets', () => {
  it.each([
    ['an email address', 'Please send the report to jane.doe@example.com today', EMAIL],
    ['an email with uppercase letters', 'Reach JANE.DOE@EXAMPLE.CO.UK for access', EMAIL],
    ['a card number with spaces', 'My card is 4111 1111 1111 1111', CARD],
    ['a card number without spaces', 'card 4111111111111111 expired', CARD],
    ['a card number with dashes', 'card 5500-0000-0000-0004', CARD],
    ['an IBAN with spaces', 'Pay to GB29 NWBK 6016 1331 9268 19 please', IBAN],
    ['an IBAN without spaces', 'IBAN DE89370400440532013000 is ours', IBAN],
    ['a password assignment', 'password: hunter2', CREDENTIAL],
    ['an API key assignment', 'use api_key=sk_live_abc123 for the call', CREDENTIAL],
    ['an API key with a space separator', 'api key = abcdef123456', CREDENTIAL],
    ['a secret assignment', 'secret: topsecretvalue', CREDENTIAL],
    ['a customer account number', 'customer number: 0012345678', PHONE],
    ['a phone number', 'phone: +44 20 7946 0958', PHONE],
    ['a mobile number', 'mobile no. +971 50 123 4567', PHONE],
  ])('flags %s', (_label, text, expectedFlag) => {
    expect(flagsFor(text)).toContain(expectedFlag);
  });
});

describe('detectPotentialSensitiveContent leaves ordinary business text alone', () => {
  it.each([
    ['a product description', 'Azentio helps banks modernize core banking with iMAL in 2026.'],
    ['a feature summary with small numbers', 'We support 24/7 operations across 12 countries and 3 regions.'],
    ['a compliance sentence that mentions customers', 'Our AMLOCK suite screens customers against OFAC and UN lists.'],
    ['a version string', 'Version 2.5.1 released in October 2026 for Orion ERP'],
    ['a call to action', 'Request a demo for our fraud detection solution.'],
    ['a policy sentence that mentions a password without a value', 'The password policy requires rotation every quarter.'],
    ['a sentence with the word secrets', 'Secrets of successful digital transformation'],
    ['a date', 'Date: 2026-10-31 for the steering review'],
    ['a short greeting', 'Hi, can you tell me about AMLOCK?'],
  ])('returns no flags for %s', (_label, text) => {
    expect(flagsFor(text)).toEqual([]);
  });
});

describe('detectPotentialSensitiveContent return shape', () => {
  it('returns an empty array for a clean payload', () => {
    expect(detectPotentialSensitiveContent({ title: 'Hello', body: 'Plain text.' })).toEqual([]);
  });

  it('returns a string array with one label per sensitive category present', () => {
    const flags = detectPotentialSensitiveContent({
      message: 'Email jane@example.com and password: hunter2',
    });
    expect(flags).toEqual(expect.arrayContaining([EMAIL, CREDENTIAL]));
    expect(flags.every((flag) => typeof flag === 'string')).toBe(true);
  });

  it('scans every string value in the payload, not only the first key', () => {
    expect(detectPotentialSensitiveContent({ title: 'Ok', note: 'contact jane@example.com' })).toEqual([EMAIL]);
  });

  it('returns an empty array for an empty payload', () => {
    expect(detectPotentialSensitiveContent({})).toEqual([]);
  });

  // The function only reads string values (typeof value === 'string'), so strings nested in an array are
  // skipped. The AIRA privacy guard passes history as an array of strings, so a card number or email in
  // a prior turn is never checked before the message reaches the external provider.
  it('flags sensitive text nested inside an array value', () => {
    expect(detectPotentialSensitiveContent({ message: 'hi', history: ['my card is 4111 1111 1111 1111'] }))
      .toContain(CARD);
  });
});
