# Project Knowledge

## Active
- 2026-10-30 opencode | M0 foundation build | area: entire repo (deps, structure, config, DB schema, types, seeds, UI foundation, authz skeleton) | sessions/2026-10-30-opencode-m0-foundation.md
- Workers launched: DB schema (ses_e7355148fffeXAIxPPRQVZ7KBl), Seed data (ses_e7355148effeB4XR0gg0vqNaep), UI motion (ses_e7355148effdvTtfTEfIPvOg0a), Authz DAL (ses_e7355148dffeLzBZfQ8snyJhBW)

## Facts
- Requirements: source.md (full PS). Design: docs/azentio-design-system.md. Public copy: docs/azentio-site-content.md.
- Plan: docs/plan/IMPLEMENTATION_PLAN.md (merged) + section plans in docs/plan/.
- Stack: Next.js 16.4.3, React 19.3, Tailwind v4. Read node_modules/next/dist/docs/ before using Next APIs.
- Next 16: middleware.ts → proxy.ts (optimistic only); authorize in DAL inside every page/Server Action/route handler; async cookies/headers/params.
- Withdrawal ≤60s: updateTag in Server Action + live DB status filter in search/AIRA; never revalidateTag(tag,'max').
- next.config.ts MUST keep `turbopack.rules['*.css']` → `@tailwindcss/turbopack` (no PostCSS config exists; without it `@theme` fails to parse) and `partialPrefetching: true` (required alongside cacheComponents).
- User-confirmed: Tailwind standard, GSAP (gsap 3.15.0, @gsap/react 2.1.2), Phosphor icons (@phosphor-icons/react), npm only.
- DB: Supabase Postgres, NO ORM (pg + parameterised SQL, migrations in supabase/migrations/). RLS on for every table with no anon policies (lock down Supabase REST). Vectors: jsonb embeddings (shared_copy_embeddings), cosine in app; only approved shared copies embedded; deleted in the withdrawal transaction.
- Auth: Better Auth via pg Pool on Supabase Postgres (real email OTP; DEMO_MODE fixed code only for seeded accounts, off in prod). Not Supabase Auth.
- AIRA + embeddings: Cohere via OpenAI-compatible API (`openai` SDK, AI_BASE_URL=https://api.cohere.ai/compatibility/v1, AI_MODEL, EMBED_MODEL). Compat mode: no `dimensions`, no native documents/citations. Never send private text to the provider. No @huggingface/transformers.
- Email: nodemailer over SMTP (local mail catcher in dev). Hosting: local only for now. Federated learning: undecided (optional after M8).
- Review fixes deferred to docs/plan/TODO.md — apply before M1.
- Demo orgs: Harborline, Sandune, Kestrel (seasonality), Northmere (attack target), Emberfield (no entitlements). All portal data synthetic.
- Agent room: .agent-room/rooms/azentio-plan (decisions/ has icon decision).

## Log
- 2026-10-30 claude | implementation plan merge | done | docs/plan/IMPLEMENTATION_PLAN.md
- 2026-10-30 codex | backend & security plan | done | docs/plan/codex-backend-security.md
- 2026-10-30 gemini | frontend & UX plan | done | docs/plan/gemini-frontend-ux.md
- 2026-10-30 claude | mock data plans | done | docs/plan/claude-mock-data-portal.md, claude-mock-data-playground.md
- 2026-10-30 claude | requirements + design capture | done | source.md, docs/azentio-*.md, docs/screenshots/, public/brand/
