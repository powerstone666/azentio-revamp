import { detectPotentialSensitiveContent, detectReviewRisks } from '@/app/api/(services)/moderation/service';

const risks = (body: string) => detectReviewRisks({ body });

describe('detectReviewRisks (moderator review prompts)', () => {
  it.each([
    ['a currency amount', 'The bank paid $250,000 for the licence.'],
    ['an amount with an ISO code', 'Annual fee of 40000 EUR was waived.'],
    ['pricing wording followed by a number', 'Their pricing was cut by 18 percent after the review.'],
  ])('flags confidential pricing: %s', (_label, text) => {
    expect(risks(text)).toContain('Possible confidential pricing or financial figure');
  });

  it.each([
    'The incident was on 2026-03-14 at the branch.',
    'It happened on 14/03/2026.',
    'On 14 March 2026 the batch failed.',
    'On March 14, 2026 the batch failed.',
  ])('flags an exact date: %s', (text) => {
    expect(risks(text)).toContain('Exact date; generalise to a month or period');
  });

  it('does not flag a month or period', () => {
    expect(risks('Seasonal dips appear every March and again in Q3 2026.')).toEqual([]);
  });

  it('flags a street-level location but not a region', () => {
    expect(risks('The pilot ran at 12 Marine Drive in the city.')).toContain('Street-level location; generalise to a region');
    expect(risks('The pilot ran across the APAC region.')).toEqual([]);
  });

  it.each([
    'We are the only bank in the region using this module.',
    'Our largest customer reported the problem.',
    'It is one of only two lenders affected.',
  ])('flags wording that points at one organisation: %s', (text) => {
    expect(risks(text).join(' ')).toContain('rare or identifying');
  });

  it('keeps everything the narrower check finds', () => {
    const payload = { body: 'Reach me at jane.customer@client.example' };
    expect(detectReviewRisks(payload)).toEqual(expect.arrayContaining(detectPotentialSensitiveContent(payload)));
  });

  it('scans arrays and nested values', () => {
    expect(detectReviewRisks({ notes: [{ text: 'Paid £90,000 last year' }] })).toContain('Possible confidential pricing or financial figure');
  });

  it('leaves ordinary observations alone', () => {
    expect(risks('Seasonal SME revenue is flagged as deterioration when only the previous quarter is compared.')).toEqual([]);
  });

  it('leaves AIRA questions about dates and money to the narrower guard (it never blocks them)', () => {
    expect(detectPotentialSensitiveContent({ message: 'What is on the agenda for 31 October 2026?' })).toEqual([]);
  });
});
