# Mock data plan: azentio.ai portal seed data

Scope: plain-language plan for ALL synthetic seed data. No schema details (Codex owns backend, Gemini owns frontend). Every name, org, figure and "account number" below is invented. Employees use `@azentio.com` (required by the PS, local parts are fictional and must match the organiser-approved provisioning list). Clients use reserved `*.example` domains only. No real client from azentio.com is used.

Conventions: IDs are stable strings (`org_harborline`, `usr_amira`, `obs_01`). Anchor clock `2026-10-26T09:00:00Z`; all seeded timestamps are offsets from it. Minimum-organisation threshold for themes = **3** (config value, seeded).

## 1. Organisations

| ID | Name (fictional) | Industry | Region | Size | Entitled offerings (active) | Role in scenarios |
|---|---|---|---|---|---|---|
| org_harborline | Harborline Commercial Bank | Banking | GCC | Large (5k+ staff) | Lending, Digital, Financial Analysis Intelligence (FAI), AMLOCK Transaction Monitoring. iMAL: pending request (not active) | Seasonality #1; main client demo org |
| org_sandune | Sandune Finance Company | SME lending / NBFC | Levant / Middle East | Mid (500-1k) | Lending, Factoring, FAI | Seasonality #2; has a revoked member |
| org_kestrel | Kestrel Peak Microfinance | Microfinance | South East Asia | Small (100-250) | Lending, Digital, FAI | Seasonality #3; pending invitation |
| org_northmere | Northmere Mutual Insurance | Insurance | East Africa | Mid | Insurance (General, Claim automation), Orion ERP Financial cloud | Cross-tenant attack target (private canary data); not in seasonality |
| org_emberfield | Emberfield Capital Partners | Capital markets | South Asia | Small | NONE (registered, onboarding) | Empty-state demo |
| org_azentio | Azentio (internal) | Vendor | Global | n/a | All (internal) | Employee audience; never a client tenant |

## 2. Users and personas

Demo login = managed email-code flow; in demo mode only, a fixed code (`DEMO_MODE=1` env, rejected in production). Judges get the table below.

| ID | Name | Email | Org / membership | Grants | Purpose |
|---|---|---|---|---|---|
| (none) | Public visitor | anonymous | none | none | Public catalogue, demo enquiry, event registration |
| usr_dana | Dana Whitfield | dana.whitfield@azentio.com | Azentio employee | employee only | Plain employee, **employee without admin** (denied on every admin/publish/moderate route) |
| usr_marcus | Marcus Oyelaran | marcus.oyelaran@azentio.com | Azentio employee | + content_publisher | Banners, public content, video audiences. No identity admin, no learning access |
| usr_ines | Ines Calderon | ines.calderon@azentio.com | Azentio employee | + learning_moderator | Review/redact/publish/reject. Cannot read unsubmitted drafts |
| usr_tomas | Tomas Reiniger | tomas.reiniger@azentio.com | Azentio employee | + product_owner (assigned: FAI) | Creates ideas; sees only evidence shared with him |
| usr_sunita | Sunita Varghese | sunita.varghese@azentio.com | Azentio employee | + portal_admin | Orgs, role grants, config. Has NO moderator grant: cannot open private client content without a support authorisation |
| usr_kofi | Kofi Mensah | kofi.mensah@azentio.com | none | none | Verified @azentio.com but not provisioned: sign-in succeeds, portal access denied |
| usr_amira | Amira Haddad | amira.haddad@harborline-bank.example | Harborline: client_member | | Main client member (author of seasonality post) |
| usr_rahul | Rahul Menon | rahul.menon@harborline-bank.example | Harborline: client_admin | | Invites/revokes; tries role escalation |
| usr_tariq | Tariq Bashir | tariq.bashir@sandune-finance.example | Sandune: client_admin | | Seasonality #2 author |
| usr_elena | Elena Voss | elena.voss@sandune-finance.example | Sandune: client_member | | Reads org observations |
| usr_wira | Wira Santoso | wira.santoso@kestrelpeak.example | Kestrel: client_admin | | Seasonality #3 author; pending invite sender |
| usr_mei | Mei Lan Tran | mei.tran@kestrelpeak.example | Kestrel: client_member | | Files the report against obs_19 |
| usr_grace | Grace Adeyemi | grace.adeyemi@northmere.example | Northmere: client_admin | | Victim tenant admin |
| usr_samuel | Samuel Okafor | samuel.okafor@northmere.example | Northmere: client_member | | Owns private canary content |
| usr_hana | Hana Berg | hana.berg@emberfield.example | Emberfield: client_admin | | Sees empty states only |
| usr_priya | Priya Natarajan | priya.natarajan@advisory-partner.example | Harborline: member AND Sandune: member | | **Two memberships**: forced workspace switcher, active-workspace required |
| usr_omar | Omar Rahim | omar.rahim@sandune-finance.example | Sandune: **revoked** | | Session/token must fail; his old posts stay with org, authorship hidden |
| inv_pending | (invitee) | new.analyst@kestrelpeak.example | Kestrel: invitation pending, role client_member | | Valid single-use token, 7 days |
| inv_expired | (invitee) | ravi.kumar@harborline-bank.example | Harborline: invitation expired (8 days old) | | Expired token must be refused |
| usr_suffix | (stranger) | finance.lead@harborline-bank.example | NO invitation | | Matching org email suffix must NOT auto-join |
| usr_ext | (stranger) | someone@random-mail.example | none | | Arbitrary external email: authenticated, zero membership |
| inv_wrongacct | (invitee) | sam.invited@emberfield.example | invitation addressed to this email, to be accepted by usr_ext | | Invitation accepted by another verified account is refused |

## 3. Entitlements, audiences and content

Entitlement matrix (Y active, P pending/not active, - none). Columns: iMAL / Lending / Digital / Factoring / MFund / AMLOCK / Insurance / Orion / FAI.

| Org | iMAL | Lending | Digital | Factoring | MFund | AMLOCK | Insurance | Orion | FAI |
|---|---|---|---|---|---|---|---|---|---|
| Harborline | P | Y | Y | - | - | Y (TM) | - | - | Y |
| Sandune | - | Y | - | Y | - | - | - | - | Y |
| Kestrel | - | Y | Y | - | - | - | - | - | Y |
| Northmere | - | - | - | - | - | - | Y | Y | - |
| Emberfield | - | - | - | - | - | - | - | - | - |

Content items. Audience values: public, employee, entitlement(offering), invitation(list), none (missing metadata).

| ID | Item | Audience | Who gets in | Proves |
|---|---|---|---|---|
| ct_01 | Lending product page and overview video | public | everyone | public explicitly marked |
| ct_02 | Whitepaper "Seasonality in SME credit" (synthetic) | public | everyone | public search/AIRA corpus |
| ct_03 | Public webinar "AI in credit risk" registration | public | everyone | event registration |
| ct_04 | Experiment note "FAI prototype v0.3 prompts and internal roadmap" | employee | employees (incl. Dana) | Never visible to clients, public search, AIRA |
| ct_05 | Internal broadcast "Hackathon kickoff" (live) and recording | employee | employees; only Marcus can edit | internal broadcast restricted; edit denied to Dana |
| ct_06 | FAI guided sandbox demo | entitlement(FAI) | Harborline, Sandune, Kestrel members | Northmere/Emberfield denied by URL |
| ct_07 | Lending sandbox demo | entitlement(Lending) | same three | |
| ct_08 | AMLOCK TM sandbox demo | entitlement(AMLOCK) | Harborline only | Sandune/Kestrel denied |
| ct_09 | Claims automation briefing | entitlement(Insurance) | Northmere only | Cross-tenant canary content |
| ct_10 | Webinar "Seasonality roundtable" (invitation-only) | invitation | Amira, Tariq, Wira + Ines, Tomas (host) | Entitled org member NOT on list (Elena, Mei) is denied |
| ct_11 | FAI Q3 release notes (client-safe) | entitlement(FAI) | three FAI orgs | |
| ct_12 | Internal knowledge-library page with owner and review date | employee | employees | Employee-only never enters client search |
| ct_13 | Homepage banner | public (read), publisher (write) | Marcus edits | Dana/Sunita edit denied |
| ct_14 | Recording with NO audience metadata | none | nobody (deny by default) | Public is not a fallback |
| ct_15 | Harborline client briefing (client-specific resource) | org(Harborline) | Harborline + Priya when workspace=Harborline | Priya in Sandune workspace is denied |

## 4. Contributions (observations)

Fields shown: state, scope (P private / O org / C proposed-community), consent a store, b publish reviewed copy, c attribution, d training/federated (1 = granted). Offering and period abbreviated.

| ID | Org / author | Title | Type | State | Scope | a b c d | Notes |
|---|---|---|---|---|---|---|---|
| obs_01 | Harborline / Amira | Seasonal SME revenue flagged as deterioration | market observation | Published v1 | C | 1 1 0 0 | Seasonality #1. Period Jan-Dec 2025. Evidence: portfolio review. Confidence: Medium |
| obs_02 | Sandune / Tariq | Quarter-on-quarter comparisons mis-read seasonal traders | operational challenge | Published v1 (after clarification round) | C | 1 1 1 0 | Seasonality #2. Period Jul 2024-Jun 2025. Evidence: credit-committee overrides. Confidence: High. Attribution requested, reviewer declined (rare observation), shared de-identified |
| obs_03 | Kestrel / Wira | Harvest-cycle borrowers look delinquent in monthly views | product gap | Published v1 | C | 1 1 0 1 | Seasonality #3. Period Oct 2025-Sep 2026. Evidence: field-officer anecdotes. Confidence: Low |
| obs_04 | Harborline / Amira | Early-warning signals for collections miss seasonal lulls | trend | Published v1 | C | 1 1 0 0 | Theme "Collections early warning" (see 5) |
| obs_05 | Harborline / Amira | Collections triggers fire during agreed repayment holidays | operational challenge | Published v1 | C | 1 1 0 0 | Same org as obs_04 (repeat post) |
| obs_06 | Sandune / Tariq | Arrears flags ignore agreed grace months | operational challenge | Published v1 | C | 1 1 0 0 | |
| obs_07 | Kestrel / Wira | Repayment-calendar flexibility for farmers | successful practice | Published v1; **v2 pending review** | C | 1 1 0 1 | New version pending: v2 widens wording (adds a district), v1 stays visible with "update under review" |
| obs_08 | Harborline / Amira | Alert triage queue fatigue | operational challenge | Published v1 | C | 1 1 0 0 | Theme "Alert triage" (suppressed) |
| obs_09 | Harborline / Rahul | Triage rules need per-segment tuning | improvement suggestion | Published v1 | C | 1 1 0 0 | Repeat post, same org |
| obs_10 | Kestrel / Mei | Analysts skip low-score alerts | operational challenge | Published v1 | C | 1 1 0 0 | Only 2 distinct orgs in theme |
| obs_11 | Harborline / Amira | Draft: onboarding re-request ideas | improvement suggestion | Draft | P | 0 0 0 0 | Moderator and product owner must not see it |
| obs_12 | Sandune / Elena | Sensitive-flag example (fake account number) | product gap | Submitted, flagged sensitive | C | 1 0 0 0 | Live moderation demo, see below |
| obs_13 | Kestrel / Mei | Digital onboarding drop-off at document step | trend | Needs clarification | C | 1 0 0 0 | Moderator asked for period and evidence type. Live: author answers, resubmits |
| obs_14 | Harborline / Amira | Treatment of seasonal limits in FAI commentary | improvement suggestion | Returned for edit | O | 1 0 0 0 | Author must amend (too specific). Org scope |
| obs_15 | Sandune / Elena | Seasonal traders misread in comparisons (duplicate) | market observation | Rejected: duplicate of obs_02 | C | 1 0 0 0 | Reason shown to author, link to obs_02 |
| obs_16 | Kestrel / Mei | Pricing complaint naming a specific customer | operational challenge | Rejected: unsafe | C | 1 0 0 0 | Contains fake customer name and contract rate; raw text never shown outside author and moderator |
| obs_17 | Harborline / Amira | Old KYC re-submission note | market observation | Withdrawn (was published) | C | 1 1 0 0 | Tombstone: absent from search, AIRA, themes, exports |
| obs_18 | Harborline / Amira | Digital KYC re-submission friction (token `zebra-withdraw-test`) | market observation | Published v1 | C | 1 1 0 0 | **Live withdraw test (60 s)**. No theme, unique search token |
| obs_19 | Sandune / Tariq | Claim that peer banks leak credit scores | market observation | Reported, temporarily unpublished | C | 1 1 0 0 | Reported by Mei (Kestrel) as misleading/confidential; under review |
| obs_20 | Northmere / Samuel | Claims intake fragmentation (canary `NORTHMERE-CANARY-7731`) | operational challenge | Approved, org-only (not proposed to community) | O | 1 1 0 0 | Visible to Northmere only |
| obs_21 | Northmere / Samuel | Draft with canary `NORTHMERE-PRIVATE-DRAFT-0042` | improvement suggestion | Draft | P | 0 0 0 0 | Cross-tenant and moderator-visibility tests |

### Seasonality scenario (page 11), exact content

| | obs_01 Harborline | obs_02 Sandune | obs_03 Kestrel |
|---|---|---|---|
| Observation period | Jan-Dec 2025 | Jul 2024-Jun 2025 | Oct 2025-Sep 2026 |
| Evidence type | Portfolio review | Credit-committee override log | Field-officer feedback |
| Confidence | Medium | High | Low |
| Moderator action | Redacted, published | Clarification requested, answered, redacted, published | Redacted, published |

Source vs shared text (kept in separate records; shared copy carries only reviewed fields).

| | Private source (author + moderator only) | Redacted shared text |
|---|---|---|
| obs_01 | "Our Eastern-region book of 38 date-packing and gift-retail SMEs, handled by RM Noor Qasim, drops about 60% of revenue in Q3. FAI flags every one as deteriorating. The credit committee overrode 45% of these in FY2025." | "A regional lender saw borrowers in seasonal retail and food trading show sharp revenue dips in particular quarters. Period-over-period comparisons labelled these as deterioration, and manual overrides were frequent." |
| obs_02 | "Sandune's Amman trading cohort (about 120 loans, largest client Zaytoun Wholesale) is flagged each January. We now add a manual memo to 70% of files." Clarification asked: "Which period and what evidence type? Please avoid the client name." Author reply: "Jul 2024-Jun 2025, override log." | "A non-bank lender reported that comparing a quarter with the preceding quarter mis-reads seasonal traders, and that analysts add manual explanations to a large share of files." |
| obs_03 | "In Mindanao-east, our 300 harvest borrowers look 30 days late every March per the monthly dashboard." | "A microfinance lender observed that borrowers with harvest-driven income appear delinquent in monthly views during off-season months." |

Redaction rules shown: numbers coarsened to qualitative terms, person/client/branch/district removed, region generalised, dates rounded to the period label. Attribution stays off for all three unless reviewed.

Sensitive-content example (obs_12): source text includes "...the loan for account `XX00 TEST 0000 0000 1234 56` and contact `cust.demo@example.test` was..." The scan flags the account-like pattern and email (flag reasons: account_number, contact_detail). Moderator sees highlighted spans, redacts them, still decides; scan is labelled "not a privacy guarantee". obs_12 stays Submitted until the demo.

## 5. Themes (threshold = 3 distinct orgs)

| Theme | Posts | Distinct orgs | Displayed | Notes |
|---|---|---|---|---|
| Seasonality context | obs_01, 02, 03 | 3 (Harborline, Sandune, Kestrel; hidden from viewers) | Shown: "3 organisations", periods, confidence mix (M/H/L), warning "Small sample: do not treat as market prevalence" | Links only to permitted approved evidence |
| Collections early warning | obs_04, 05, 06, 07 | 3 (4 posts, Harborline counted once) | Shown: "3 organisations" | Proves repeated posts count as 1 |
| Alert triage fatigue | obs_08, 09, 10 | 2 (3 posts, naive count passes, distinct fails) | Suppressed: "Not enough contributing organisations to show" (no counts, no excerpts to clients). Moderator and product owner see only the aggregate "below threshold" | Proves threshold uses distinct orgs |

Differencing check: if the suppressed theme's post is withdrawn or another is added, counts must not leak via filter deltas (filter combinations that isolate under 3 orgs return "suppressed").

## 6. Improvement ideas

| ID | Title | Offering | Status | Owner | Linked evidence | Client-visible text |
|---|---|---|---|---|---|---|
| idea_01 | Seasonality-aware comparison explanation | FAI | **Under review** | Tomas / FAI team | obs_01, 02, 03 | "Under review. This is not a delivery commitment." |
| idea_02 | Per-segment alert triage tuning | AMLOCK | Proposed | Tomas | Suppressed theme only (evidence: "insufficient") | Hidden until theme visible |
| idea_03 | Respect repayment holidays in collections triggers | Lending | In progress | Lending product team | obs_04-07 | "In progress" plus approved message |
| idea_04 | Auto-translate KYC re-submission prompts | Digital | Not proceeding | Digital team | obs_18 | "Not proceeding: out of current scope" (reason approved for sharing) |

Audit history seeded, e.g. idea_01: created (Tomas, T-9d), evidence linked x3 (T-9d), status Proposed to Under review (Tomas, T-7d), client-visible message approved (Tomas, T-6d). Internal-only notes (hidden from clients): "Competing with Q1 roadmap item, no date promised", "Sandune asked about timelines in ticket SUP-DEMO-114". These must never appear in client or shared payloads.

## 7. Notifications, reports, moderation decisions, audit events

Notifications (persisted outbox; email shown as `queued`, never `delivered`):

| ID | To | Event |
|---|---|---|
| ntf_01 | Amira | obs_01 published |
| ntf_02 | Tariq | obs_02 clarification requested, then published |
| ntf_03 | Wira | obs_03 published; obs_07 v2 received, pending review |
| ntf_04 | Mei | obs_13 needs clarification; obs_16 rejected unsafe; report on obs_19 received |
| ntf_05 | Amira | obs_14 returned, obs_17 withdrawal confirmed |
| ntf_06 | Elena | obs_15 rejected duplicate |
| ntf_07 | Tariq | obs_19 temporarily unpublished for review |
| ntf_08 | Harborline, Sandune, Kestrel members | idea_01 status update (theme-level) |
| ntf_09 | Rahul | invitation inv_expired expired |
| ntf_10 | Ines | New submission obs_12 flagged sensitive |
| ntf_11 | Amira | Email notification: state `queued`, provider `not_configured` |

Reports: rpt_01 on obs_19 by Mei (misleading, open, drove temporary unpublish); rpt_02 on obs_05 by Elena (inappropriate, dismissed, reason recorded); rpt_03 on a comment under obs_04 (confidential, resolved by hiding comment). Reporter identity never shown to the reported org.

Moderation decisions (with transparent reason code and reviewer-assessed evidence quality): redact+publish obs_01/02/03/04/05/06/07/08/09/10/18; request clarification obs_02 and obs_13; return obs_14; reject duplicate obs_15; reject unsafe obs_16; publish then withdraw obs_17; temp unpublish obs_19; reject attribution request (obs_02). Private reviewer notes stored separately from shared payloads.

Audit events seeded (all with actor, org, timestamp, request ID): login, invitation created/accepted/expired/revoked, membership revoked (Omar), role grant (Marcus, Ines, Tomas), entitlement request denied (Harborline iMAL), contribution state transitions (every transition above), redaction applied, consent changes, consent history, report filed/resolved, publication, unpublication, withdrawal with index invalidation timestamp, idea status changes, admin config change (Sunita), denied-access events (cross-tenant attempts, escalation attempt).

Also seed: comments with inherited audience, bookmarks, saved search "seasonality", feedback "useful / needs evidence", AIRA retrieval fixtures (public + approved shared only).

## 8. Demo script and negative tests

Judge demo order:

| # | Login | Action | Shows |
|---|---|---|---|
| 1 | Public | Browse catalogue, request demo, register for ct_03; try /client and /employee | Public boundaries |
| 2 | usr_ext | Sign in, no workspace; usr_suffix sign in | No auto-join |
| 3 | usr_hana (Emberfield) | Open dashboard | Empty state, no foreign sample data |
| 4 | inv_pending flow | Accept invitation, see terms and sharing explanation | Joining is not consent |
| 5 | usr_priya | Switch workspace Harborline to Sandune | Active workspace required, ct_15 gating |
| 6 | usr_amira | Dashboard, FAI demo, My observations, theme "Seasonality context", search `seasonality` | Entitled demo, private vs shared, small-sample warning |
| 7 | usr_tariq | Answer clarification (history) and view status; try obs_13 URL | Own tenant only |
| 8 | usr_elena then usr_ines | Elena submits sensitive text (obs_12) | Flag |
| 9 | usr_ines | Open obs_12: redact, set evidence quality, publish. Review obs_13, obs_19 | Moderation, redaction, source vs shared |
| 10 | usr_wira | Answer obs_13; edit obs_07 (v2) | New version needs review; v1 not widened |
| 11 | usr_mei | Report obs_19 | Reporting without identity disclosure |
| 12 | usr_tomas | Open idea_01 (Under review), edit status, view evidence limits | Product-owner scope, audit |
| 13 | usr_amira | See idea_01 status; no internal notes | Loop closure |
| 14 | usr_amira | Withdraw obs_18, time it, re-run search `zebra-withdraw-test`, ask AIRA | Gone from search, index, AIRA, cache within 60 s |
| 15 | usr_dana | Employee dashboard, ct_04, ct_05; attempt banner edit | Employee-only, publisher separate |
| 16 | usr_marcus | Edit banner, set ct_05 audience | Publisher grant |
| 17 | usr_sunita | Manage orgs, view audit; try to open obs_21 | Admin without content access |
| 18 | usr_rahul | Invite, revoke, try granting moderator | Escalation blocked |
| 19 | Reset | Run seed reset | Deterministic |

Negative tests enabled:

| Test | Data used | Expected |
|---|---|---|
| Cross-tenant URL/API | Amira requests obs_20, obs_21, ct_09, org_northmere ids | 404/403, no existence leak |
| Tenant ID tampering | Amira sends `org=northmere` header, body or query | Ignored, derived from session membership |
| Role escalation | Rahul grants moderator/employee/portal_admin; tampered role body; Dana calls publisher/moderation APIs | 403, audited |
| Self-enable product | Rahul requests entitlement iMAL | Stays pending, requires staff approval |
| Direct API/media | Unauthenticated GET of ct_05 recording, ct_14, ct_08 media, attachment URLs | 401/403 |
| Revoked/expired/wrong account | Omar token, inv_expired, inv_wrongacct, usr_suffix | Denied |
| Unprovisioned employee | Kofi | Denied |
| Moderator privacy | Ines opens obs_11, obs_21 drafts | Denied until submitted |
| Admin vs content | Sunita opens private observation without support authorisation | Denied, audited |
| Search/count/export parity | Elena searches, counts, exports theme "Alert triage" | Suppressed, zero leakage; exports match visible records |
| Distinct-org counting | Collections theme | Shows 3 not 4 |
| Employee-only leakage | Search/AIRA for "FAI prototype v0.3" as client/public | No results/citation |
| Missing audience metadata | ct_14 as everyone | Denied |
| Withdrawal <=60 s | obs_18 | Removed from search, vector index, AIRA, cache, theme stats |
| Payload leakage | Shared feed JSON | No tenant ID, author profile, attachments, reviewer notes, hidden metadata |
| Version widening | obs_07 v2 | Not visible until reapproved; scope unchanged |
| Invitation webinar | Elena opens ct_10 | Denied (org entitled, not invited) |

## 9. Seed format recommendation

- TypeScript modules under `app/api/(db)/seed/`: `orgs.ts`, `users.ts`, `memberships.ts` (incl. invitations), `entitlements.ts`, `content.ts`, `observations.ts` (private source and shared representations as separate exports), `themes.ts`, `ideas.ts`, `notifications.ts`, `moderation.ts`, `audit.ts`, `index.ts` (ordered loader).
- Stable human-readable IDs (as above), no `Math.random`/`Date.now`; timestamps are offsets from a fixed anchor constant. Embeddings, if any, from a deterministic hash or precomputed fixtures.
- Typed export objects validated by the backend schema (zod) before insert; referential order enforced in `index.ts`.
- Reset via `pnpm seed:reset` (truncate, then load; refuses unless `NODE_ENV!=production` and `DEMO_MODE=1`) and `seed:reset --scenario=baseline`; a second admin-only, non-prod endpoint resets live-demo records (obs_12, 13, 18, 07 v2, ct_10 state) in under 5 seconds between judge runs.
- Seed tests: idempotency (run twice, same dump), invariants (no real domains, every content item has an audience, themes derive from distinct org count, no shared payload contains a canary string from private records).
