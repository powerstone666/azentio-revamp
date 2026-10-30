/** Self-serve demo onboarding is off unless explicitly enabled. */
export function isDemoOnboardingEnabled(): boolean {
  return process.env.DEMO_ONBOARDING === 'true';
}
