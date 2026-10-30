export interface SandboxDemo {
  id: string;
  name: string;
  blurb: string;
  scenarioKey: string;
  scenarioTitle: string;
  scenarioInput: Record<string, string | number | boolean>;
  scenarioOutput: { summary: string; evidence: string[]; limitation: string };
}

export const SANDBOX_DEMOS: SandboxDemo[] = [
  {
    id: 'FAI',
    name: 'Financial Analysis Intelligence',
    blurb: 'Explore an explicitly synthetic SME cash-flow scenario and review the supporting signals.',
    scenarioKey: 'synthetic-seasonality',
    scenarioTitle: 'Synthetic seasonal cash-flow cohort',
    scenarioInput: { dataset: 'synthetic', borrower_count: 240, periods: 8, seasonal_variation: true },
    scenarioOutput: {
      summary: 'The synthetic cohort shows recurring quarterly cash-flow variation. Review seasonal and non-seasonal periods before drawing conclusions.',
      evidence: ['Synthetic cohort only', 'Eight simulated reporting periods', 'No account or transaction records'],
      limitation: 'This is a deterministic illustration, not a credit assessment or product decision.',
    },
  },
  {
    id: 'Lending',
    name: 'Lending sandbox',
    blurb: 'Walk through a synthetic application with a transparent, simulated review outcome.',
    scenarioKey: 'synthetic-application-review',
    scenarioTitle: 'Synthetic SME application review',
    scenarioInput: { dataset: 'synthetic', applicant_type: 'SME', evidence_items: 5, exceptions: 1 },
    scenarioOutput: {
      summary: 'The example is routed to manual review because one supplied evidence item conflicts with the synthetic application summary.',
      evidence: ['One simulated evidence mismatch', 'No real applicant data', 'No external bureau data'],
      limitation: 'This is a workflow demonstration, not a lending recommendation.',
    },
  },
  {
    id: 'AMLOCK',
    name: 'AMLOCK transaction monitoring',
    blurb: 'Inspect a synthetic alert and see a deterministic triage explanation.',
    scenarioKey: 'synthetic-alert-triage',
    scenarioTitle: 'Synthetic alert triage',
    scenarioInput: { dataset: 'synthetic', alerts: 12, priority_candidates: 2, typology: 'illustrative' },
    scenarioOutput: {
      summary: 'Two illustrative alerts are placed at the top of a human review queue based on the synthetic scenario settings.',
      evidence: ['Synthetic alert set', 'Illustrative typology only', 'No watchlist or customer data'],
      limitation: 'The output is a triage illustration, not a finding of suspicious activity.',
    },
  },
  {
    id: 'Insurance',
    name: 'Claims automation briefing',
    blurb: 'Review a synthetic claim-routing example and its evidence trail.',
    scenarioKey: 'synthetic-claim-routing',
    scenarioTitle: 'Synthetic claim routing',
    scenarioInput: { dataset: 'synthetic', claim_type: 'property', evidence_items: 4, exception: true },
    scenarioOutput: {
      summary: 'The illustrative claim is routed to specialist review because the synthetic record contains an exception.',
      evidence: ['Synthetic claim record', 'Four simulated evidence items', 'No policyholder information'],
      limitation: 'This is a workflow demonstration, not a coverage or claims decision.',
    },
  },
];

export const getSandboxDemo = (offeringId: string) => SANDBOX_DEMOS.find((demo) => demo.id === offeringId) ?? null;
