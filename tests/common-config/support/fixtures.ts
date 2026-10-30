// Shared valid payloads for the common-config tests. Test-only; never imported by app code.

export const UUID_A = '6f1c2b1e-8d2a-4c1e-9b7a-1f2e3d4c5b6a';
export const UUID_B = '7a2d3c2f-9e3b-4d2f-8c8b-2a3f4e5d6c7b';
export const UUID_C = '8b3e4d3a-0f4c-4e3a-9d9c-3b4a5f6e7d8c';

export const validContribution = {
  title: 'Seasonal SME revenue flagged as deterioration',
  observation_type: 'market_observation',
  evidence_type: 'quantitative',
  confidence: 'medium',
  body: 'Borrowers in seasonal retail show sharp dips that automated checks flag.',
  visibility: 'community_proposed',
  consent_store_process: true,
  consent_publish_reviewed: true,
  consent_attribute: false,
  consent_model_training: false,
} as const;

export const validRedactedPayload = {
  title: 'Seasonal revenue flagged as deterioration',
  observation_type: 'market_observation',
  evidence_type: 'quantitative',
  confidence: 'medium',
  body: 'A regional lender saw seasonal borrowers flagged as deteriorating.',
} as const;

export const validIdea = {
  title: 'Seasonality-aware comparison explanation',
  problem_statement: 'Automated comparisons read seasonal dips as deterioration.',
  offering: 'FAI',
  proposed_outcome: 'Analysts see a seasonality note beside each flag.',
  priority: 'high',
  audience: 'clients',
  supporting_contribution_ids: [UUID_A],
} as const;
