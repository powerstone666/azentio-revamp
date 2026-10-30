/**
 * Typed domain errors for authorization and access control.
 * Used across client and server to represent real security boundaries.
 */

export type AccessDeniedReason =
  | 'UNPROVISIONED_AZENTIO_EMAIL'
  | 'REVOKED_MEMBERSHIP'
  | 'UNINVITED_DOMAIN'
  | 'NO_APPROVED_MEMBERSHIP'
  | 'INSUFFICIENT_PERMISSIONS';

export interface AccessDeniedErrorDetails {
  readonly email: string;
  readonly code: AccessDeniedReason;
  readonly status: 403;
  readonly personaName?: string;
  readonly role?: string;
  readonly summary: string;
  readonly timestamp: string;
}

/**
 * Base 403 Forbidden AccessDeniedError class.
 * Represents a failure of server-side IAM or tenant access checks.
 */
export class AccessDeniedError extends Error {
  readonly code: AccessDeniedReason;
  readonly status = 403 as const;
  readonly email: string;
  readonly personaName?: string;
  readonly role?: string;
  readonly summary: string;
  readonly timestamp: string;

  constructor(
    message: string,
    details: {
      email: string;
      code?: AccessDeniedReason;
      personaName?: string;
      role?: string;
      summary?: string;
    }
  ) {
    super(message);
    this.name = 'AccessDeniedError';
    this.email = details.email;
    this.code = details.code ?? 'NO_APPROVED_MEMBERSHIP';
    this.personaName = details.personaName;
    this.role = details.role;
    this.summary = details.summary ?? message;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, AccessDeniedError.prototype);
  }

  toJSON(): AccessDeniedErrorDetails {
    return {
      email: this.email,
      code: this.code,
      status: this.status,
      personaName: this.personaName,
      role: this.role,
      summary: this.summary,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Thrown when a user authenticates with a verified @azentio.com email
 * but has not been granted an approved employee membership.
 * (source.md §03 / §04: email suffix alone is never proof of access).
 */
export class UnprovisionedAccountError extends AccessDeniedError {
  constructor(email: string, personaName?: string) {
    super(
      `UnprovisionedAccountError: 403 Forbidden — Verified @azentio.com email (${email}) is not provisioned with an approved membership. Real sign-in denies the portal.`,
      {
        email,
        code: 'UNPROVISIONED_AZENTIO_EMAIL',
        personaName,
        role: 'Unprovisioned @azentio.com',
        summary: 'Verified @azentio.com email but not provisioned. Real sign-in denies the portal.',
      }
    );
    this.name = 'UnprovisionedAccountError';
    Object.setPrototypeOf(this, UnprovisionedAccountError.prototype);
  }
}

/**
 * Thrown when a user whose membership has been revoked attempts to sign in.
 */
export class RevokedMembershipError extends AccessDeniedError {
  constructor(email: string, personaName?: string) {
    super(
      `RevokedMembershipError: 403 Forbidden — Membership has been revoked for ${email}. Sign-in is denied.`,
      {
        email,
        code: 'REVOKED_MEMBERSHIP',
        personaName,
        role: 'Revoked member',
        summary: 'Revoked member. Real sign-in denies access.',
      }
    );
    this.name = 'RevokedMembershipError';
    Object.setPrototypeOf(this, RevokedMembershipError.prototype);
  }
}

/**
 * Thrown when an external email domain matches a tenant's domain
 * but the user was never invited or approved by an administrator.
 */
export class UninvitedDomainError extends AccessDeniedError {
  constructor(email: string, personaName?: string) {
    super(
      `UninvitedDomainError: 403 Forbidden — Domain matches client tenant, but account (${email}) has no valid invitation or membership grant.`,
      {
        email,
        code: 'UNINVITED_DOMAIN',
        personaName,
        role: 'Matching email suffix',
        summary: 'Same email domain as tenant but no invitation. Real sign-in denies access.',
      }
    );
    this.name = 'UninvitedDomainError';
    Object.setPrototypeOf(this, UninvitedDomainError.prototype);
  }
}

