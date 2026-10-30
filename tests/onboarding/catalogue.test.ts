import {
  SELF_SERVICE_ONBOARDING_ROLE_IDS,
  SELF_SERVICE_ONBOARDING_ROLES,
} from '@/app/(config)/onboarding';

const EXPECTED_ROLES = [
  'client_member', 'client_admin', 'employee', 'learning_moderator', 'product_owner', 'content_publisher',
];

describe('onboarding role catalogue', () => {
  it('offers exactly the six self-serve roles', () => {
    expect([...SELF_SERVICE_ONBOARDING_ROLE_IDS].sort()).toEqual([...EXPECTED_ROLES].sort());
  });

  it('never offers portal_admin for self-serve onboarding', () => {
    expect(SELF_SERVICE_ONBOARDING_ROLE_IDS).not.toContain('portal_admin');
    expect(SELF_SERVICE_ONBOARDING_ROLES.map((role) => role.id)).not.toContain('portal_admin');
  });

  it('lists a catalogue entry for every offered role id, in the same order', () => {
    expect(SELF_SERVICE_ONBOARDING_ROLES.map((role) => role.id)).toEqual([...SELF_SERVICE_ONBOARDING_ROLE_IDS]);
  });

  it.each(SELF_SERVICE_ONBOARDING_ROLES.map((role) => [role.id, role] as const))(
    'gives %s a label, pitch and at least one starter item',
    (_id, role) => {
      expect(role.label.trim().length).toBeGreaterThan(0);
      expect(role.pitch.trim().length).toBeGreaterThan(0);
      expect(role.starter.length).toBeGreaterThan(0);
      expect(role.starter.every((item) => item.trim().length > 0)).toBe(true);
    },
  );

  it.each([
    ['client_member', 'Client side', 'client'],
    ['client_admin', 'Client side', 'client'],
    ['employee', 'Azentio side', 'azentio'],
    ['learning_moderator', 'Azentio side', 'azentio'],
    ['product_owner', 'Azentio side', 'azentio'],
    ['content_publisher', 'Azentio side', 'azentio'],
  ] as const)('places %s in the %s group with orgType %s', (id, group, orgType) => {
    const role = SELF_SERVICE_ONBOARDING_ROLES.find((entry) => entry.id === id);
    expect(role).toBeDefined();
    expect(role?.group).toBe(group);
    expect(role?.orgType).toBe(orgType);
  });

  it('gives every client role orgType client and every staff role orgType azentio', () => {
    for (const role of SELF_SERVICE_ONBOARDING_ROLES) {
      expect(role.orgType).toBe(role.group === 'Client side' ? 'client' : 'azentio');
    }
  });
});
