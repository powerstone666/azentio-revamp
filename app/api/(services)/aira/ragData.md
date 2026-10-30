# azentio.ai: Intelligence and Collaboration Portal (product guide for AIRA)

This document describes what the azentio.ai website and collaboration portal do. It is written for visitors, clients and employees. It contains no private client information. All demo content in the portal is synthetic.

## What azentio.ai is

azentio.ai is Azentio's public website and a secure collaboration portal. The website explains Azentio's offerings across banking, insurance, capital markets and ERP, and lets visitors request a demo or register interest in the hackathon. The portal gives employees and clients their own experiences, and turns client market observations into governed collective learning that helps improve Azentio's offerings.

## Who uses it

- **Public visitors** explore offerings, products, solutions, insights and media, and can request a demo. They see no private workspaces.
- **Employees** sign in to explore internal experiments, a guided playground, employee-only live sessions and recordings, hackathon team spaces, release notes and an internal knowledge library.
- **Clients** sign in to a workspace for their own organisation. They see the demos and content their organisation is entitled to, record market observations, and follow improvement ideas.
- **Client administrators** invite and remove people in their own organisation. They cannot grant platform roles or change another organisation.
- **Learning moderators** review proposed shared observations, ask for clarification, redact, approve or reject, and publish a reviewed copy.
- **Product owners** connect recurring themes to improvement ideas and share a status update without exposing private client information.
- **Content publishers** manage announcements, public pages, live sessions and recordings.
- **Portal administrators** manage organisations, role grants and entitlements. They cannot open private client content unless a time-limited, audited support authorisation exists.

Access is checked on the server for every request. A person's role, organisation membership, the audience of the content and their organisation's entitlements all have to allow the action. Being an employee does not make someone an administrator.

## How collective learning works

1. **Capture.** A client member records an observation. It starts as a private draft that only the author can see. Saving never shares it.
2. **Choose who can see it.** The author picks one of three scopes: private to me, within my organisation, or proposed for the approved learning community. Organisation-only content is never shared by default.
3. **Consent is separate.** The author gives or withholds each permission on its own: storing and processing the contribution, publishing a reviewed shared version, naming the author's organisation (attribution), and any future model-training programme. Joining a workspace is not consent, and one consent does not imply another.
4. **Review.** A learning moderator reads submitted observations. They can ask for clarification, redact, reject, or approve. Content is checked for sensitive details such as personal data, credentials, confidential pricing, exact dates and details that could identify one organisation.
5. **Publish a reviewed copy.** Approval creates a separate shared copy. It is de-identified by default and contains only reviewed fields. The private original stays separate and is never shown to other organisations. Organisation attribution is opt-in and must also pass review.
6. **Themes.** Reviewed copies are grouped into themes by topic, offering and month. A theme appears only when at least three distinct organisations have contributed. Repeat posts from one organisation do not count as independent evidence. A theme shows an organisation count, a period and the limits of the evidence. Popularity is not presented as proof of market prevalence or causation.
7. **Improvement ideas.** Product owners create ideas linked to approved evidence, with a title, problem statement, offering, proposed outcome, owner or team, priority and status. Statuses are Proposed, Under review, Planned, In progress, Released and Not proceeding, and every change is recorded. Contributors can see an audience-appropriate status that never exposes private source material, internal roadmaps or another client's support case.
8. **Acknowledgement.** When a contribution is used as evidence for an improvement idea, its author is told in the portal. The message does not reveal the idea's private details.

## Editing, reporting and withdrawal

- **Editing a published contribution** creates a new version and goes back for review. The earlier shared copy is paused until the new version is approved. An edit never silently widens who can see it.
- **Reporting.** Any client can report a shared item that looks misleading, confidential or inappropriate, without naming another client. A moderator can temporarily unpublish it during review, record the decision and inform the contributor.
- **Withdrawal.** An author can withdraw a contribution or revoke a consent at any time. The shared copy is removed from search, themes, exports and AIRA retrieval at once, because every request re-checks that the copy is still active. The design target is immediate effect on the next request, and in every case within 60 seconds. This covers the portal and AIRA. Material that someone has already viewed, and any copies made outside the portal, cannot be recalled automatically.

## Search and community features

Clients can search the approved shared feed and filter by offering, industry, region, observation period and topic. Counts, suggestions and exports follow the same visibility rules as the records themselves. Clients can save searches, bookmark items, comment, give feedback (useful, or needs more evidence) and report content. Comments follow the same audience rules and are subject to moderation. There are no leaderboards.

## Notifications

In-app notifications tell people about status changes: a contribution needing clarification, approved, published, rejected or withdrawn, an idea status update, a support ticket update, or an invitation to a client briefing. Email is a separate, queued channel. A queued email is never described as delivered until the mail provider has accepted it.

## Demo and sandbox

The demo sign-in lets anyone explore every role with synthetic data. A self-serve sandbox lets a verified user pick one role and join a shared demo workspace seeded with synthetic starter data. Sandbox content is visible to other demo members, is kept out of production themes and statistics, and must never contain real customer or confidential information.

## AIRA, the guide

AIRA answers questions about Azentio's offerings and about this portal. It answers from approved website content and approved, de-identified shared learning. It first looks for an answer locally. It only uses an external AI model if the user opts in for that message, and it will not send personal identifiers, account numbers or credentials to any provider. AIRA never uses private drafts, original submissions, organisation identifiers or reviewer notes.

## Privacy principles

- Deny access unless role, membership, audience and entitlement all allow it.
- One organisation's raw observations never reach another organisation.
- Insight crosses organisations only after review and de-identification.
- Shared trend statistics need at least three distinct organisations.
- Every privileged action is written to an append-only audit log.
- Everything in demo workspaces is synthetic.
