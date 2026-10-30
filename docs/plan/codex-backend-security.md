# Backend & security plan

Plan only; no application code. Requirements source: `source.md` §§03–11. Next guidance checked against installed Next.js 16.4.3 docs: `01-app/01-getting-started/{15-route-handlers,16-proxy,08-caching}.md` and `01-app/02-guides/{authentication,server-actions,caching-without-cache-components}.md`.

## Recommended stack

| Concern | Recommendation | Notes |
|---|---|---|
| App runtime | Next.js 16.4.3 / React 19.3.0 (installed) | Use App Router. Next 16 uses root `proxy.ts`; Proxy is only an optimistic redirect/filter, never the authorization boundary. |
| Identity | Better Auth 1.x (pin a tested exact release) with magic-link or email OTP; Entra ID OIDC when app registration is available | Better fit than Auth.js for built-in organization invitations. Verify email; require invite acceptance by the same verified email, single-use expiry, and server-side approved membership. `@azentio.com` suffix is a gate, not proof of employee status; provision employees explicitly. Auth.js remains viable if Entra OIDC is chosen, but invitations/RBAC need more application-owned code. [Better Auth magic link](https://better-auth.com/docs/plugins/magic-link) · [organization invitations](https://better-auth.com/docs/plugins/organization). |
| Data | PostgreSQL 18.6 + Drizzle ORM 0.44.x; use Postgres in demo too | Relational constraints, transactions and row-level defense-in-depth suit tenancy, consent and audit. SQLite is acceptable only for an isolated disposable demo; it diverges on concurrency, policy and search behavior. |
| Search | PostgreSQL FTS + `pgvector` only if semantic retrieval is needed | Index approved shared-copy IDs/text only. Keep tenant-private records out of community retrieval. Any external vector/search service must support synchronous ID deletion and retrieval-time authorization. |
| Validation / mail | Zod 4.x; transactional email provider behind an adapter | Persist delivery intent in an outbox; P0 in-app notifications, email P1. Pin exact versions in lockfile after compatibility check. |

## Data model

Use UUID primary keys, UTC timestamps, foreign keys, and append-only history for consent, moderation, and audit. Scope tenant-owned rows with `org_id`; never accept it as authority from the client.

| Entity | Key fields / relationships |
|---|---|
| `users` | id, normalized_email (unique), verified_at, display_name, disabled_at; provider identities in `auth_accounts`, sessions/tokens in auth-owned tables. |
| `organizations` | id, name, type (`azentio`/`client`), status. `memberships`: org_id, user_id, status, joined_at; unique (org,user). |
| `role_grants` | id, org_id nullable (global only for platform grants), user_id or membership_id, permission/role, granted_by, expires_at, revoked_at. Separate grants for client admin, moderator, media publisher, content publisher, product owner, portal admin; no role implied by employee status. |
| `invitations` | org_id, email, proposed role (allowlisted), token_hash, expires_at, accepted_by/at, revoked_at, inviter. Single-use; accepting account email must match verified invite email. |
| `entitlements` | org_id, offering_id, feature, status, valid_from/to, granted_by. Check per resource/action. |
| `contributions` | id, author_user_id, org_id, visibility (`author`/`org`/`community_proposed`), current_version_id, state, withdrawn_at, created_at. Source fields and attachments stay private. |
| `contribution_versions` | contribution_id, version, source payload, created_by/at, parent_version_id; immutable once submitted. Material published edits create a new version and return to review. |
| `shared_copies` | id, contribution_id, source_version_id, reviewed payload, deidentified flag, attribution consent reference, status (`active`/`suspended`/`withdrawn`), published_at, invalidated_at. Never copy tenant IDs, private profile, attachment, hidden metadata, or reviewer notes into response/index documents. |
| `consents` | user_id, contribution_id, version, purpose enum: (a) store/process, (b) publish reviewed copy, (c) attribute author/org, (d) future model training/federated learning; choice, policy_version, granted/revoked_at, captured_at. Independent records; workspace membership is not consent. |
| `moderation_decisions` | contribution/version, moderator, action, reason code, redactions, timestamp; append-only. |
| `reports` | shared_copy_id, reporter_user_id, category, details, status, created_at; do not disclose reporter to reported author/tenant. |
| `themes` | id, title, offering, topic, period, status, safe_summary; `theme_evidence` links only active approved shared copies. |
| `improvement_ideas` | id, title, problem, offering, outcome, owner/team, priority, status, audience; `idea_evidence` links permitted evidence; append status history. |
| `notifications` / `outbox` | user/org recipient, event, safe payload, read/delivery status; outbox idempotency key, attempts, next_attempt_at, delivered_at. Do not claim queued = delivered. |
| `audit_log` | actor, action, target type/id, active org, request id, decision, timestamp, minimal metadata; immutable; never log raw contribution text or secrets. |

## Contribution lifecycle and transitions

Transition guard is enforced in the policy/service layer and recorded atomically with an audit event. State diagram omitted in source; the following explicit states fill that gap.

| From → To | Allowed actor / conditions |
|---|---|
| none → `private_draft` | Author with valid membership; initial visibility private. |
| `private_draft` → `submitted` | Author; storage/processing consent (a) active, proposed community sharing and publication consent (b) recorded; validate content. |
| `submitted` → `needs_clarification` / `rejected` / `approved` | Moderator; record decision; approved means a reviewed shared copy is created, and publication requires (b). |
| `needs_clarification` → `submitted` | Author edits/resubmits; create version and re-review. |
| `approved` → `published` | Moderator; publish de-identified reviewed copy; attribution only with (c) and explicit review. |
| `published` → `suspended` | Moderator on report/safety review; immediately deny retrieval and notify author. |
| `suspended` → `published` / `rejected` | Moderator decision with audit reason. |
| `published` → `private_draft` (new version) | Author requests material edit; old copy remains governed until replacement/withdrawal; new version requires full review. |
| Any author-owned state → `withdrawn` | Author; immediate invalidation; cannot be re-published without new explicit consent and review. Moderator may withdraw under documented safety authority. |

Client admins may manage own-organization invitations and allowlisted client roles only. They cannot moderate, publish, create global grants, or change another organization. Product owners manage idea status only against evidence they may access.

## One authorization boundary

Put the server-only policy/data access layer in `app/api/(services)/authz/` (session resolver, `authorize(action, resource, activeWorkspace)`, tenant-scoped repositories, DTO mappers). All Server Components that read protected data, every Server Action, every `app/api/**/route.ts`, and every signed media/download request call it before access. Every mutation also validates input, re-reads current membership/grants/entitlement, and writes an audit event in the same transaction. Deny by default: require authenticated subject, explicit resource audience, active non-revoked membership where applicable, permission for action, entitlement for offering, and resource-level policy. Resolve active workspace from a server-validated membership/session selection; reject forged tenant IDs. Global moderation access is an explicit grant plus case/support scope, not portal-admin by implication.

Next-specific: Route Handlers use Web Request/Response and live at `app/api/**/route.ts`; leave protected GETs dynamic/uncached. Server Actions are callable POST endpoints and must independently authenticate/authorize (and validate); do not rely on the calling UI. Next 16 `proxy.ts` may redirect optimistically but must not make data decisions. Avoid shared `use cache` for private data; UI cache revalidation is not an authorization or withdrawal mechanism. For media, keep objects private and serve only through a policy-checked handler or short-lived signed URL whose issuance re-checks policy; revoke by deleting object/version or deny at origin on each request.

## Withdrawal and retrieval invalidation (≤60 seconds)

Withdrawal transaction marks contribution and shared copies withdrawn, increments `visibility_epoch`, appends audit, and emits a durable invalidation/outbox event. Before acknowledging, a synchronous retrieval gate denies withdrawn IDs using the authoritative DB/tombstone (fail closed if unavailable). Search query filters active IDs from the DB; then purge FTS/vector documents and any result caches by copy ID. AIRA must re-check authorization/status immediately before context assembly and again before returning citations; no model prompt/result cache may outlive the visibility epoch. Propagation worker retries idempotently; alert if purge is not confirmed in 30s and page/stop shared retrieval at 60s. Keep protected search/AIRA responses uncached or keyed to short-lived epoch and never use stale-while-revalidate. Test measured end-to-end from withdrawal commit to absence in both search and AIRA within 60s. UI `revalidatePath`/tag invalidation is supplementary only. State production SLA and disclose that already viewed/third-party copies cannot be recalled.

## Aggregation safeguards

Use configurable `min_distinct_orgs = 3` for the judging build; count `COUNT(DISTINCT org_id)`, never posts/users. Suppress counts and summaries below threshold, sensitive dimensions, small geographic/time/topic cells, and overlapping filters that enable differencing; generalize periods/regions and rate-limit repeated queries. Only active approved shared copies count. Show sample-size caveat. Threshold alone is not anonymity; production thresholds and stronger privacy controls require approval.

## API surface

All endpoints are authenticated/authorized unless marked public; version under `/api/v1`. Apply the same policy to UI actions and any direct object/media path.

| Route handler | Methods / purpose |
|---|---|
| `app/api/v1/auth/[...all]/route.ts` | Better Auth handler; configured allowlisted login methods and rate limits. |
| `app/api/v1/workspaces/route.ts` | GET memberships; POST select active workspace. |
| `app/api/v1/invitations/route.ts` | POST invite (own org, client-admin grant); GET own pending; accept/revoke via `/[id]`. |
| `app/api/v1/contributions/route.ts` | GET visible feed; POST private draft. `app/api/v1/contributions/[id]/route.ts`: GET/PATCH own/org-authorized draft, DELETE/withdraw. |
| `app/api/v1/contributions/[id]/submit/route.ts` | POST submit/resubmit. `.../[id]/reports/route.ts`: POST report. |
| `app/api/v1/moderation/queue/route.ts` | GET scoped queue. `app/api/v1/moderation/contributions/[id]/decision/route.ts`: POST clarification/redact/reject/publish/suspend. |
| `app/api/v1/search/route.ts` | GET approved, audience-filtered search; same visibility for counts/suggestions. |
| `app/api/v1/themes/route.ts` | GET safe aggregate dashboard; no small cohorts. `.../[id]/route.ts`: GET permitted theme/evidence. |
| `app/api/v1/ideas/route.ts` | GET audience-filtered ideas; POST by product owner. `.../[id]/route.ts`: GET/PATCH status with audit. |
| `app/api/v1/notifications/route.ts` | GET own notifications; PATCH read state. |
| `app/api/v1/media/[id]/route.ts` | GET/HEAD private media after current policy check; omit uploads in P0 if not needed. |
| `app/api/v1/admin/organizations/route.ts` | GET/POST org administration; explicit portal-admin permission, audited. |

## Acceptance and security tests

| Test | Expected result |
|---|---|
| Tenant isolation: guess another org contribution/theme/idea IDs; mutate, search, counts, suggestions, export | No cross-tenant private data or existence leak; shared results only when active and approved. |
| Direct API, Server Action, and media URL access bypassing UI | Same authorization on every path; revoked membership/entitlement blocks immediately. |
| Client admin invites external arbitrary email, changes role, or targets other tenant | Invitation stays untrusted until verified matching acceptance; only allowlisted own-org roles accepted; escalation denied/audited. |
| Employee suffix without provisioned membership; client self-grants employee/moderator/publisher | Denied. Portal admin without explicit support scope cannot read private drafts. |
| Save draft, consent combinations, attribution toggle | Draft remains private; (a)–(d) independent; no publication/attribution/training without corresponding consent. |
| Edit published contribution, report it, moderate then withdraw | New material version re-enters review; report suspends immediately; decisions/reasons audited; reporter identity hidden. |
| Withdraw shared item under realistic index/cache conditions | Search and AIRA retrieval/citations omit within ≤60s; cache bypass/stale epoch cannot restore it; unavailable gate fails closed. |
| Theme with fewer than 3 orgs; repeated posts by one org; overlapping filters | Counts/evidence suppressed; distinct-org count remains one; differencing attempts suppressed/rate-limited. |
| Raw private text, attachments, tenant IDs, moderation notes in logs/index/AI payload | Absent from shared stores and logs; only approved de-identified copy enters community retrieval. |
| Notification failure/retry | In-app state persists; email outbox retries idempotently and never reports delivery before provider confirmation. |

## Next 16.4.3 references

Installed docs: `node_modules/next/dist/docs/01-app/01-getting-started/{15-route-handlers,16-proxy,08-caching}.md`; `node_modules/next/dist/docs/01-app/02-guides/{authentication,server-actions,caching-without-cache-components}.md`. The auth guide recommends a server-only DAL and DTOs; Proxy is explicitly not a complete session/authz solution. Route Handler GETs can be opted into caching, so protected routes must not opt in without a reviewed per-user invalidation design.
