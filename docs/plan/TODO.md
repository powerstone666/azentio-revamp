# Plan TODO — review fixes (deferred)

From the 2026-10-30 reviews of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): Codex review, Gemini review, and Claude's 4-worker swarm on §1–4. Apply before starting M1.

Owner key: **C** = Claude (master plan + mock-data plans), **X** = Codex (`codex-backend-security.md`), **G** = Gemini (`gemini-frontend-ux.md`).

## Must fix

- [ ] **C** M0: delete the scaffold `app/page.tsx`, which clashes with `app/(public)/page.tsx` on `/`.
- [ ] **C** §2: `cacheComponents` is already on in `next.config.ts`. Every portal page or layout that reads the session must sit inside `<Suspense>`; use `export const instant = false` as the fallback. Never put user data in `'use cache: private'`. No `runtime` exports.
- [ ] **X** Lifecycle: a material edit of a published contribution must not unpublish it. Keep `state=published` with a pending-version pointer so v1 stays live until v2 is approved.
- [ ] **X** Add an `approved` value to `shared_copies.status`.
- [ ] **X** Suspension must deny immediately, the same as withdrawal: bump the epoch and live-filter.
- [ ] **X** Withdrawal deletes the embedding row **inside the transaction**. Protected search/AIRA responses are never cached, including the "epoch-keyed" variant.
- [ ] **X/C** Move the withdrawal and suspension gate (tombstone + live status filter) into **M2**, before any shared retrieval exists. M4 keeps the purge retries and the measured ≤60s test.
- [ ] **C** M4 "done when" covers search only; the AIRA withdrawal tests W-1..W-3 move to M7.
- [ ] **X** One withdrawal entry point. `updateTag` works only in Server Actions; route handlers use `revalidateTag(tag, { expire: 0 })`. Safety comes from the live-status gate, not the cache API.
- [ ] **C** §4: add one **state → UI label** table and use it in all plans. Codex has 8 states; Gemini adds `in_review` and omits some; mock data uses "returned" and "reported".
- [ ] **C** §1: add one **role/grant enum** table: employee, client_member, client_admin, learning_moderator, content_publisher, product_owner, portal_admin. Codex is missing `client_member` and says "media publisher".
- [ ] **X** Data model: add `role_grants.offering_id` (product-owner assignment) and a `support_access` table (the portal admin's explicit support authorisation, source §03).
- [ ] **C** Mock data: obs_12, 13, 15 and 16 propose community sharing with consent b=0. Set b=1. Attribution (c) is **opt-in** everywhere (Gemini's demo says opt-out).
- [ ] **C** `DEMO_MODE` code: accept it only for seeded accounts, and add a test that any other account is rejected.
- [ ] **X** Drop all Drizzle references; replace them with `pg` + SQL migrations in `supabase/migrations/` (user decision: Supabase, no ORM).

## Should fix

- [ ] **C** §1–4 cover only 6 of 25 checked requirements; 19 sit only in the Codex detail plan. Add short rule rows for:
  - deny-by-default and explicit public;
  - the four independent consents;
  - search, counts, suggestions and exports using the same visibility;
  - comments and attachments inheriting audience (or no attachments in P0);
  - raw text kept out of logs, analytics and AI payloads;
  - the notification outbox;
  - report → suspend;
  - source vs shared-copy separation;
  - de-identification defaults;
  - `COUNT(DISTINCT org_id)` plus differencing suppression;
  - terms + "joining ≠ consent";
  - organiser-approved employee provisioning.
- [ ] **C/X** Idea statuses: Proposed, Under review, Planned, In progress, Released, Not proceeding, with audited changes. Missing from every plan file.
- [ ] **X** Add routes/entities for exports, search suggestions, facet columns, comments, and the material-edit flow for published contributions.
- [ ] **G** Scope the moderator, product-owner and admin consoles by role grant, not by the active workspace; the switcher does nothing for Azentio staff.
- [ ] **G** Add `app/portal/page.tsx`, which redirects to the role dashboard or `/workspace/select`.
- [ ] **G** Gemini owns `page.tsx` composition and consumes Codex's typed Server Actions and DAL queries. Add interface checkpoints before M3 and M6.
- [ ] **G** GSAP only in `app/(public)/`; the portal uses Tailwind transitions (≤150ms).
- [ ] **G** Status display: coloured Phosphor icon + text label, no dot (Gemini's suggestion, accepted).
- [ ] **G** Remove the scripted 60-second countdown and the "<15 seconds" claim; show measured server timing only.
- [ ] **G** Rename demo orgs to the mock-data names (Harborline, Sandune, Kestrel, Northmere, Emberfield).
- [ ] **G** Phosphor: import from `@phosphor-icons/react/ssr` in Server Components. Duotone accent via `svg path[opacity="0.2"] { fill: var(--color-az-green) }`.
- [ ] **C** Mock-data plan: replace `pnpm seed:reset` with `npm run seed:reset`; seed embeddings come from cached Cohere fixtures.
- [ ] **C** Move authz and DB code under a `server-only` guard. Route groups don't stop a `route.ts` from importing it.

## Rejected (with reason)

- pgvector instead of jsonb vectors: the user chose jsonb, which is fine at demo scale; pgvector stays the upgrade path.
- `@tailwindcss/postcss`: not needed, because the project uses `@tailwindcss/turbopack`.
