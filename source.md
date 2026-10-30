# azentio.ai — Website & Intelligent Collaboration Portal

_Hackathon build requirements / v1.0 · azentio.ai · 29 October 2026_

**HACKATHON REQUIREMENTS**

## Build intelligence. Create shared value.

Public discovery. Employee innovation. Client collaboration.
Governed collective learning that improves our offerings.

Functional and technical requirements • Access rules • Collective learning • Acceptance tests

---

## 01 / The challenge

_Challenge brief_

Build azentio.ai as an enterprise AI website and secure collaboration portal that showcases Azentio's offerings, gives employees and clients distinct exclusive experiences, and turns client market observations into governed collective learning and product improvement.

### The experience to deliver

- A public visitor understands the offerings, explores product information and media, and requests a demo or registers interest in a hackathon.
- An employee signs in, explores internal experiments and employee broadcasts, and contributes to innovation within their permissions.
- A client signs in to an organisation-specific workspace, accesses entitled demos and content, and contributes market observations with an explicit sharing choice.
- A moderator reviews proposed shared observations. Approved, appropriately de-identified contributions become searchable learning for authorised participants.
- A product owner connects recurring themes to improvement ideas and communicates status without exposing a client's private information.

### Reference and status

Reference prototype: https://azentio-ai-ipad.ssaha999.chatgpt.site/. Reuse its visual direction, routes and existing content where useful. The current prototype has public Admin, Playground and Live access; that is a demonstration convenience, not the security model for this challenge. The target portal must enforce access on the server, including direct API and media requests.

---

## 02 / Scope, terminology and success

_Scope & outcomes_

### Two different types of learning

| Capability | What it means in this challenge |
|---|---|
| Collective learning hub | Clients submit observations, trends and suggestions; reviewed contributions and safe summaries are shared with authorised participants. This is the required community workflow. |
| Federated machine learning | Separate client environments train locally and send governed model updates for aggregation. Raw client training records remain local. A discussion board or central document repository is not federated machine learning. |
| AI-assisted synthesis | AIRA or an insight service summarises permitted evidence and cites approved contributions. Retrieval and summarisation do not, by themselves, retrain a model. |

### Outside the minimum scope

Do not build the actual credit, reporting or document-processing products represented by the catalogue. Demonstrate approved sandbox workflows with synthetic data. Production customer-system integrations, billing, deployment of client-trained models and regulatory certification are not hackathon prerequisites.

---

## 03 / Personas and access boundaries

_Identity & permissions_

| Persona / role | Permitted experience | Boundary |
|---|---|---|
| Public visitor | Public catalogue, solutions, approved media, insights, about, demo enquiries and event registration. | No private workspaces, client observations, internal broadcasts or configuration writes. |
| Employee | Internal dashboard, employee Playground, internal learning, employee broadcasts, and assigned collaboration work. | Verified work identity plus approved membership; no automatic access to every client's private information. |
| Client member | Own-organisation workspace, entitled demos and sessions, own/team observations and approved shared learning. | Tenant and entitlement checks on every protected resource; no employee-only experiments. |
| Client administrator | Manage invitations and approved roles within their own client organisation. | Cannot grant platform roles, change another tenant or self-enable restricted products. |
| Learning moderator | Review submitted contributions, redact proposed shared copies, publish, reject, withdraw or investigate reports. | No unrestricted access to unsubmitted client-private drafts. |
| Content publisher | Manage website banners, public content and permitted video audiences. | No identity administration or implicit access to private learning records. |
| Portal administrator | Manage organisations, role grants, configuration and operational controls. | Privileged actions are audited. Access to private client content requires an explicit support/moderation authorisation, not merely a broad UI role. |

**IAM-01** Implement server-side role-based access control plus tenant membership, resource audience and product entitlement checks. A user may have multiple memberships; require an explicit active workspace when needed. Never derive authority from a navigation menu, localStorage flag, email suffix alone or user-supplied tenant ID.

**IAM-02** Use least-privilege defaults. Employee status must not imply administrator access. Permissions to publish videos, moderate learning, invite users and change roles are separate grants. Deny access unless the required permission and audience conditions are satisfied.

> **Required access rule**
>
> An authenticated user may access a resource only when its audience permits their identity, their active tenant/membership is valid where applicable, and the requested action is authorised. Public resources are explicitly marked public; they are not a fallback for missing access metadata.

---

## 04 / Login, onboarding and session lifecycle

_Authentication_

Employees sign in with an identity verified for @azentio.com and an approved employee membership. Preferred production integration: Microsoft 365 / Entra ID through OIDC. Organisational application registration is unavailable, use a real managed email-code/magic-link identity flow and organiser-approved employee provisioning.

Clients join by invitation or an approval workflow tied to a registered client organisation. A client administrator may invite users only into their own organisation, within approved policies. An account with an arbitrary external email must not create a trusted tenant membership automatically.

### First-time client journey

- Receive a single-use, expiring invitation identifying the organisation and proposed role.
- Verify identity using the configured provider; accept the invitation only for the intended verified account.
- Review workspace terms and the learning-sharing explanation. Joining a workspace is not consent to share or train on client data.
- Enter the correct client dashboard with only entitled features. Display the active organisation and a workspace switcher for authorised multi-membership users.

---

## 05 / Exclusive employee experience

_Employee portal_

- Provide an employee dashboard with quick links to internal Playground, internal Live sessions, experiments, assigned improvement ideas and permitted collective-learning work. Separate public product information from internal prototype notes and employee-only sessions.
- Enable a guided Playground using synthetic scenarios: choose an offering, inspect inputs, run a deterministic or AI-assisted demonstration, review evidence and provide structured feedback. Clearly label sample data and simulated outputs. Do not imply that a sandbox recommendation is an approved credit or business decision.
- Internal live broadcasts and recordings must be restricted to the configured employee audience. Employees with a publishing grant can configure sessions and recordings; ordinary employees cannot change broadcasts or homepage content.
- An assigned product owner can review approved themes, create an improvement idea, link supporting contributions and update its status. Assignment grants access only to the evidence explicitly shared for that purpose.
- Add employee experiment submissions, hackathon team spaces, release notes and an internal knowledge library with owners, review dates and feedback loops. Employee-only content must never enter public/client search or AIRA responses.

---

## 06 / Exclusive client experience

_Client portal_

- Provide a client dashboard showing the active organisation, entitled offerings, approved product demonstrations, relevant sessions, contribution status and improvement ideas visible to that client. Show empty states when no entitlements or events are assigned; do not expose another tenant's data as sample content.
- Provide entitled sandbox demonstrations with synthetic data or explicitly approved client data. Isolate runs, uploaded evidence and saved scenarios by tenant and user permission. A client cannot access employee-only models, prompts, internal roadmaps or experimental tools simply by knowing their URLs.
- Enable My observations and, where permitted, Our organisation's observations. Users can save drafts, submit for review, follow status, amend a returned submission and withdraw a shared contribution. Private organisation knowledge and the cross-client shared feed must be visually and technically distinct.
- Clients can browse and search approved shared observations and safe aggregated themes. Filters should include offering, industry, region, observation period and topic. Search, counts, suggestions and exports must apply the same visibility rules as the underlying records.
- Client administrators can invite or revoke members and grant approved client roles within their own organisation. Display membership and invitation states. Prevent escalation to employee, moderator, publisher or portal-administrator roles.
- Show relevant improvement ideas with a plain-language status, owner/team and last update. Public or shared status must not disclose private client tickets, internal prioritisation discussions or delivery commitments that have not been approved.
- Add saved searches, bookmarks, notifications, collaborative comments, contribution acknowledgements, support-ticket integration and client-specific resources. Comments and attachments inherit the parent resource's audience; moderation and reporting apply to them too.

### Suggested client-exclusive features

- Entitled product sandboxes and guided demonstrations.
- Client briefings, release notes and invitation-only webinars.
- Private contribution tracking and organisation administration.
- Approved cross-client learning, safe trend digests and improvement-status updates.

---

## 07 / Observation capture and evidence

_Federated insights & collective learning_

- Create a structured contribution form for market observations, emerging trends, product gaps, operational challenges, successful practices and improvement suggestions. Start with a private draft. Never make a contribution shared merely because the user clicked Save.
- Validate required fields and input lengths on both client and server. Provide draft, submit, edit-returned and withdraw actions. Attachments, if supported, require type/size limits, private storage and the same audience controls as the record; teams may omit attachments in P0 and support links instead.
- Prompt users to exclude customer identities, account numbers, transaction-level data, credentials, confidential contractual terms and other restricted information. A warning or automated scan is not a privacy guarantee. Flag likely sensitive content for review before any shared publication.

---

## 08 / Review, publication and withdrawal

_Learning workflow_

- Implement the lifecycle below with explicit allowed transitions and audit events. Keep the original private source separate from the approved shared representation. A published copy must contain only reviewed fields, not the source's hidden metadata or attachments.
- Moderators can redact, request clarification, reject duplicates or unsafe material, and publish an approved version. Notify the author in-app of state changes. Material edits to a published contribution create a new version and require renewed review; never silently widen an audience.
- Include a report-contribution action for misleading, confidential or inappropriate content. The moderator can temporarily unpublish during review, record the decision and inform the contributor. Do not require the reporting client to disclose another client's identity.
- Withdrawal must invalidate search/index/cache entries and future AIRA retrieval. Demonstrate this synchronously or within 60 seconds in the judging environment. State the production propagation SLA. Explain that already viewed material and third-party copies cannot be recalled automatically.

> _Note: the PDF refers to "the lifecycle below", but no lifecycle diagram or state list is included in the document._

### Notification discipline

Use persisted notification/outbox records and idempotent delivery when email is added. In-app status is required in P0; provider-backed email is P1. A successful submission, stored notification or queued email must not be labelled "email delivered".

---

## 09 / Sharing, consent and confidentiality

_Trusted collaboration_

Present clear sharing choices: private to author, within my organisation, or proposed sharing with the approved learning community. Organisation-only content must never become shared by default. Broadening visibility requires explicit author permission and moderation.

Record separate permissions for (a) storing/processing a contribution, (b) publishing its reviewed shared representation, (c) disclosing author/organisation attribution and (d) any future training or federated-learning programme. Membership, publishing consent and model-training consent are not interchangeable.

### Cross-client publication rules

- Keep tenant IDs, private author profiles, original attachments and internal reviewer notes out of shared response payloads.
- Use de-identified wording by default. Organisation attribution is opt-in and must also pass review. Removing a name alone does not make a rare observation anonymous.
- Reduce overly specific geography, dates or unusual transaction details that could identify a contributor or customer.
- Do not share confidential client pricing, customer-level financial records, secrets or other restricted information. Use synthetic data throughout the hackathon.
- Keep raw private records out of shared analytics, vector indexes, logs and AI provider payloads unless the applicable policy explicitly permits that specific processing.

Show the contributor who can see each version and how it may be used. Make withdrawal accessible. Retain consent history, the approved version and moderation decisions according to a documented policy; do not invent a claim that withdrawal can undo an already trained model.

### Aggregation safeguards

Use a configurable minimum number of distinct contributing organisations for shared trend statistics. For judging, use at least three synthetic client organisations. A production threshold, suppression policy and any stronger privacy controls must be approved before launch. Suppress small cohorts, sensitive breakdowns and differencing-friendly filters; a minimum cohort size alone is not a privacy guarantee.

---

## 10 / Turn learning into better offerings

_Insights & improvement loop_

- Provide a searchable approved feed and a basic theme dashboard. Display the theme, relevant offerings, supporting approved contributions, observation period, number of distinct contributing organisations where safe, confidence/limitations and latest update. Never count repeated posts from one organisation as independent cross-client evidence.
- Product owners can create an improvement idea linked to permitted evidence. Fields: title, problem statement, offering, supporting contribution references, proposed outcome, owner/team, priority, status and last update. Use statuses such as Proposed, Under review, Planned, In progress, Released and Not proceeding. Status changes must be audited.
- Close the loop with contributors through an audience-appropriate status update. Shared messages may describe a theme and an improvement decision; they must not expose private source material, confidential internal roadmaps or another client's support case.

### Illustrative end-to-end scenario

- Three fictional client organisations submit observations about inconsistent treatment of seasonal SME cash flow. Each submission has an observation period, evidence type and confidence label.
- A moderator removes identifying details, requests one clarification and publishes approved shared versions.
- The dashboard groups the observations into a "Seasonality context" theme with links to the permitted evidence and a warning that the sample is small.
- A product owner creates an idea for Financial Analysis Intelligence: add a seasonality-aware comparison explanation. The idea is Under review, not a promised delivery.
- Clients see the shared theme and its status. Private drafts and moderation notes remain private. No product model changes automatically.

Add semantic clustering, duplicate detection, trend-change summaries, subscription digests and assisted prioritisation. Generated themes must preserve evidence links and uncertainty; popularity alone must not be presented as market prevalence or proof of causation.

Support quality feedback such as useful / needs evidence, transparent moderation reasons and reviewer-assessed evidence quality. Avoid leaderboards that pressure clients to disclose sensitive information or reward posting volume over contribution quality.

---

## 11 / Optional federated model-learning track

_Advanced track / P2_

Demonstrate genuine federated training only as an explicitly separate, opt-in programme. Each participating client environment keeps its training records local and runs an approved training/evaluation job. A coordinator aggregates eligible model updates and records a candidate model version. Centralising observations and training on them is not federated training.

### Minimum credible demonstration

- Use at least three separately isolated synthetic client datasets and document the learning task, model, feature schema and compatibility assumptions.
- Show local training, an aggregation round, and a global evaluation on a separate synthetic holdout. Report participation, weighting method and metrics against a simple baseline.
- Log programme consent, participants, model/update versions, aggregation method and evaluation outcomes. Keep training examples out of coordinator logs and payloads.
- Include validation of client updates, a failed/dropout participant scenario, and an explanation of how skewed client distributions affect the result.
- Register the aggregate model as a candidate. Require human review and an explicit deployment decision; provide a rollback design.

Document the threat model: model updates can leak information, and malicious clients can poison training. Local raw data retention is useful but does not automatically provide confidentiality, anonymity or regulatory compliance.

Describe or implement authenticated participants, minimum cohort participation, secure aggregation where applicable, bounded/clipped updates, poisoning checks and an appropriate differential-privacy design with declared accounting if used. Label simulated controls honestly. A plain averaging demo must not claim secure aggregation or formal privacy guarantees.

Define withdrawal and model lineage policies. Withdrawal prevents future participation and update use according to programme rules; any treatment of already aggregated or deployed models requires an explicit policy. Do not promise automatic "untraining".

---

> _Note: the cover page lists "Acceptance tests", but the 12-page PDF contains no acceptance-test section._
