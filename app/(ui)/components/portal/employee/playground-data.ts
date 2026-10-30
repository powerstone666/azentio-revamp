// Synthetic inputs and fixed simulated outputs for the employee Playground.
// Everything here is invented. Outputs are fixed text (no randomness) and are never decisions.

export type OfferingId = 'fai' | 'lending' | 'amlock';

export const OFFERINGS: { id: OfferingId; name: string; blurb: string }[] = [
  { id: 'fai', name: 'Financial Analysis Intelligence', blurb: 'Compare synthetic borrower statements across quarters.' },
  { id: 'lending', name: 'Lending', blurb: 'Review synthetic loan applications before any decision.' },
  { id: 'amlock', name: 'AMLOCK transaction monitoring', blurb: 'Triage synthetic alerts into a review queue.' },
];

export interface Scenario {
  inputsCaption: string;
  columns: string[];
  rows: string[][];
  output: string[];
  evidence: string[];
}

export const SCENARIOS: Record<OfferingId, Scenario> = {
  fai: {
    inputsCaption: 'Synthetic borrower SYN-FAI-01, a made-up trading business. Revenue is an index, not currency.',
    columns: ['Field', 'Synthetic value', 'Note'],
    rows: [
      ['Borrower', 'SYN-FAI-01', 'Not a real company'],
      ['Sector', 'Seasonal retail (synthetic)', 'Income peaks in Q2'],
      ['Revenue Q1 (index)', '1.00', ''],
      ['Revenue Q2 (index)', '1.10', ''],
      ['Revenue Q3 (index)', '0.42', 'Seasonal dip, synthetic'],
      ['Revenue Q4 (index)', '1.02', ''],
      ['Prior-year Q3 (index)', '0.45', 'Same seasonal pattern'],
    ],
    output: [
      'Simulated output for borrower SYN-FAI-01.',
      'A plain quarter-on-quarter comparison shows revenue falling about 62% between Q2 and Q3.',
      'The prior-year Q3 shows the same dip, so the simulated commentary describes a likely seasonal pattern and asks an analyst to review it before drawing any conclusion.',
      'No rating, limit or credit decision is produced.',
    ],
    evidence: ['Synthetic financial statements, three years', 'Seasonal comparison note (synthetic)', 'Analyst review checklist'],
  },
  lending: {
    inputsCaption: 'Three synthetic loan applications. No real customer data is used.',
    columns: ['Application', 'Segment (synthetic)', 'Requested', 'Term', 'Collateral note'],
    rows: [
      ['SYN-L-101', 'Salaried employee', '12,000', '24 months', ''],
      ['SYN-L-102', 'SME trading', '85,000', '36 months', 'Receivables listed'],
      ['SYN-L-103', 'Farm cooperative', '40,000', '12 months', 'Harvest schedule attached'],
    ],
    output: [
      'Simulated output for three synthetic applications.',
      'SYN-L-101 has a short term and a low request, so the simulated note records no open question.',
      'SYN-L-102 needs a receivables check before any decision can be considered.',
      'SYN-L-103 would benefit from a repayment calendar that follows the harvest.',
      'No approval, rate or decision is produced.',
    ],
    evidence: ['Synthetic application file summary', 'Policy extract (synthetic)', 'Repayment calendar sample'],
  },
  amlock: {
    inputsCaption: 'Three synthetic alerts. No real accounts or transactions are used.',
    columns: ['Alert', 'Rule (synthetic)', 'Amount', 'Segment (synthetic)', 'Status'],
    rows: [
      ['SYN-A-201', 'Rapid movement of funds', '9,400', 'Retail', 'Open'],
      ['SYN-A-202', 'Structuring pattern', '4,900 (three times)', 'SME', 'Open'],
      ['SYN-A-203', 'Unusual counterparty', '22,000', 'Corporate', 'Reviewed'],
    ],
    output: [
      'Simulated triage queue for three synthetic alerts.',
      'SYN-A-202 ranks first because the same pattern repeats three times in one day.',
      'SYN-A-201 ranks second.',
      'SYN-A-203 is already marked reviewed and is shown for context only.',
      'No alert is closed or reported by this demonstration.',
    ],
    evidence: ['Synthetic alert log extract', 'Rule description (synthetic)', 'Triage queue snapshot'],
  },
};

export const RATINGS = ['Useful', 'Needs more evidence', 'Not clear'] as const;
