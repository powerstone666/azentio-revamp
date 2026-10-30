// Demo roles only grant access inside the shared synthetic sandbox workspaces.
export const SELF_SERVICE_ONBOARDING_ROLE_IDS = [
  'client_member', 'client_admin', 'employee', 'learning_moderator', 'product_owner', 'content_publisher',
] as const;
export type SelfServiceOnboardingRole = (typeof SELF_SERVICE_ONBOARDING_ROLE_IDS)[number];

export interface OnboardingRoleInfo {
  id: SelfServiceOnboardingRole;
  label: string;
  group: 'Client side' | 'Azentio side';
  pitch: string;
  starter: string[];
  orgType: 'client' | 'azentio';
}

export const SELF_SERVICE_ONBOARDING_ROLES: OnboardingRoleInfo[] = [
  {
    id: 'client_member',
    label: 'Client member',
    group: 'Client side',
    orgType: 'client',
    pitch: 'Work like a bank or lender using azentio.ai: record market observations, choose what to share, and try entitled AI demos.',
    starter: ['Three observations in different review states', 'Entitled demos (FAI, Lending, AMLOCK)', 'A welcome notification'],
  },
  {
    id: 'client_admin',
    label: 'Client administrator',
    group: 'Client side',
    orgType: 'client',
    pitch: 'Everything a client member does, plus managing your organisation’s team and roles.',
    starter: ['Observations and demos', 'A team with one synthetic colleague', 'Entitlements to manage'],
  },
  {
    id: 'employee',
    label: 'Azentio employee',
    group: 'Azentio side',
    orgType: 'azentio',
    pitch: 'Explore the internal demo workspace with synthetic scenarios, employee knowledge and shared demo sessions.',
    starter: ['Synthetic sandbox scenarios', 'Internal demo knowledge', 'Shared employee demo sessions'],
  },
  {
    id: 'learning_moderator',
    label: 'Learning moderator',
    group: 'Azentio side',
    orgType: 'azentio',
    pitch: 'Review synthetic demo observations, redact them, ask for clarification, then publish or reject.',
    starter: ['Synthetic submissions in the demo queue', 'Review and consent controls'],
  },
  {
    id: 'product_owner',
    label: 'Product owner',
    group: 'Azentio side',
    orgType: 'azentio',
    pitch: 'Explore approved themes and improvement ideas using demo evidence.',
    starter: ['Assigned demo offerings', 'Demo themes and ideas'],
  },
  {
    id: 'content_publisher',
    label: 'Content publisher',
    group: 'Azentio side',
    orgType: 'azentio',
    pitch: 'Manage demo sessions and audience controls in the shared sandbox.',
    starter: ['Shared demo sessions', 'Sandbox audience controls'],
  },
];
