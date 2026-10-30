# azentio.ai — Implementation plan

Merged plan for the hackathon portal described in [source.md](../../source.md). Detail lives in the section plans; this file holds the decisions, structure, build order and ownership.

| Section plan | Author | Covers |
|---|---|---|
| [codex-backend-security.md](codex-backend-security.md) | Codex (+ its swarm) | Stack, data model, lifecycle, authorization layer, withdrawal ≤60s, API routes, security tests |
| [gemini-frontend-ux.md](gemini-frontend-ux.md) | Gemini / Antigravity (+ its swarm) | Route map, layouts, component inventory, Tailwind tokens, GSAP choreography, demo click path |
| [claude-mock-data-portal.md](claude-mock-data-portal.md) | Claude swarm | Orgs, personas, entitlements, 21 observations, themes, ideas, judge demo script, negative tests |
| [claude-mock-data-playground.md](claude-mock-data-playground.md) | Claude swarm | 6 Playground scenarios, AIRA corpus, analytics/suppression data, optional federated-learning datasets, public mock content |
| [../azentio-design-system.md](../azentio-design-system.md) · [../azentio-site-content.md](../azentio-site-content.md) | Claude | Azentio fonts/colours/patterns and scraped public copy |

## 1. Locked decisions

| Area | Decision | Source |
|---|---|---|
| Framework | Next.js **16.4.3**, React 19.3, Turbopack (installed) | package.json |
| Styling | **Tailwind CSS v4** standard, tokens in `@theme` in `app/globals.css` | user |
| Font | **Poppins** via `next/font/google` (`--font-poppins`), weights 300/400/500/600/700 | design system |
| Animation | **gsap 3.15.0 + @gsap/react 2.1.2** (all plugins free incl. ScrollTrigger, SplitText) | user, verified on npm |
| Icons | **@phosphor-icons/react 2.1.10** — `duotone`/`bold` on public tiles, `regular` in portal | user-confirmed |
| Auth | **Better Auth 1.7.x** on Supabase Postgres via `pg` Pool — email OTP / magic link + `organization` plugin (invitations, active organization); Entra OIDC later | user |
| Database | **Supabase** (Postgres). Local: Supabase CLI (`supabase start`); hosted Supabase for judging if needed | user |
| Data access | **No ORM.** Server-only repositories in `app/api/(db)/` using `pg` (node-postgres) with parameterised SQL and real transactions (withdrawal = one transaction). Schema as SQL migrations in `supabase/migrations/`. TS types hand-written in `app/(common-lib)/types/` with Zod | user |
| Supabase API lockdown | App connects server-side only. **Enable RLS on every table with no anon/authenticated policies** (and revoke grants) so Supabase's auto REST API and anon key expose nothing. Never ship the service key or DB URL to the browser. Authorization lives in our DAL | Claude |
| Validation | **Zod 4.x**, same schema client + server | Codex |
| Email (OTP, invites, notifications P1) | **nodemailer** over SMTP, configured by `SMTP_HOST/PORT/USER/PASS/FROM`. Local dev: the Supabase local stack's mail catcher (enable its SMTP port in `supabase/config.toml`) or a Mailpit container. Sends go through the outbox; never label a queued mail "delivered" | user |
| Hosting | **Local only for now** (Next dev/prod server + Supabase CLI). Hosted target decided later | user |
| AIRA (LLM) | **Cohere via its OpenAI-compatible API** using the `openai` SDK: `AI_BASE_URL=https://api.cohere.ai/compatibility/v1`, `AI_API_KEY`, `AI_MODEL` (e.g. `command-a-plus-05-2026`). Provider stays swappable by env. Unsupported in compat mode: Cohere-native `documents`/`citation_options`/`connectors` — so AIRA builds its own context block and citation IDs. Only approved shared copies + public content are ever sent; private text never reaches the provider (source §09) | user |
| Search | Postgres full-text search over **shared copies only** (keyword) | Codex |
| Vectors | **JSON vectors in Postgres** (`jsonb` column, table `shared_copy_embeddings`), cosine similarity in app code after SQL filters by live status + audience. No separate vector DB or JSON file (withdrawal must delete in the same transaction). pgvector is the upgrade path if scale grows | user |
| Embeddings | **Cohere `/embeddings` via the same OpenAI-compatible endpoint** (`EMBED_MODEL`, e.g. `embed-v5.0-pro`, `encoding_format: "float"`; `dimensions` param unsupported — store the returned length in `shared_copy_embeddings.dims`). Wrapped in one `embed()` adapter. Only approved shared copies are embedded, never private drafts. Seed embeddings are cached as fixtures so demos don't depend on the API | user |
| Package manager | npm only, `@latest`, `--legacy-peer-deps` only after a real peer conflict | playbook |

Versions verified with `npm view` on 2026-10-30: better-auth 1.7.14 (peer `pg ^8`), pg 8.23.1, supabase CLI 2.122.0, openai 7.45.1, zod 4.6.7, gsap 3.15.0, @gsap/react 2.1.2, @phosphor-icons/react 2.1.10. **Drizzle is dropped** (user: no ORM) — Codex's plan sections that mention Drizzle are superseded.

## 2. Next.js 16 rules every agent must follow

Verified in `node_modules/next/dist/docs/01-app/`:

- `middleware.ts` is deprecated → root **`proxy.ts`**. Proxy only does optimistic cookie checks/redirects. It is never the authorization boundary.
- Real authorization = server-only **DAL** in `app/api/(services)/authz/`: `verifySession()` wrapped in React `cache()`, then `authorize(action, resource, activeWorkspace)`. Call it in every Server Component that reads protected data, **every Server Action** (they are public POST endpoints) and **every route handler**, including media.
- **Do not gate auth in shared layouts.** Layouts may fetch the user for display; pages/actions authorize through the DAL. (Fixes Gemini's "auth gate" in `portal/layout.tsx`.)
- `await cookies()`, `await headers()`, `await params`, `await searchParams` — sync access is removed.
- `cacheComponents: true`; `'use cache'` + `cacheLife` + `cacheTag` **only for public content**. Never cache private, tenant or shared-learning payloads across users.
- Withdrawal: `updateTag()` in the Server Action (immediate). **Never** `revalidateTag(tag, 'max')` for withdrawal — it serves stale content. Search/AIRA always filter by live DB status, so cache invalidation is a backup, not the mechanism.

## 3. Folder structure

Route groups follow Gemini's map; code placement follows the project convention.

```text
proxy.ts                         # optimistic redirect for /portal/** only
app/
  layout.tsx                     # Poppins, globals.css
  globals.css                    # Tailwind v4 @theme tokens (az-navy, az-mint, az-green, ...)
  (public)/                      # marketing site: header, footer, cookie bar
    page.tsx  about/  products/[category]/[slug]/  insights/[slug]/  request-demo/  hackathon/
  login/  invite/[token]/  workspace/select/
  portal/
    layout.tsx                   # shell only (top bar, workspace switcher, nav) — no auth decisions
    client/  employee/  moderator/  product-owner/  admin/
  api/
    v1/<route>/route.ts          # see Codex API surface
    (services)/
      authz/                     # session, policy, active workspace, DTO mappers
      contributions/  moderation/  search/  themes/  ideas/  notifications/  audit/  aira/  playground/
    (db)/
      client.ts                  # server-only pg Pool to Supabase Postgres
      repositories/              # parameterised SQL per entity, transaction helper
      seed/                      # deterministic seed modules (stable IDs, reset script)
supabase/
  config.toml                    # Supabase CLI local stack
  migrations/                    # SQL schema, RLS-on lockdown, indexes, FTS
    (prompts)/                   # AIRA prompt .txt files
  (common-lib)/types/            # shared TS types, Zod schemas, lifecycle enum
  (ui)/
    components/public/           # Hero, CategoryRow, StatsBand, CardCarousel, ContactForm, Footer...
    components/portal/           # WorkspaceSwitcher, ContributionForm, ModerationWorkbench, ThemeDashboard...
    motion/                      # GSAP registration + useGSAP wrappers ('use client')
    lib/api-client.ts
  (config)/                      # offerings catalogue, nav, threshold config (min_distinct_orgs=3)
scripts/                         # seed-playground.ts, gen-fl-datasets.ts (seeded RNG)
```

## 4. Conflicts resolved during merge

| Conflict | Resolution |
|---|---|
| Gemini's demo orgs (Gulf Retail Bank, Levant, Nile) vs mock-data orgs | Use the **mock-data plan names**: Harborline Commercial Bank, Sandune Finance, Kestrel Peak Microfinance (seasonality); Northmere Mutual (attack target); Emberfield Capital (empty states). Gemini's click path keeps its steps. |
| Gemini's portal layout as "auth gate" | Layout renders shell only; DAL authorizes per page/action (Next 16 guidance). |
| Gemini's announcement-bar copy ("Gartner Magic Quadrant") | Invented; use real copy from the scraped site content. |
| Withdrawal "countdown ticker < 15 s" | Show the **measured** time from server timestamps (commit → absent from search/AIRA), never a scripted animation. PS forbids overclaiming. |
| Status shown as coloured pills everywhere | Status = text label + small colour dot + Phosphor icon (colour never alone). Pills only for real controls (filters). |
| Emoji in Gemini's sidebar mock-up | Phosphor icons per the icon decision in the room (`SquaresFour`, `Note`, `ListChecks`, `Lightbulb`, `Wrench`, `Buildings`, `Flask`, `Broadcast`, ...). |
| Gemini's "Gemini plan uses GSAP 3.12+" | Pin 3.15.0 / @gsap/react 2.1.2. |
| Lifecycle states | Codex's state machine is authoritative (`private_draft → submitted → needs_clarification/rejected/approved → published → suspended/withdrawn`, new version on material edit). UI labels map 1:1. |
| Hero collage infinite float loop | Allowed on public hero only; disabled under reduced motion. **Portal: no load/scroll animation**, only ≤150 ms state transitions. |

## 5. Build order (milestones)

Each milestone ends with typecheck, lint, build and the listed checks passing.

| # | Milestone | Scope | Done when |
|---|---|---|---|
| M0 | Foundation | `npm install` deps; Tailwind tokens + Poppins; Phosphor; GSAP motion module; Docker Postgres; Drizzle schema + migrations; seed runner | `npm run build` passes; seed loads all 6 orgs and 23 personas |
| M1 | Identity & authz | Better Auth (email OTP, `DEMO_MODE` fixed code rejected in prod); invitations (single-use, expiring, email-bound); memberships, role grants, entitlements; DAL `authorize()`; `proxy.ts`; workspace switcher; audit log | Every persona logs in to the right dashboard; negative tests for cross-tenant, escalation, unprovisioned `@azentio.com`, suffix auto-join, expired/wrong-account invite pass |
| M2 | Observation lifecycle | Contribution form (3 sharing scopes, 4 independent consents, sensitive-content flag); versions; submit/clarify/resubmit; moderation workbench (source vs editable shared copy, redaction); publish creates `shared_copies`; report → suspend; withdraw | Seasonality scenario runs end to end; shared payload has no tenant ID, author, notes or attachments |
| M3 | Shared learning & insights | Shared feed + FTS search with facets; themes counting `COUNT(DISTINCT org_id)` with suppression and differencing guards; improvement ideas + audited status; client ideas view; in-app notifications/outbox | "Seasonality context" shows 3 orgs + small-sample warning; "Alert triage fatigue" suppressed; withdrawal drops theme to 2 → suppressed |
| M4 | Withdrawal ≤60 s | Tombstone + `visibility_epoch`, live-status filter in search/AIRA, index purge worker, `updateTag`, measured timing in UI | Automated test: withdraw → absent from search and AIRA well under 60 s; stale cache cannot bring it back |
| M5 | Public website | Header, hero, category row, stats band, carousels, product/category/insights pages from scraped copy, request-demo and hackathon registration forms; GSAP (hero reveal + underline draw, stats count-up, staggered reveals) | Matches screenshots at 1440 and 390 px; reduced-motion verified; no portal data reachable |
| M6 | Employee & client extras | Employee dashboard, Playground (6 deterministic scenarios, "simulated — not a decision" labels), internal live/recordings with audience checks, knowledge library; client sandboxes isolated per tenant/user; client admin team page | Employee-only content never appears in client/public search or AIRA |
| M7 | AIRA (P1) | Retrieval over approved shared copies + public content only; re-check status before context and before citations; cites sources; refuses otherwise | AIRA corpus tests (10 Q&A + withdrawal W-1..W-3) pass |
| M8 | Hardening & demo | Full negative-test table, judge demo script (19 steps), README with demo logins and production SLA statement | Judges' script runs clean twice from a fresh seed |
| P2 | Federated learning (optional) | Only after M8: 3 isolated synthetic datasets, FedAvg, dropout, poisoned update rejected, holdout eval, candidate-model registry; honest labels (no secure-aggregation/DP claims unless implemented) | See playground plan §5 |

## 6. Ownership for the build (proposed)

No two agents edit the same files; seams are the shared types in `app/(common-lib)/types/` (Claude owns, others read).

| Agent | Owns |
|---|---|
| **Codex** | M1 authz/DAL, Drizzle schema, M2 lifecycle services, M4 withdrawal/search, API route handlers |
| **Gemini / Antigravity** | M0 tokens/fonts/motion, M5 public site, portal UI components (`app/(ui)/components/**`) |
| **Claude** | Shared types + Zod schemas, seed data, M3 themes/ideas, M6 Playground, M7 AIRA, integration, M8 tests and review of every diff |

Each agent may use its own sub-agent swarm inside its own files. Coordination: room `.agent-room/rooms/azentio-plan`, `knowledge.md` Active lines, one git worktree per agent task.

## 7. Install commands (M0)

```bash
npm install gsap@latest @gsap/react@latest @phosphor-icons/react@latest zod@latest better-auth@latest pg@latest openai@latest server-only@latest nodemailer@latest
npm install -D supabase@latest @types/pg@latest @types/nodemailer@latest
```

The lockfile pins exact versions; M0 verifies they build together on Next 16.4.3.

## 8. Open questions for the user

1. **AIRA provider.** Decided: Cohere via OpenAI-compatible API (chat + embeddings). Still open: confirm the Cohere key tier — trial keys are rate-limited and may not allow commercial use; check Cohere's terms before judging.
2. ~~Email~~ — decided: nodemailer over SMTP.
3. **Hosting** — deferred; local only for now. Revisit before judging (affects the multi-instance cache note in §2 and Supabase hosted vs local).
4. **Federated-learning P2** — not answered yet; stays optional after M8.
5. **Review fixes** — deferred to [TODO.md](TODO.md).
5. **Reference prototype** (azentio-ai-ipad.ssaha999.chatgpt.site) has not been reviewed yet. Should its routes and content be scraped as well?

## 9. Risks

- **Scope.** M0–M4 is the judged core. Do not start M5 polish before M4's withdrawal test passes.
- **Overclaiming.** Label all simulated, sandbox, aggregation and privacy limits honestly. Never call a queued notification "email delivered".
- **Next 16 drift.** Read the bundled docs before using any Next API; training data is out of date for proxy, caching and async APIs.
- **Real brand content.** Scraped Azentio copy is public marketing only. Everything inside the portal stays synthetic.
