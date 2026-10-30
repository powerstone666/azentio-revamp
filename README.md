# Azentio collaboration portal

Next.js 16 application for Azentio's public site and the authenticated client and employee collaboration portal. The backend uses Better Auth email OTP, PostgreSQL through `pg`, and server-side role, workspace, audience, and entitlement checks.

## Local setup

1. Install dependencies with `npm install`.
2. Add the required values to `.env.local` (the file is gitignored).
3. Set `DATABASE_URL` to the Supabase Postgres connection string. For serverless deployments, use the Supabase pooler and keep the pooler mode compatible with transactions.
4. Configure the Google SMTP settings and `BETTER_AUTH_SECRET` before trying email sign-in. `SMTP_PASS` must be a Google App Password.
5. Apply the schema files to a new, empty database in the Supabase SQL Editor, in this order:
   - `app/api/(db)/schema/initial.sql`
   - `app/api/(db)/schema/better-auth.sql`
6. Start the app with `npm run dev`.

`initial.sql` is a one-time bootstrap file, not a migration runner. It creates RLS policies that are not idempotent. Do not apply it again to an existing database. For later schema changes, apply only the new statements and matching `ALTER ... IF NOT EXISTS` statements. Do not drop or modify tables owned by another application.

If this project database predates the current schema, apply `app/api/(db)/schema/runtime-alignment.sql` to that Azentio database. It aligns the consent-purpose constraint, adds the public-content table/indexes, and adds the rendered HTML column to the email outbox. The script is transactional and safe to reapply; it is not a replacement for the initial schema bootstrap.

The app creates the shared synthetic demo workspace and its starter records when a verified user completes demo onboarding (`DEMO_ONBOARDING=true`). All demo roles use that one sandbox workspace. Demo content is synthetic, visible to demo members, and excluded from production learning and aggregation.

The separate `scripts/seed.ts` fixture loads the multi-organisation judging dataset. It is intended for an empty judging database, not as a production seed. It uses synthetic users and organisations and sets up the three-organisation examples used by production aggregation thresholds.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Primary Supabase Postgres connection string (use the session pooler for serverless deployments) |
| `SUPABASE_DB_URL` | Local Supabase connection-string fallback when `DATABASE_URL` is unset |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `BETTER_AUTH_ALLOWED_HOSTS` | Extra allowed hostnames for custom domains |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail SMTP; `SMTP_PASS` is a Google App Password |
| `PUBLIC_SUBMISSIONS_TO` | Optional inbox for demo enquiries and hackathon registrations; defaults to the email address in `SMTP_FROM` |
| `DEMO_ONBOARDING` | Set to `true` to allow verified users to join the shared synthetic sandbox |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Optional NVIDIA-compatible AIRA provider configuration; all three are required for external answers |
| `AI_EMBEDDING_MODEL` | Optional embedding model for explicitly consented, reviewed shared copies |
| `MIN_DISTINCT_ORGS` | Production theme threshold; defaults to 3 and cannot be configured below 3 |
| `SEMANTIC_THEME_SIMILARITY` | Semantic suggestion threshold (default `0.78`; accepted range `0.5`–`0.99`) |
| `OUTBOX_JOB_TOKEN` | Bearer token for internal email and support outbox routes |
| `CRON_SECRET` | Vercel scheduled-job authorization token |
| `SUPPORT_TICKETS_WEBHOOK_URL`, `SUPPORT_TICKETS_WEBHOOK_TOKEN` | Optional external support-ticket forwarding endpoint |

Better Auth derives its base URL from the incoming request and validates the host against Vercel deployment host variables. Add custom hostnames to `BETTER_AUTH_ALLOWED_HOSTS` without a scheme. Local development automatically allows `localhost:3000`.

## Email and scheduled jobs

Transactional emails use the Handlebars templates in `app/api/(services)/email/templates/`. Sign-in codes, invitations, notifications, and saved-search digests use the request origin; no app URL is hard-coded.

Public demo enquiries and hackathon registrations are saved to the admin inbox and queued to `PUBLIC_SUBMISSIONS_TO` (or `SMTP_FROM` when unset). The app attempts delivery immediately; SMTP failures remain in the email outbox for retry.

`vercel.json` schedules `/api/v1/internal/email-outbox` daily at 06:00 UTC. It prepares opted-in weekly saved-search digests, transfers persisted in-app notifications to the email outbox, and attempts SMTP delivery. Configure `CRON_SECRET` or `OUTBOX_JOB_TOKEN` in Vercel. A queued email is not reported as delivered; only a provider-accepted send increments the sent count.

Support requests are always persisted in the portal. To forward real workspace tickets, configure both support webhook variables. Requests from the shared demo sandbox are never sent to the external webhook. Retry queued deliveries with `POST /api/v1/internal/support-ticket-outbox` and the outbox bearer token.

## Demo and privacy boundaries

- Demo persona sign-in displays static synthetic previews without database writes.
- Verified demo onboarding joins the shared database-backed sandbox, where member activity is visible to other demo members.
- Never enter customer names, account numbers, credentials, confidential terms, or other sensitive data in the demo workspace.
- Private drafts and organisation-only contributions do not enter community search, exports, themes, or AIRA retrieval.
- Production community themes require at least three distinct non-sandbox organisations. Sandbox themes are scoped to the shared demo workspace and are not production evidence.
- Federated model learning is an optional advanced track. The application does not claim to run federated training or secure aggregation.

## Useful commands

```bash
npm run dev
npm run lint
npm run build
```
# azentio-revamp
