import 'server-only';

import type { Contribution, ContributionVersion } from '@/app/(common-lib)/types';
import type { ContributionCreateInput } from '@/app/(common-lib)/types/schemas';
// M1: import { query, transaction } from '@/app/api/(db)/client';

/**
 * Server-only contribution service.
 *
 * Every mutation flows through this module so authorisation, validation,
 * consent capture, and audit logging stay centralised.  Route handlers and
 * Server Actions call these functions — never write raw SQL against the
 * contributions tables from elsewhere.
 *
 * ## Transaction boundaries
 * `createDraft` writes the contribution row, the initial version, and the
 * consent records inside a single database transaction.  If any step fails the
 * entire draft is rolled back.
 */

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new contribution in `private_draft` state, together with its first
 * version and the four independent consent records (store/process, publish
 * reviewed, attribute, model training).
 *
 * M1 will implement the full transaction body.
 *
 * @param input  - Validated contribution form payload.
 * @param authorId - UUID of the authenticated user creating the draft.
 * @param orgId  - UUID of the active workspace organisation.
 * @returns The newly created Contribution row.
 */
export async function createDraft(
  _input: ContributionCreateInput,
  _authorId: string,
  _orgId: string,
): Promise<Contribution> {
  // ── Placeholder — M1 will: ──────────────────────────────────────────────
  // 1. BEGIN transaction
  // 2. INSERT INTO contributions (author_user_id, org_id, visibility, state,
  //    visibility_epoch, ...) VALUES (...) RETURNING *
  // 3. INSERT INTO contribution_versions (contribution_id, version,
  //    source_payload, created_by, ...) VALUES (..., 1, ...) RETURNING *
  // 4. INSERT INTO consents (user_id, contribution_id, version, purpose,
  //    choice, policy_version, ...) × 4
  // 5. COMMIT → return contribution with current_version_id set
  //
  // Example stub:
  // return transaction(async (tx) => {
  //   const [contribution] = await tx<Contribution>(
  //     `INSERT INTO contributions (...) VALUES (...) RETURNING *`,
  //     [...],
  //   );
  //   const [version] = await tx<ContributionVersion>(
  //     `INSERT INTO contribution_versions (...) VALUES (...) RETURNING *`,
  //     [contribution.id, ...],
  //   );
  //   // Update current_version_id
  //   await tx(`UPDATE contributions SET current_version_id = $1 WHERE id = $2`, [
  //     version.id,
  //     contribution.id,
  //   ]);
  //   // Insert consent records...
  //   return { ...contribution, current_version_id: version.id };
  // });

  throw new Error('Not implemented — pending M1 contribution service wiring');
}

// ─── Future exports (M2+) ───────────────────────────────────────────────────
//
// export async function updateDraft(...): Promise<ContributionVersion> { ... }
// export async function submitForReview(...): Promise<Contribution> { ... }
// export async function withdraw(...): Promise<Contribution> { ... }
// export async function getVisibleContributions(orgId: string, userId: string): Promise<Contribution[]> { ... }