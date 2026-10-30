# azentio.ai: A Consent-First Collaboration Portal for Collective Learning in Financial Software

**Azentio Hackathon submission · Tech Wizards · 31 October 2026**

Imran Pasha · Koora Sai Sujith · Sai Surya Teja Gontumukkala

<p align="center">
  <img alt="Hackathon" src="https://img.shields.io/badge/HACKATHON-AZENTIO%2031%20OCT%202026-2ed88e?style=for-the-badge&labelColor=555555">
  <img alt="Team" src="https://img.shields.io/badge/TEAM-TECH%20WIZARDS-16303d?style=for-the-badge&labelColor=555555">
  <img alt="Status" src="https://img.shields.io/badge/STATUS-PROTOTYPE-d4b53a?style=for-the-badge&labelColor=555555">
  <img alt="Data" src="https://img.shields.io/badge/DEMO%20DATA-SYNTHETIC-6a5ae6?style=for-the-badge&labelColor=555555">
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/NEXT.JS-16-3a82c4?style=for-the-badge&labelColor=555555">
  <img alt="React" src="https://img.shields.io/badge/REACT-19-3a82c4?style=for-the-badge&labelColor=555555">
  <img alt="TypeScript" src="https://img.shields.io/badge/TYPESCRIPT-STRICT-3a82c4?style=for-the-badge&labelColor=555555">
  <img alt="Tailwind" src="https://img.shields.io/badge/TAILWIND-V4-3a82c4?style=for-the-badge&labelColor=555555">
  <img alt="Postgres" src="https://img.shields.io/badge/POSTGRES-SUPABASE-3a82c4?style=for-the-badge&labelColor=555555">
</p>

<p align="center">
  <img alt="Tests" src="https://img.shields.io/badge/TESTS-2.5K%2B%20JEST-6fbf3a?style=for-the-badge&labelColor=555555">
  <img alt="Personas" src="https://img.shields.io/badge/PERSONAS-20-6fbf3a?style=for-the-badge&labelColor=555555">
  <img alt="Roles" src="https://img.shields.io/badge/ROLES-7-6fbf3a?style=for-the-badge&labelColor=555555">
  <img alt="Min orgs" src="https://img.shields.io/badge/THEME%20THRESHOLD-3%2B%20ORGS-6fbf3a?style=for-the-badge&labelColor=555555">
  <img alt="Audit" src="https://img.shields.io/badge/AUDIT%20LOG-APPEND--ONLY-6fbf3a?style=for-the-badge&labelColor=555555">
</p>

![Home page](readme-assets/screenshots/public-home-hero.png)

---

## Abstract

Enterprise software vendors learn a great deal from their clients, and most of it is lost. Observations about how a product behaves in the field sit in emails, tickets and meetings. They are tied to one customer, they are hard to share safely, and they rarely reach the people who decide what to build next.

**azentio.ai** is a working prototype of a different loop. A client records what they see. A human moderator reviews it. Only an approved, de-identified copy becomes shared learning. Recurring themes that appear across at least three independent organisations are shown to product owners, who turn them into improvement ideas with a client-facing status. An AI guide, **AIRA**, answers questions from approved knowledge and never from private drafts.

The system has two surfaces: a public marketing site, and a role-based portal for clients and Azentio staff. It is built as one Next.js 16 application on Supabase Postgres. Authorization is deny-by-default, consent is recorded separately for each purpose, and the audit log is append-only. A self-serve **sandbox** lets any reviewer sign in, pick one role, and explore every internal portal against synthetic data, without touching real tenants.

This document explains the project, how to install it, its architecture, the personas, and how to use the sandbox. It ends with the credits.

**Keywords:** collective learning, consent management, multi-tenant isolation, human-in-the-loop moderation, retrieval-augmented generation, Next.js, PostgreSQL.

---

## Contents

1. [Introduction](#1-introduction)
2. [Contributions](#2-contributions)
3. [System overview](#3-system-overview)
4. [Installation](#4-installation)
5. [Architecture](#5-architecture)
6. [Personas and access model](#6-personas-and-access-model)
7. [Using the application](#7-using-the-application)
8. [The public site and AIRA](#8-the-public-site-and-aira)
9. [Security and privacy design](#9-security-and-privacy-design)
10. [Evaluation](#10-evaluation)
11. [Limitations and future work](#11-limitations-and-future-work)
12. [Credits](#12-credits)
- [Appendix A: Environment variables](#appendix-a-environment-variables)
- [Appendix B: Repository map](#appendix-b-repository-map)

---

## 1. Introduction

### 1.1 Problem

Azentio builds software for banking, insurance, capital markets and ERP. Its clients run those products in very different conditions, and each client sees patterns that others also see but cannot confirm. A bank may notice that seasonal small-business revenue is flagged as deterioration. A second institution notices the same thing in a different market. Today those two observations never meet.

Three obstacles stand in the way:

- **Confidentiality.** A client will not share raw observations that name customers or reveal internal terms.
- **Trust.** Shared insight is only useful if the client believes it will not leak and can withdraw it.
- **Signal versus noise.** One organisation repeating itself is not independent evidence.

### 1.2 Approach

The project treats sharing as an explicit, reviewed, reversible step rather than a side effect of saving:

1. **Capture.** A client member records an observation. It is a private draft, visible only to its author.
2. **Consent.** The author decides separately whether to store it, propose it for sharing, attribute it, or allow model training. Saving never shares.
3. **Review.** A learning moderator reads submitted items, can ask for clarification, redact, approve or reject.
4. **Publish a reviewed copy.** Approval creates a *shared copy*: a de-identified version, separate from the private source.
5. **Aggregate.** Shared copies are grouped into themes by topic, offering and month. A theme is shown only when at least `MIN_DISTINCT_ORGS` (default 3) distinct organisations contribute.
6. **Act.** Product owners create improvement ideas linked to approved evidence. Clients see only a short, client-facing status.
7. **Ask.** AIRA answers from approved content. External AI is used only when the user opts in, and a privacy guard blocks personal or confidential text first.

### 1.3 Scope

This is a hackathon prototype. Everything shown in the sandbox and in the screenshots below is **synthetic**. The project does not claim to run federated training or secure aggregation, and it does not make claims about real Azentio clients (see [Limitations](#11-limitations-and-future-work)).

---

## 2. Contributions

- A **learning loop** with a clear data model: private source, moderation decision, de-identified shared copy, theme, idea.
- **Per-purpose consent** for store, publish, attribute, model training and semantic analysis, recorded against each contribution version.
- A **tenant-isolation and aggregation rule**: themes need three or more distinct organisations, and repeat posts from one organisation do not count as independent.
- **Deny-by-default authorization** driven by one policy table, with scoped role grants, entitlements and time-boxed support access.
- **AIRA**, a retrieval-first assistant with a privacy guard, per-request consent for external AI, and a local answer when the provider is unavailable.
- A **self-serve sandbox**: verified users pick one role and get a seeded, synthetic workspace that exercises the internal portals.
- **Branded transactional email** rendered from Handlebars templates, built from the request origin.
- A **Jest suite of over 2,500 tests** covering authorization, services, routes, configuration, email, onboarding, AIRA and key components.

---

## 3. System overview

The application has three layers that the reader will meet in this order.

| Layer | What it is | Where |
|---|---|---|
| Public site | Marketing site, products, solutions, insights, hackathon pages, sign-in, and the AIRA widget | `app/(public)` |
| Portal | Five role-based areas: client, employee, moderator, product owner, admin | `app/portal` |
| Services and data | Route handlers, domain services, authorization, Postgres schema | `app/api` |

### 3.1 Technology

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `cacheComponents`), React 19 |
| Styling | Tailwind CSS v4 |
| Motion | GSAP 3, on the public site only |
| Database | Supabase Postgres through the `pg` pool. No ORM |
| Authentication | Better Auth, email one-time code, sent through Gmail SMTP |
| AI | OpenAI-compatible client pointed at NVIDIA, configured only by environment |
| Validation | `zod` at every API boundary |
| Email | Nodemailer with Handlebars templates |
| Tests | Jest 30, React Testing Library |

---

## 4. Installation

### 4.1 Prerequisites

- Node.js 20.9 or newer, and npm
- A Postgres database. The project uses Supabase; any Postgres 15+ works
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) for sign-in codes (optional for the demo personas)
- An NVIDIA-compatible API key for external AIRA answers (optional)

### 4.2 Steps

```bash
git clone <repository-url>
cd azentio-sps
npm install
```

Create `.env.local` (it is gitignored). A working minimum is:

```bash
DATABASE_URL=postgresql://...        # Supabase connection string (direct or pooler)
BETTER_AUTH_SECRET=<random string>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<you@gmail.com>
SMTP_PASS=<google app password>
SMTP_FROM=<you@gmail.com>
DEMO_ONBOARDING=true                 # lets verified users join the sandbox
```

Add `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` if you want AIRA to call the external model. All three are required together; there are no defaults. The full list is in [Appendix A](#appendix-a-environment-variables).

### 4.3 Database

Apply the schema once to an empty database, in this order, using the Supabase SQL editor or `psql`:

1. `app/api/(db)/schema/initial.sql`
2. `app/api/(db)/schema/better-auth.sql`

`initial.sql` is a one-time bootstrap. It creates row-level-security policies that are not idempotent, so **do not run it twice** on the same database. To bring an older database up to date, apply `app/api/(db)/schema/runtime-alignment.sql`, which is transactional and safe to repeat. If the database also holds another application's tables, leave them alone.

Optionally load the multi-organisation judging dataset (synthetic, deterministic, idempotent):

```bash
DATABASE_URL=... npx tsx scripts/seed.ts
```

### 4.4 Run

```bash
npm run dev          # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Jest suite |
| `npm run test:coverage` | Jest with coverage |

> Editing `app/globals.css` does not hot-reload under the Tailwind loader. If styles look stale, stop the server, run `rm -rf .next`, and start again.

---

## 5. Architecture

### 5.1 Layout

```
app/
  (public)/        Public site: Header, Footer, AIRA widget
  portal/          Signed-in portal, one area per role
  onboarding/      A verified user picks one demo role
  workspace/select Switch between organisations; create a demo workspace
  invite/[token]/  Accept an invitation
  api/
    v1/            HTTP route handlers (thin: parse, authorize, call a service)
    (services)/    Business logic, one folder per domain
    (db)/          Postgres pool and schema
  (ui)/            Components and the GSAP motion kit
  (config)/        Navigation, personas, onboarding roles, sandbox demos, content
  (common-lib)/    Shared types, zod schemas, typed errors
proxy.ts           Optimistic cookie redirects only. Never an authorization boundary
scripts/seed.ts    Deterministic synthetic seed
tests/             Jest suites by area
```

Route handlers are deliberately thin. Each parses its input with `zod`, loads the session, calls `authorize()`, hands the work to a service, and shapes the response. Services use parameterised SQL and wrap multi-statement changes in a transaction.

### 5.2 Data model

The tables fall into a few groups. Every tenant-owned row carries an `org_id`.

| Group | Tables |
|---|---|
| Tenancy and identity | `organizations` (type `azentio` or `client`, `is_sandbox`), `users`, `memberships`, `role_grants`, `invitations`, `entitlements` |
| Contributions and consent | `contributions`, `contribution_versions`, `consents`, `moderation_decisions`, `reports` |
| Shared learning | `shared_copies`, `shared_copy_comments`, `shared_copy_feedback`, `shared_copy_bookmarks`, `shared_copy_embeddings`, `client_saved_searches` |
| Themes and ideas | `themes`, `theme_evidence`, `improvement_ideas`, `idea_evidence`, `idea_status_history` |
| Notifications and mail | `notifications`, `notification_outbox`, `email_outbox` |
| Staff and platform | `employee_experiments`, `employee_knowledge_items`, `employee_hackathon_teams`, `release_notes`, `broadcast_sessions`, `client_resources`, `public_content_items`, `public_submissions`, `support_access`, `client_support_tickets`, `sandbox_runs` |
| Audit | `audit_log` |

Two properties matter most:

- **`audit_log` is append-only.** Database triggers reject `UPDATE`, `DELETE` and `TRUNCATE`.
- **Every application table has row-level security enabled with deny policies** for the Supabase `anon` and `authenticated` roles. The application reaches Postgres through its own privileged connection, so these policies protect against stray client keys, while the real boundary is the server-side authorization below.

### 5.3 The learning loop

```
client member
   │  records observation (private_draft) + per-purpose consents
   ▼
contributions + contribution_versions  ── private source, author only
   │  submit
   ▼
learning moderator reviews ── clarify / redact / approve / reject
   │  publish reviewed copy
   ▼
shared_copies  ── de-identified, withdrawable, no tenant ids
   │  grouped by topic + offering + month
   ▼
themes  ── visible only when ≥ MIN_DISTINCT_ORGS distinct organisations
   │  product owner links approved evidence
   ▼
improvement_ideas  ── status + short client-facing update
```

Withdrawing a contribution or revoking consent removes the shared copy from search, themes and AIRA retrieval.

### 5.4 Authorization

`getSession()` loads the user, memberships, role grants and the active workspace. `authorize({ action, resource })` is the single decision point. It is driven by one `POLICIES` table, and **unknown actions are denied**. In order, it checks that:

1. a session exists;
2. the action is registered in `POLICIES`;
3. the resource belongs to the active workspace (or the caller holds a global grant, or a valid support grant);
4. an active membership exists;
5. the caller holds a role in scope, either through the membership role or through a `role_grants` row;
6. where the policy requires it, the organisation is entitled to the offering.

Portal admin is a platform-wide grant only. A portal admin cannot read private client content unless a time-boxed, audited `support_access` row exists. `proxy.ts` redirects on the presence of a cookie for convenience and is never relied on for access control.

### 5.5 Sign-in modes

1. **Real sign-in.** Email one-time code through Better Auth. Only provisioned or invited addresses receive a code, unless `DEMO_ONBOARDING=true`.
2. **Demo personas.** The login page offers 20 preset personas. Choosing one sets a cookie and shows static synthetic previews with no database writes.
3. **Demo onboarding.** With `DEMO_ONBOARDING=true`, a verified user picks **one** role and joins a shared synthetic sandbox workspace.

### 5.6 Email

Sign-in codes, invitations, notifications and digests are rendered from Handlebars templates in `app/api/(services)/email/templates/`. Colours and fonts come from the Azentio tokens in `brand.ts`. Every link is built from the request origin, never from a hard-coded domain. The logo travels inside the message as an inline attachment, because mail clients cannot show SVG or reach `localhost`. Delivery goes through an outbox with retry and backoff.

---

## 6. Personas and access model

The login page lists 20 demo personas in three groups. They are fictional and exist to demonstrate access boundaries.

### 6.1 Azentio staff

| Persona | Role | What the role is for |
|---|---|---|
| Dana Whitfield | Employee | Internal tools: playground, knowledge, experiments, hackathon teams. Denied on moderation, publishing and admin |
| Marcus Oyelaran | Content publisher | Public content, banners, live sessions and release notes. No learning access |
| Ines Calderon | Learning moderator | Reviews, redacts, publishes or rejects submissions. Cannot read unsubmitted drafts |
| Tomas Reiniger | Product owner (FAI) | Creates improvement ideas from approved evidence for his offering. Never sees raw client text or organisation names |
| Sunita Varghese | Portal admin | Manages organisations, role grants and entitlements. Cannot open private client content without audited, time-limited support access |

### 6.2 Client users

Each belongs to a single organisation and sees only that organisation's data.

| Persona | Organisation | Role |
|---|---|---|
| Amira Haddad | Harborline Commercial Bank | Client member |
| Rahul Menon | Harborline Commercial Bank | Client admin |
| Tariq Bashir, Elena Voss | Sandune Finance | Client admin, client member |
| Wira Santoso, Mei Lan Tran | Kestrel Peak Microfinance | Client admin, client member |
| Grace Adeyemi | Northmere Mutual | Client admin (the isolation target) |
| Hana Berg | Emberfield Capital | Client admin with no entitlements, so empty states only |

### 6.3 Edge cases

These personas exist to prove that access is *denied* when it should be.

| Persona | Case |
|---|---|
| Priya Natarajan | Member of two organisations, so she must use the workspace switcher |
| Omar Rahim | Revoked member: sign-in must fail |
| Kofi Mensah | Verified `@azentio.com` email with no grant: denied |
| Finance Lead | Same email domain as Harborline but no invitation: must not auto-join |

### 6.4 Roles and where they land

| Role | Portal area |
|---|---|
| `client_member`, `client_admin` | Client |
| `employee` | Employee |
| `content_publisher` | Employee tools for live sessions, content and release notes |
| `learning_moderator` | Moderator |
| `product_owner` | Product owner |
| `portal_admin` | Admin |

`client_admin` additionally sees the Team page, where members are invited and revoked.

---

## 7. Using the application

The server runs on **port 3000**. Open `http://localhost:3000`.

### 7.1 Two ways to explore

- **Demo personas (no sign-up, no database writes).** Go to `/login`, open the demo tab, and choose a persona. You land in that role's portal with synthetic previews. This is the fastest way to see every role.
- **The sandbox (a real session against synthetic data).** Set `DEMO_ONBOARDING=true`, go to `/login`, and sign in with your email and the one-time code. The first time, you pick **one** role. You join the shared **Azentio Shared Demo** workspace, which is seeded with synthetic starter data for every internal portal. Each account can try one role.

> **The sandbox is shared.** Activity is visible to other demo members. Use synthetic examples only. Never enter customer names, account numbers, credentials or confidential information.

![Sign in](readme-assets/screenshots/public-login.png)

### 7.2 What the sandbox seeds

When the shared workspace is first created, the app adds:

- entitlements for four sandbox demos (FAI, Lending, AMLOCK, Insurance);
- three client contributions in different states (a private draft, a submitted item, one needing clarification);
- synthetic analyst submissions for the moderator queue;
- two improvement ideas, an employee experiment, a knowledge article and a hackathon team;
- a published page, a draft announcement and two live-session records.

Every join also ensures one approved shared example with a seasonality theme, three client-facing release notes, a welcome notification and an audit entry.

A client admin can open the workspace switcher in the header to move between workspaces, create another demo workspace they administer (up to five), and invite colleagues from the Team page.

### 7.3 Client portal

*Sign in as Amira Haddad or Rahul Menon (or choose the Client member or Client admin role in the sandbox).*

| Page | What you can do |
|---|---|
| Dashboard | See your observations, what needs attention, entitled demos, ideas and briefings |
| Observations | List your own contributions. Drafts are visible only to you |
| New observation | Choose a scope (only me, my organisation, or propose for shared learning), set each consent, save a draft or submit |
| Shared learning | Search and bookmark reviewed copies, save searches, comment, give feedback or report a copy |
| Themes | Read community themes that cleared the three-organisation threshold |
| Ideas | Follow improvement ideas and their client-facing status |
| Demos | Run a synthetic demo for each entitled offering |
| Resources, Release notes | Assigned guides and published product updates |
| Support | Raise a request and follow its status |
| Team (client admin) | Invite a member or admin, revoke access, revoke pending invitations |

![Client dashboard](readme-assets/screenshots/client-dashboard.png)

![New observation with per-purpose consent](readme-assets/screenshots/client-new-observation.png)

![Shared learning](readme-assets/screenshots/client-shared-learning.png)

![Community themes](readme-assets/screenshots/client-themes.png)

![Improvement ideas](readme-assets/screenshots/client-ideas.png)

![Sandbox demos](readme-assets/screenshots/client-demos.png)

![A synthetic FAI demo](readme-assets/screenshots/client-demo-fai.png)

![Release notes](readme-assets/screenshots/client-release-notes.png)

![Support](readme-assets/screenshots/client-support.png)

![Team and invitations](readme-assets/screenshots/client-team.png)

### 7.4 Employee area

*Sign in as Dana Whitfield, or choose the Employee role.*

| Page | What you can do |
|---|---|
| Dashboard | Quick links into internal tools |
| Playground | Run guided synthetic experiments and give feedback |
| Knowledge | Read internal guides with owners and review dates |
| Live | Join sessions or watch recordings; a publisher can schedule, go live and publish recordings |
| Experiments, Hackathon teams | Submit an experiment; create, join or leave a team and post updates |
| Content, Release notes | A publisher manages announcements, pages and release notes |

![Employee dashboard](readme-assets/screenshots/employee-dashboard.png)

![Playground](readme-assets/screenshots/employee-playground.png)

![Knowledge](readme-assets/screenshots/employee-knowledge.png)

![Live sessions](readme-assets/screenshots/employee-live.png)

![Content (publisher)](readme-assets/screenshots/employee-content.png)

![Release notes (publisher)](readme-assets/screenshots/employee-release-notes.png)

### 7.5 Moderator

*Sign in as Ines Calderon, or choose the Learning moderator role.*

| Page | What you can do |
|---|---|
| Overview | Counts for items awaiting review, sensitive-content flags and open reports; refresh themes |
| Review queue | See submitted items and those waiting for clarification |
| Review | Request clarification, approve, reject, publish a reviewed (de-identified) copy, or suspend a shared copy |
| Reports | Triage reports against shared copies |
| Audit | Read the append-only audit log |

![Moderator overview](readme-assets/screenshots/moderator-dashboard.png)

![Review queue](readme-assets/screenshots/moderator-queue.png)

![Audit log](readme-assets/screenshots/moderator-audit.png)

### 7.6 Product owner

*Sign in as Tomas Reiniger, or choose the Product owner role.*

| Page | What you can do |
|---|---|
| Overview | See visible themes, ideas and what is under review |
| Themes | Read the themes visible to the owner |
| New idea | Create an idea linked to approved evidence in your assigned offering |
| Idea | Update status and the short client-facing update |

![Product owner overview](readme-assets/screenshots/product-owner-dashboard.png)

![Themes for the owner](readme-assets/screenshots/product-owner-themes.png)

![Create an idea](readme-assets/screenshots/product-owner-new-idea.png)

### 7.7 Portal admin

*Sign in as Sunita Varghese. Portal admin is not available through the self-serve sandbox.*

| Page | What you can do |
|---|---|
| Overview | See organisations, users, role grants and pending invitations; grant or revoke roles |
| Organisations | Create an organisation, change its status, manage entitlements, grant temporary support access, manage client resources |
| Public submissions | Triage demo requests and hackathon registrations |
| Support tickets | View tickets for organisations with active support authorisation |

![Admin overview](readme-assets/screenshots/admin-dashboard.png)

![Organisations](readme-assets/screenshots/admin-organizations.png)

![Support tickets](readme-assets/screenshots/admin-support-tickets.png)

> Screenshots in this section were captured with the demo personas, so they show synthetic previews. Signing in to the sandbox shows the same screens backed by database rows.

---

## 8. The public site and AIRA

The public site is light-only, set in Poppins, and uses a GSAP motion kit (reveal, split headings, parallax, marquee, pinned steps) that respects `prefers-reduced-motion`. The home page runs from the hero through the collaboration story, persona cards, product bento, cases, awards, stats and testimonials.

![Collaboration story](readme-assets/screenshots/public-home-story.png)

![Who it is for](readme-assets/screenshots/public-home-personas.png)

![Products](readme-assets/screenshots/public-products.png)

![Solutions](readme-assets/screenshots/public-solutions.png)

![Technology](readme-assets/screenshots/public-technology.png)

![Insights](readme-assets/screenshots/public-insights.png)

![Hackathon](readme-assets/screenshots/public-hackathon.png)

![About](readme-assets/screenshots/public-about.png)

### 8.1 AIRA

AIRA is the site's guide. Every answer follows the same path:

1. **Privacy guard.** The message and recent history are scanned for emails, payment or account numbers, IBANs, credentials and customer identifiers. On a hit AIRA asks the user to rephrase and sends nothing anywhere.
2. **Retrieval first.** A lexical search over page content plus approved shared evidence (re-checked against the database, so withdrawn copies drop out). A strong match is answered locally and **the external call is skipped**.
3. **Opt-in for external AI.** With no strong match, the message is sent to the external model only if the user ticked the consent box for this session. The route records the consent in the audit log for signed-in users.
4. **Provider call.** One NVIDIA chat completion with the retrieved context, reasoning disabled (the context is already supplied), a 30-second timeout and a token cap. If anything is missing or fails, the local knowledge engine answers instead.

Only approved, de-identified shared evidence can reach the model. Never private drafts, source payloads, tenant identifiers or reviewer notes.

![AIRA assistant](readme-assets/screenshots/public-aira-widget.png)

---

## 9. Security and privacy design

| Principle | How it is enforced |
|---|---|
| Deny by default | Every route, page and action calls `authorize()`; unknown actions are denied; navigation menus are never an authority |
| Tenant isolation | One organisation's raw observations never reach another; cross-tenant insight passes moderation and de-identification first |
| Consent is separate | Store, publish, attribute, model training and semantic analysis are distinct, per-version choices |
| Withdrawal | Withdrawing removes content from search, themes, exports and AIRA retrieval |
| Aggregation threshold | Themes need at least three distinct, non-sandbox organisations; repeat posts from one organisation are not independent evidence |
| Append-only audit | Database triggers block edits and deletes of `audit_log` |
| Sandbox separation | Demo workspaces are flagged `is_sandbox`, excluded from admin directories, the global review queue and production aggregation |
| No secrets in code | Configuration is by environment; `.env*` is gitignored; synthetic users use `@demo.invalid` |
| Outbound AI | Per-request opt-in, privacy guard first, only approved evidence as context |
| Error handling | Routes return generic messages for unexpected failures instead of raw database text |

---

## 10. Evaluation

The repository includes an automated suite of over 2,500 tests in 75 suites:

```bash
npm test
```

| Area | Folder | Focus |
|---|---|---|
| Authorization | `tests/authz` | Role and grant matrix, scope, expiry, support access, unknown and inherited action names |
| Contributions and moderation | `tests/contributions-moderation` | State machine, consent, publish copies only reviewed fields, suspend and reinstate |
| Ideas, learning, admin | `tests/ideas-learning-admin` | Themes and thresholds, ideas, invitations, role grants |
| Platform services | `tests/platform-services` | Support, broadcasts, releases, sandbox, resources, audit immutability |
| API routes | `tests/api-routes` | Status codes, validation, error shaping |
| Email | `tests/email` | Template rendering, origin-built links, outbox, backoff |
| AIRA | `tests/aira` | Privacy guard, retrieval, consent, provider flow |
| Onboarding | `tests/onboarding`, `tests/workspaces` | One role per account, starter data, workspace creation |
| Config and schemas | `tests/common-config` | Personas, content, schemas, mock data |
| UI | `tests/ui` | Role picker, persona picker, login, AIRA widget, portal kit |

The database is mocked, so the tests assert SQL fragments and parameters, not query results. They do not replace a run against a real schema. Known defects found by the suite are recorded as `it.failing` cases so they flip to a failure the moment they are fixed.

---

## 11. Limitations and future work

- **Synthetic data only.** All sandbox and demo content is invented. No claim here describes real Azentio clients.
- **Federated learning is out of scope.** The project does not run federated training or secure aggregation; it is described only as a possible future track.
- **The sandbox is open by design.** With `DEMO_ONBOARDING=true`, anyone with a working email can join the shared demo. Turn the flag off when open sign-up is not wanted.
- **Demo personas are previews.** They show static data, not database-backed behaviour.
- **Some pages are short link pages** (academy, talent journey, support, become-a-partner), because the source site redirects those URLs and the copy was not supplied.
- **Mocked-database tests** cannot catch SQL errors; an end-to-end run against a scratch schema remains the stronger check.
- **Some ideas, experiments and knowledge items are not organisation-scoped** in the demo, so demo users share the seeded ones.

---

## 12. Credits

**Built by Tech Wizards for the Azentio Hackathon, 31 October 2026.**

- **[Imran Pasha](https://github.com/powerstone666)**
- **Koora Sai Sujith**
- **Sai Surya Teja Gontumukkala**

Azentio and its product names belong to their owners. This is an independent hackathon prototype built with synthetic data.

---

## Appendix A: Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Use the Supabase session pooler for serverless |
| `SUPABASE_DB_URL` | Fallback connection string when `DATABASE_URL` is unset |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `BETTER_AUTH_ALLOWED_HOSTS` | Extra allowed hostnames for custom domains, without a scheme. `localhost:3000` is allowed in development |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail SMTP. `SMTP_PASS` is a Google App Password |
| `PUBLIC_SUBMISSIONS_TO` | Inbox for demo enquiries and hackathon registrations; defaults to the `SMTP_FROM` address |
| `DEMO_ONBOARDING` | `true` lets verified users join the shared synthetic sandbox |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | AIRA provider (NVIDIA-compatible). All three are required for external answers; no defaults |
| `AI_EMBEDDING_MODEL` | Optional embedding model for explicitly consented, reviewed shared copies |
| `MIN_DISTINCT_ORGS` | Theme threshold. Defaults to 3 and cannot be set below 3 |
| `SEMANTIC_THEME_SIMILARITY` | Semantic suggestion threshold (default `0.78`, range `0.5` to `0.99`) |
| `EMAIL_OUTBOX_JOB_ENABLED` | `true` lets the scheduled and manual outbox job run. Unset or anything else, the job returns "skipped" and sends nothing |
| `OUTBOX_JOB_TOKEN`, `CRON_SECRET` | Bearer tokens for the internal outbox job routes and the scheduled job |
| `SUPPORT_TICKETS_WEBHOOK_URL`, `SUPPORT_TICKETS_WEBHOOK_TOKEN` | Optional forwarding of real workspace support tickets. Demo-sandbox tickets are never forwarded |

`vercel.json` schedules `/api/v1/internal/email-outbox` daily at 06:00 UTC, but only on Vercel, and the job does nothing unless `EMAIL_OUTBOX_JOB_ENABLED=true`. When enabled it prepares opted-in weekly digests, moves notifications to the email outbox and attempts delivery.

## Appendix B: Repository map

| Path | Contents |
|---|---|
| `app/(public)` | Public routes: home, products, solutions, insights, technology, hackathon, about, connect, request-demo, login |
| `app/portal` | `client`, `employee`, `moderator`, `product-owner`, `admin` |
| `app/api/v1` | HTTP route handlers |
| `app/api/(services)` | Domain services: admin, aira, auth, authz, broadcasts, contributions, email, employee, ideas, invitations, learning, moderation, notifications, onboarding, public-content, public-submissions, releases, resources, sandbox, support, workspaces |
| `app/api/(db)` | `client.ts` and the schema files |
| `app/(ui)` | Components and the motion kit |
| `app/(config)` | Navigation, personas, onboarding roles, sandbox demos, scraped content |
| `scripts/seed.ts` | Deterministic judging dataset |
| `tests` | Jest suites |
| `readme-assets/screenshots` | Images used in this document |
| `AGENTS.md` | Contributor guide for people and coding agents |
