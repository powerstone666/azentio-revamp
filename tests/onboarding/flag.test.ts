import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';

const original = process.env.DEMO_ONBOARDING;

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.DEMO_ONBOARDING;
  else process.env.DEMO_ONBOARDING = value;
}

describe('isDemoOnboardingEnabled', () => {
  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_ONBOARDING;
    else process.env.DEMO_ONBOARDING = original;
  });

  it.each<[string | undefined, boolean]>([
    ['true', true],
    ['false', false],
    ['TRUE', false],
    ['True', false],
    ['1', false],
    ['yes', false],
    ['', false],
    [' true', false],
    ['true ', false],
    [undefined, false],
  ])('treats DEMO_ONBOARDING=%p as enabled=%p', (value, expected) => {
    setFlag(value);
    expect(isDemoOnboardingEnabled()).toBe(expected);
  });
});
