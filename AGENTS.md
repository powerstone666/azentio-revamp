<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Azentio SPS: contributor guide for agents

**azentio.ai** is a hackathon build for Azentio (built by Tech Wizards, 31 Oct 2026): a public marketing site plus a secure collaboration portal. Clients record market observations, a moderator reviews them, approved and de-identified copies become shared learning, and product owners turn recurring themes into improvement ideas. An AI guide (AIRA) answers questions from approved knowledge.

Read this file fully before changing anything. Rules marked **MUST** have caused real breakage when ignored.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching`), React 19 |
| Styling | Tailwind CSS v4 via `@tailwindcss/turbopack` (rule in `next.config.ts`; there is no PostCSS config) |
| Motion | GSAP 3 + `@gsap/react`, public site only |
| Icons | `@phosphor-icons/react` only. No emoji or text symbols as icons |
| Database | Supabase Postgres, accessed with the `pg` Pool. **No ORM, no Supabase JS client** |
| Auth | Better Auth, email one-time code (OTP), sent by Nodemailer over Gmail SMTP |
| AI | OpenAI-compatible client, **NVIDIA only**, configured purely by env (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`); no provider fallbacks. Answers render with `react-markdown` |
| Validation | `zod` at every API boundary |
| Package manager | npm only. Install with `@latest`; add `--legacy-peer-deps` only after a real peer conflict |

---

## 2. Architecture

```
app/
  (public)/          Public marketing site (own layout: Header, Footer, AIRA widget)
  portal/            Signed-in portal, one area per role: client, employee, moderator, product-owner, admin
  onboarding/        New verified user picks roles (demo onboarding)
  workspace/select/  Switch between a user's organisations
  invite/[token]/    Accept an invitation
  api/
    v1/              HTTP route handlers (thin: parse, authorize, call a service, shape the response)
    (services)/      Business logic, one folder per domain (contributions, moderation, ideas, ...)
    (db)/            client.ts (pool), schema/*.sql, seed/
  (ui)/
    components/      public/ (site), portal/ (portal kit + feature components), pages/ (shared page kit)
    motion/          GSAP kit (Reveal, SplitHeading, PinnedSteps, Marquee, ...)
  (config)/          Static config: nav, home content, personas, onboarding roles, sandbox demos, scraped content JSON
  (common-lib)/types Shared types, zod schemas, typed errors
proxy.ts             Optimistic cookie redirects only. Never an authorization boundary
scripts/seed.ts      Deterministic, idempotent synthetic seed (npx tsx scripts/seed.ts)
```

### Two deliberate visual systems. Do not mix them

- **Public site** (`app/(public)`, `components/public`, `components/pages`): light only (dark mode was removed on purpose), Poppins, semantic tokens (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, ...) defined in `app/globals.css`, photos over abstract art, heavy GSAP via the kit in `app/(ui)/motion`.
- **Sign-in and portal** (`/login`, `/portal/**`, `/onboarding`, `/workspace/select`, `/invite`): the original Azentio look. `az-*` tokens (`az-navy`, `az-mint`, `az-green`, `az-grey-bg`, `az-text`, ...), navy header bands, mint pill buttons, 12px cards, `shadow-card`. No GSAP beyond 150ms CSS transitions. Reuse `components/portal/kit` (PageHeader, Card, PillLink, Table, StatTile, ...).

### Data and identity

- **Tenancy:** `organizations` (type `azentio` or `client`), `users`, `memberships` (one role per org per user), `role_grants` (org-scoped or platform-wide with `org_id NULL`), `entitlements` (offerings per org).
- **Learning loop:** `contributions` + `contribution_versions` (private source) -> `moderation_decisions` -> `shared_copies` (reviewed, de-identified copy) -> `themes` / `theme_evidence` -> `improvement_ideas` / `idea_evidence`. Separate `consents` per purpose (store, publish, attribute, model training).
- **Audit:** `audit_log` is append-only (triggers reject UPDATE/DELETE/TRUNCATE). Never write code that needs to edit it.
- **Authorization:** `getSession()` (React-cached) returns user, memberships, grants and the active workspace. `authorize({ action, resource })` is the single decision point, driven by the `POLICIES` table in `app/api/(services)/authz/authorize.ts`. Pages call `requirePortalPage(action)`. Add a policy entry for every new action; unknown actions are denied.
- **Sandbox/demo organisations:** `organizations.is_sandbox = true` marks self-serve demo workspaces. They must stay out of admin directories, the global review queue and the community feed.

### Sign-in modes

1. **Real login:** email OTP via Better Auth. Only provisioned or invited emails get a code, unless `DEMO_ONBOARDING=true` (see below).
2. **Demo persona login:** `PersonaPicker` sets the `azentio_mock_persona` cookie and shows synthetic content with no database. It is honoured in every deployment, production included (a deliberate choice: this is a prototype, not a production app). It never reads real data.
3. **Demo onboarding** (`DEMO_ONBOARDING=true`, off by default): a new verified user can join one shared Azentio sandbox workspace with selected roles. Role grants and tenant-owned data stay in that sandbox; synthetic demo activity is visible across roles to demo members. Never enter real customer or confidential information there.

### AIRA (the AI guide)

`AiraWidget` -> `POST /api/v1/aira/chat` -> `queryAira()` in `app/api/(services)/aira/ai.ts`. In order:

1. **Privacy guard.** `detectPotentialSensitiveContent` runs on the message and history. If it finds personal identifiers, account numbers or credentials, AIRA asks the user to rephrase and sends nothing to any provider.
2. **RAG first.** Lexical search over page chunks (`search.ts`, `knowledge.ts`) plus approved shared evidence (re-checked against the database so withdrawn copies drop out). A strong match is answered locally (`isRagMatch`) and **the external AI call is skipped**.
3. **External AI only with per-request opt-in.** The widget sends `allow_external_processing`. Its consent tick-box fades out once ticked, persists in `sessionStorage` (`aira_external_ai_consent`), and leaves a one-line "External AI enabled" toggle. The route records the consent in `audit_log` for signed-in users.
4. **Provider call.** Only when consent is given and `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` are all set: one NVIDIA chat completion with `ragData.md` and the retrieved chunks as context, `enable_thinking: false` (context is supplied, so reasoning only adds latency and eats tokens), `max_tokens` 1500, 30s timeout. If any env var is missing, or the call fails, the local knowledge engine answers instead.

Answers render through `AiraMarkdown` (internal links via `next/link`). Voice: warm and natural for greetings; never open with stiff phrases such as "Based on Azentio's official documentation".

Rules: only approved, de-identified shared evidence may reach the model, never private drafts, source payloads, tenant ids or reviewer notes. Stay grounded in Azentio's documented scope (azentio.com). Do not add other providers or silent defaults.

### Email

Transactional mail (sign-in code, invitations, notifications, digests) is rendered with Handlebars in `app/api/(services)/email/`.

- **Templates:** the `.hbs` files in `email/templates/` are the single source (`layout`, `signin-otp`, `invitation`, `notification`, `general`). There are no embedded copies, and a missing file throws. `next.config.ts` ships them with the API routes (`outputFileTracingIncludes`).
- **Brand:** colours, fonts, radius and shadow come from `email/brand.ts` (the Azentio tokens extracted from azentio.com) and reach templates as `{{brand.*}}`. Never hardcode hex codes or fonts in a template. Poppins loads from Google Fonts where the mail client allows it, and otherwise falls back to Segoe UI / Helvetica / Arial.
- **Origin:** every link, the logo and the footer links are built from the app origin. `renderEmailTemplate(..., origin)` and the `render*Email` helpers **require** `origin`. Use `{{url '/path'}}` in templates, and pass paths (or full URLs) for `actionUrl` / `inviteUrl`; the renderer resolves them to absolute `http(s)` URLs. Never write a relative link or a hardcoded domain into an email.
- **Where origin comes from:** the request. Route handlers use `new URL(request.url).origin`; the Better Auth OTP callback uses `ctx.request.url` (or `ctx.context.baseURL`). Background work gets it from the job route that triggered it (`/api/v1/internal/email-outbox`). Services take an `origin` argument; do not read it from env or guess it.
- **Logo:** mail clients cannot show SVG and load remote images through their own servers (so an origin like localhost shows a broken image). The logo is therefore a PNG sent **inline with the email** (`cid:` attachment, `logoAttachment()` in `brand.ts`). Every `sendMail` call that sends this layout must pass `attachments: [logoAttachment()]`. Do not put a domain-looking label such as `azentio.ai` in email text: mail clients auto-link it to the real site.
- **Text:** pass plain characters such as `→` in labels, not HTML entities (Handlebars would escape them twice). Message bodies keep line breaks.

---

## 3. Local setup

```bash
npm install
cp <your env> .env.local      # see variables below; .env* is gitignored
npm run dev                   # http://localhost:3000
```

Environment variables (names only; never commit values):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (direct or session pooler) |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `BETTER_AUTH_ALLOWED_HOSTS` | Comma-separated hosts Better Auth may use as its base URL |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Gmail SMTP. `SMTP_PASS` is a Google App Password |
| `AI_API_KEY` `AI_BASE_URL` `AI_MODEL` | AIRA provider (NVIDIA). All three are required for external answers; there are no defaults |
| `AI_EMBEDDING_MODEL` | Optional NVIDIA/OpenAI-compatible embedding model for explicitly consented, reviewed shared copies; no embeddings are generated when unset |
| `SEMANTIC_THEME_SIMILARITY` | Cosine similarity threshold for semantic theme suggestions (0.78 default; accepted range 0.5–0.99) |
| `DEMO_ONBOARDING` | `true` enables self-serve demo workspaces |
| `MIN_DISTINCT_ORGS` | Minimum organisations before a theme is shown (default 3) |
| `EMAIL_OUTBOX_JOB_ENABLED` | `true` lets the scheduled/manual email-outbox job run; otherwise it returns `skipped` and sends nothing |
| `OUTBOX_JOB_TOKEN` | Bearer token for the internal email and support-ticket outbox job routes |
| `SUPPORT_TICKETS_WEBHOOK_URL` `SUPPORT_TICKETS_WEBHOOK_TOKEN` | Optional support-ticket forwarding (HTTPS, or localhost) |

### Database

- The schema lives in `app/api/(db)/schema/initial.sql` and `better-auth.sql`. There is no migration tool.
- Seed with `DATABASE_URL=... npx tsx scripts/seed.ts`. It is idempotent (deterministic IDs, `ON CONFLICT DO NOTHING`) and safe to re-run.
- `initial.sql` is **not** safe to re-run whole: `CREATE POLICY` is not idempotent. To add schema to an existing database, apply only the new statements, and when you change a table definition also add an `ALTER ... IF NOT EXISTS` so existing databases catch up.
- The Supabase project may also hold other apps' tables. **MUST NOT** drop, alter or truncate anything that is not an Azentio table.
- Test schema changes in a scratch Postgres schema (`CREATE SCHEMA x`, `search_path`), then drop it. Do not leave test rows in the real tables; `audit_log` rows cannot be deleted.

---

## 4. How to contribute

### Workflow

1. Read the code around your change and reuse what exists (portal kit, page kit, services) before writing new code.
2. Make the smallest change that solves the problem at the outermost correct layer. No speculative abstractions, no unrelated refactors.
3. Verify (see section 5).
4. Commit only when asked. Messages are short and say why. Never commit `.env*`, secrets, or `.next`. Do not push or force-push unless asked.
5. Update this file when you change architecture, env variables or a rule here.

### Working alongside other agents

Several agents and humans edit this repo at the same time (coordination happens in a Cross Agent Bridge room; `.agent-room/` is gitignored).

- **MUST** re-read a file immediately before editing it, and treat on-disk changes as deliberate. Never revert someone else's edit; if it looks wrong, say so.
- Prefer small, surgical edits. If a pre-existing bug blocks you, fix the root cause narrowly and report it.
- Port 3000 belongs to the human's dev server. Run your own checks on another port (3100) from a clean copy of the repo, and stop only your own process by port (`lsof -ti tcp:3100`). Never `pkill` broadly.
- Do not paste or log secrets. Redact connection strings and keys in anything you print.

### Adding things

- **API route** (`app/api/v1/<name>/route.ts`): `import 'server-only'`; parse the body with zod; get the session; `authorize()`; call a service in `app/api/(services)/<domain>/`; return `Response.json({ data })` or `{ error }` with the right status. Validate on the server even if the client validated.
- **Service**: raw SQL with parameters (`$1`), never string-built SQL. Use `transaction()` for multi-statement changes that must be atomic (consents, moderation, invitations).
- **Portal page**: `await requirePortalPage('<action>')` first, then data. Hide empty values ("None") instead of showing them.
- **Public page**: use `ContentPage`/`LinkPage` and the sections in `components/pages`; copy comes from `app/(config)/content`. Keep copy grounded in `source.md` and the scraped Azentio content; do not invent claims.
- **Role or area**: add the policy entries, the portal area, a nav entry, and (if self-serve) an entry in `app/(config)/onboarding.ts`.

---

## 5. Verify before you finish

```bash
npx tsc --noEmit        # must be clean for the files you touched
npm run lint
npm run build           # must succeed
```

- **Tests:** `npm test` runs Jest 30 (next/jest, SWC; `npm run test:watch`, `npm run test:coverage`). Suites live in `tests/<area>/` (authz, email, onboarding, aira, contributions-moderation, ideas-learning-admin, platform-services, api-routes, common-config, ui). Node is the default environment; component tests opt into jsdom with a `/** @jest-environment jsdom */` docblock. The database is always mocked (`tests/support/db.ts` or each folder's SQL-router helper), as are `better-auth`, `next/headers`, nodemailer and `openai`; never hit the network or a real database. `server-only` is stubbed and `@/` is aliased.
- A bug found while testing is recorded as `it.failing(...)` stating the expected behaviour, so the suite stays green and the test flips to a failure the moment the bug is fixed. Remove `.failing` when you fix one. Do not write a test that merely asserts buggy behaviour.
- Tests assert SQL fragments and parameters, not query results, so they do not replace a run against a scratch schema. Jest cannot check navigation targets (jsdom) or GSAP; verify those in a real browser (Playwright scripts are used ad hoc and are not committed). If you cannot test the UI, say so; do not claim it works.
- **Build in a clean copy** when any dev server is running. Concurrent `.next` use causes Turbopack panics ("creating new process / node process exited") that are not real errors:
  ```bash
  rsync -a --delete --exclude .next --exclude .git ./ /tmp/azentio-build/ && cd /tmp/azentio-build && npm run build
  ```
- For auth flows, test with a fresh email each run. The client router caches redirects, so a stale result can hide a bug or invent one.

---

## 6. Hard-won rules (Next.js 16, auth, motion)

**Next.js 16 and Cache Components**
- `params` and `searchParams` are Promises: `const { slug } = await params`.
- Do **not** export route segment config `dynamic`, `dynamicParams`, `revalidate` or `runtime`. With `cacheComponents` they fail the build or cause 500s.
- Any page that reads cookies, headers, the session or `params` needs `export const instant = false`, or a `<Suspense>` boundary. Set it **on each portal page** (the layout-level setting satisfies `next build` but the dev check still flags every page, showing an "Issue" overlay).
- `generateStaticParams` on a dynamic route **MUST** return at least one entry, in every environment.
- Route moves leave `.next/types/validator.ts` stale. Delete `.next` if types reference old paths.
- Editing `app/globals.css` does **not** hot-reload under the Tailwind Turbopack loader. Restart the dev server (`rm -rf .next`) before judging CSS.

**Auth and navigation**
- **MUST** call `auth.api.getSession({ headers })` with the real request headers, never with `request`: with `request` it returns `{}` even for a valid session, which makes every guarded page fail. Keep the `createAuthApiRequest(headers)` call; it validates the host.
- After a state change that alters where `/portal` redirects (signing in, creating or choosing a workspace), navigate with `window.location.assign(...)`, not `router.replace`. The client router caches the earlier redirect for about 30 seconds.
- Better Auth POST endpoints reject requests without `content-type: application/json` (415), and `sign-out` is one of them. Always send the header and a body (`'{}'`), check `response.ok`, and navigate with `window.location.assign` only after it succeeds. A failed sign-out leaves the cookie and causes a redirect loop.
- `proxy.ts` sends signed-in users away from `/login`. A cookie that outlives its session will loop; clear cookies by signing out.
- Roles that are grants (moderator, product owner, publisher) only work if a row exists in `role_grants`. A membership alone is not enough. Portal admin is platform-wide only.
- Offering keys must match across entitlements, role grants, sandbox demos and improvement ideas. Use canonical keys such as `FAI`, `Lending` and `AMLOCK` (see `app/(config)/sandbox.ts`).

**UI**
- Tailwind v4 resets buttons to `cursor: default`. `globals.css` restores pointer and not-allowed globally; new buttons should still carry `cursor-pointer` and `disabled:cursor-not-allowed disabled:opacity-50` so they are right even before CSS reloads.
- Interactive elements use the spring press: `active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)] transition-all duration-150`, with distinct default and hover colours, and respect `prefers-reduced-motion`.
- User chat bubbles are navy with white text. AIRA sits left with the mint Sparkle avatar, the user right with the navy User avatar.
- Every image on the public site is unique (no repeats). Generated people photos live in `public/images`.

**Email & Outbox Delivery**
- **Handlebars (.hbs) Templates Compulsory:** All transactional and outbound emails (invitations, portal notifications, admin alerts) MUST use the Azentio Handlebars email templates in `app/api/(services)/email/templates/` via `app/api/(services)/email/renderer.ts`.
- **Branded Design:** Every email MUST render the Azentio brand layout with logo mark (`✦ azentio.ai`), deep navy `#16303D` header, mint `#34D399` CTA buttons, enterprise confidentiality notice, and copyright footer.
- **Multipart MIME Delivery:** Always deliver both `html` (rendered template) and `text` (plain-text fallback) in `enqueueEmail` and Nodemailer `sendMail`. Raw unstyled plaintext emails without the Azentio layout are strictly forbidden.

**GSAP** (skills for this repo live in `.agents/skills/gsap-*`)
- All GSAP code goes through the kit in `app/(ui)/motion` and the `useMotion` hook, which gates on `prefers-reduced-motion`.
- Register plugins only in `app/(ui)/motion/gsap.ts` (browser only).
- Inside `gsap.matchMedia`, use the `contextSafe` that the handler receives, not the one from `useGSAP`. Mixing them creates a context cycle and "Maximum call stack size exceeded" on cleanup.
- `Context.add(fn)` runs `fn` immediately. For a deferred wrapper use `add(null, fn)`.
- After layout changes, call `scheduleScrollRefresh()` so ScrollTriggers refresh in page order. `MotionPath` needs a `<path>`, not a `<circle>`.

---

## 7. Security rules

- **Deny by default.** Every route, server action and portal page authorizes server-side. Never derive authority from a nav menu, `localStorage`, an email suffix, or a client-supplied tenant id.
- **Tenant isolation.** One organisation's raw observations never reach another. Cross-tenant insight goes through moderation and de-identification first. Withdrawal must remove content from search, caches and AIRA retrieval.
- **Aggregates.** Themes show only with at least `MIN_DISTINCT_ORGS` distinct organisations. Repeat posts from one organisation are not independent evidence.
- **Consent is separate** for storing, publishing, attribution and model training. Saving never shares.
- **No secrets in code or logs.** `.env*` stays out of git. Do not send customer identities, account numbers or credentials to any AI provider.
- **Demo flags stay off by default.** `DEMO_ONBOARDING` and the demo persona cookie must never grant real or cross-tenant access. Self-serve users never receive portal admin.

---

## 8. Repository hygiene

- Gitignored on purpose: `.env*`, `.next`, `.agents`, `/docs/`, `source.md`, `knowledge.md`, `/.agent-room/`, `*.pdf`, `*.log`, `*.jsonl`. `docs/` and `source.md` are local references (requirements, plans, scraped content) and may be absent on another machine.
- Tracked: source under `app/`, `scripts/`, config (`next.config.ts`, `proxy.ts`, `eslint.config.mjs`, `tsconfig.json`), `public/`, and this file.
- Keep large spec dumps, screenshots and agent logs out of git. Put durable decisions in this file; keep session notes in `knowledge.md`.

---

## 9. Known gaps (as of 2026-10-30)

- Existing seed databases may contain hashed offering identifiers. Rerunning `scripts/seed.ts` repairs seeded entitlement and grant rows in place with canonical offering keys.
- `improvement_ideas`, `employee_experiments` and `employee_knowledge_items` are not organisation-scoped, so demo users share the seeded ones.
- With `DEMO_ONBOARDING=true`, anyone with a working email can request a sign-in code and join the shared synthetic demo workspace. Turn the flag off when open demo sign-up is not wanted.
- A few public pages (academy, talent journey, support, become-a-partner) are short link pages because the source site redirects those URLs; they need supplied copy.
- Jest covers services, routes, config and key components. Open `it.failing` cases mark known defects (for example `authorize` resolving inherited keys such as `constructor`, sandbox copies reaching AIRA evidence, raw error text in release-notes routes); grep for `it.failing`.
