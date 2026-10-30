import 'server-only';

/**
 * Knowledge Base for AIRA (Website Guide Chatbot)
 * Extracted and structured directly from source.md and azentio site specifications.
 */

export interface KnowledgeChunk {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  url?: string;
}

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    id: 'overview-challenge',
    title: '01 / The Challenge & azentio.ai Mission',
    category: 'Mission & Overview',
    keywords: ['challenge', 'mission', 'overview', 'azentio.ai', 'portal', 'brief', 'public visitor', 'employee', 'client'],
    url: '/about',
    content: `azentio.ai is an enterprise AI website and secure collaboration portal that showcases Azentio's BFSI software offerings, gives employees and clients distinct exclusive experiences, and turns client market observations into governed collective learning and product improvement.
Core experiences include:
- Public visitor: explores offerings, product information and media, requests a demo, or registers for hackathon events.
- Employee: signs in (@azentio.com), explores internal Playground experiments and employee broadcasts.
- Client: signs in to organisation-specific workspace, accesses entitled sandboxes, and contributes market observations with explicit sharing choices.
- Learning moderator: reviews proposed shared observations, applies redactions, and publishes safe community learning.
- Product owner: connects recurring themes to improvement ideas and communicates status without exposing client private data.`,
  },
  {
    id: 'scope-terminology',
    title: '02 / Scope & Two Types of Learning',
    category: 'Architecture & AI',
    keywords: ['collective learning', 'federated learning', 'aira', 'synthesis', 'difference', 'scope', 'machine learning'],
    url: '/technology',
    content: `Azentio distinguishes between different types of learning:
1. Collective learning hub: Clients submit observations, trends, and product gap suggestions. Reviewed, de-identified contributions and safe summaries are shared with authorized participants.
2. Federated machine learning: Separate client environments train locally and send governed model updates for aggregation. Raw client records stay local. Centralizing documents is NOT federated learning.
3. AI-assisted synthesis (AIRA): An insight service that summarizes permitted evidence and cites approved community contributions without retaining private data.
Note: Hackathon demonstrations use approved sandbox workflows with synthetic data.`,
  },
  {
    id: 'personas-boundaries',
    title: '03 / Personas & Server-Side Access Boundaries',
    category: 'Security & Access Control',
    keywords: ['personas', 'roles', 'rbac', 'iam-01', 'iam-02', 'security', 'permissions', 'access control', 'denied', 'unprovisioned'],
    url: '/login',
    content: `Access rules on azentio.ai:
- Public visitor: public catalogue, solutions, approved media, insights, about, demo enquiries. No workspace access.
- Employee: internal dashboard, employee Playground, employee broadcasts, internal knowledge library. Verified work identity plus approved employee membership required.
- Client member: own-organisation workspace, entitled demos, own/team observations and approved shared learning.
- Client administrator: manage invitations and approved roles within own organisation only. Cannot escalate roles.
- Learning moderator: reviews submitted contributions, redacts proposed shared copies, publishes or rejects. Cannot read unsubmitted private drafts.
- Content publisher: manages website banners, public content, and permitted video audiences.
- Portal administrator: manages organisations, role grants, and operational controls. Audited.

Rule IAM-01: Server-side RBAC plus tenant membership and entitlement checks on every resource. An email suffix (@azentio.com) alone does NOT grant access without an approved membership grant.`,
  },
  {
    id: 'auth-onboarding',
    title: '04 / Authentication, Onboarding & Invitations',
    category: 'Security & Access Control',
    keywords: ['login', 'authentication', 'onboarding', 'invite', 'magic link', 'invitation', 'session', 'workspace switcher'],
    url: '/login',
    content: `Authentication flows:
- Employees sign in with verified @azentio.com identity plus approved membership grant (via Microsoft 365 / Entra ID OIDC or email magic link).
- Clients join via single-use expiring invitation tied to a registered client tenant.
- First-time client journey: verify email, review workspace terms, accept learning sharing notice (joining a workspace is NOT consent to share or train on client data).
- Multi-membership users select an active workspace explicitly via the workspace switcher.`,
  },
  {
    id: 'employee-portal',
    title: '05 / Exclusive Employee Portal & Playground',
    category: 'Employee Portal',
    keywords: ['employee', 'playground', 'sandbox', 'internal live', 'broadcast', 'experiments', 'knowledge library'],
    url: '/portal/employee',
    content: `The Employee Portal provides:
- Employee Dashboard: quick links to internal Playground, live broadcasts, active experiments, and assigned improvement ideas.
- Playground: guided synthetic scenarios across Azentio offerings. Inspect parameters, run simulations, review evidence, and provide structured feedback.
- Internal Live sessions: restricted webinars, broadcasts, and technical recordings.
- Experiments & hackathon team spaces: internal release notes and prototype tracking.
- Internal knowledge library: compliance-reviewed documentation with assigned owners.`,
  },
  {
    id: 'client-portal',
    title: '06 / Exclusive Client Workspace & Sandboxes',
    category: 'Client Portal',
    keywords: ['client portal', 'workspace', 'client member', 'client admin', 'my observations', 'shared learning', 'entitled demos'],
    url: '/portal/client',
    content: `The Client Portal delivers:
- Client Dashboard: displays active client organization, entitled product offerings, and collaboration feeds.
- Entitled Sandboxes: tenant-isolated interactive demonstrations running synthetic or approved scenarios.
- Observation Management: 'My Observations' and 'Our Organisation's Observations'. Save private drafts, submit for review, follow moderation, and withdraw anytime.
- Approved Shared Learning: searchable feed of de-identified cross-client observations filtered by offering, industry, and region.
- Client Administration: client admins can invite colleagues into their tenant and manage client-member roles without platform privilege escalation.`,
  },
  {
    id: 'observation-capture',
    title: '07 / Observation Capture & Structured Evidence',
    category: 'Collective Learning',
    keywords: ['observation', 'contribution form', 'evidence', 'pii warning', 'draft', 'submit', 'market signals'],
    url: '/portal/client/observations/new',
    content: `Contribution capture workflow:
- Structured contribution form: market observations, emerging trends, product gaps, operational challenges, and improvement suggestions.
- Strict draft privacy: contributions start as private drafts. Clicking save never shares a contribution publicly.
- PII warning & sensitivity heuristic: prompts users to exclude customer account numbers, transaction-level data, credentials, and confidential terms.
- Explicit validation on client and server before submission.`,
  },
  {
    id: 'review-publication-withdrawal',
    title: '08 / Moderation Lifecycle & <=60s Withdrawal SLA',
    category: 'Governance & Privacy',
    keywords: ['moderation', 'redaction', 'lifecycle', 'withdrawal', 'sla', '60 seconds', 'unpublish', 'tombstone'],
    url: '/portal/moderator',
    content: `Moderation and withdrawal lifecycle:
- Private Source separation: the original private draft remains sealed in private storage. The published copy contains only reviewed, de-identified fields.
- Moderator actions: redact sensitive details, request clarification from author, reject duplicates, or publish approved copy.
- Material edits create a new version requiring renewed review.
- Withdrawal SLA: authors or moderators can withdraw contributions at any time. Withdrawal purges search indexes and invalidates AIRA retrieval within 60 seconds (guaranteed by immediate tombstone gating and cache invalidation).`,
  },
  {
    id: 'consent-sharing',
    title: '09 / Independent Consents (a–d) & Aggregation Safeguards',
    category: 'Privacy & Governance',
    keywords: ['consent', 'four consents', 'attribution', 'anonymous', 'privacy', 'threshold', '3 orgs', 'aggregation'],
    url: '/portal/client/observations/new',
    content: `Four independent consents:
(a) Storage and processing consent (required to save and process).
(b) Publishing reviewed shared copy consent (required for community learning).
(c) Attribution consent (opt-in; default is de-identified / anonymous).
(d) Future federated model training consent (strictly optional).
Joining a workspace is NOT consent for (b), (c), or (d).

Aggregation safeguards:
- Requires a minimum of 3 distinct contributing client organizations to display shared trend statistics.
- If fewer than 3 organizations have contributed, statistics and theme evidence are suppressed to protect contributor anonymity.`,
  },
  {
    id: 'product-improvement-themes',
    title: '10 / Themes Dashboard & Improvement Ideas',
    category: 'Product Improvement',
    keywords: ['themes', 'dashboard', 'improvement ideas', 'product owner', 'seasonality context', 'loop closure'],
    url: '/portal/client/themes',
    content: `Closing the loop from market signal to product enhancement:
- Community Theme Dashboard: groups approved observations into shared themes (e.g., 'Seasonality context in SME lending') with distinct organization counts and sample-size limitation warnings.
- Product Owner Ideas: POs create improvement ideas linked to approved evidence citations with statuses: Under review, Planned, In progress, Released, or Not proceeding.
- Audience-safe status notes communicate progress to clients without disclosing confidential roadmaps or client identities.`,
  },
  {
    id: 'products-banking',
    title: 'Azentio Banking Solutions: iMAL, Lending & Trade Finance',
    category: 'Products & Offerings',
    keywords: ['banking', 'imal', 'islamic banking', 'lending', 'digital banking', 'factoring', 'supply chain finance'],
    url: '/products/banking',
    content: `Azentio Banking Software:
- iMAL: Leading digital Islamic core banking platform. Fully Sharia-compliant, AAOIFI-certified, powering premier Islamic financial institutions across Middle East, Africa, and Southeast Asia.
- Digital Lending: End-to-end loan origination, credit underwriting, loan servicing, and collections across consumer, SME, and commercial portfolios. Reduces origination times by up to 50%.
- Factoring & Supply Chain Finance: Comprehensive working capital solutions for receivables financing and supplier credit.`,
  },
  {
    id: 'products-risk-compliance',
    title: 'Azentio Risk & Compliance: AMLOCK Suite',
    category: 'Products & Offerings',
    keywords: ['risk', 'compliance', 'amlock', 'sanctions', 'aml', 'kyc', 'transaction monitoring', 'fraud detection'],
    url: '/products/risk-compliance',
    content: `Azentio AMLOCK Risk & Compliance Suite:
- Sanctions Screening: Real-time fuzzy-matching against OFAC, UN, EU, and global PEP lists with ultra-low false-positive rates.
- Transaction Monitoring: Advanced pattern analysis and rule-based anomaly detection to spot suspicious activities and money laundering.
- KYC & Digital Onboarding: Automated customer due diligence, biometric verification, and risk profiling.
- Fraud Detection & Investigation: Real-time fraud detection and integrated case management with audit-ready regulatory reporting.`,
  },
  {
    id: 'products-insurance',
    title: 'Azentio Insurance Solutions: General, Health & Claims',
    category: 'Products & Offerings',
    keywords: ['insurance', 'general insurance', 'health insurance', 'claims automation', 'policy administration'],
    url: '/products/insurance',
    content: `Azentio Insurance Suite:
- General Insurance: Comprehensive policy administration, rating engine, underwriting, and reinsurance management.
- Health Insurance: Provider network management, pre-authorization workflows, and clinical adjudication.
- Claims Automation: Intelligent AI-powered claims processing, straight-through adjudication, and automated payout management.`,
  },
  {
    id: 'products-capital-markets',
    title: 'Azentio Capital Markets: MFund Plus & Wealth Management',
    category: 'Products & Offerings',
    keywords: ['capital markets', 'mfund', 'mfund plus', 'wealth management', 'asset management', 'wms'],
    url: '/products/capital-markets',
    content: `Azentio Capital Markets Solutions:
- Azentio MFund Plus: Premier asset and investment management system for fund managers, mutual funds, and pension funds.
- MFund Plus WMS (Wealth Management): Holistic portfolio advisory, client reporting, goal-based planning, and rebalancing.
- MFund ISS: Custody operations, corporate actions processing, and settlement administration.`,
  },
  {
    id: 'products-erp',
    title: 'Azentio ERP: Orion Cloud for Enterprises',
    category: 'Products & Offerings',
    keywords: ['erp', 'orion', 'distribution', 'contracting', 'financial cloud', 'manufacturing'],
    url: '/products/erp',
    content: `Azentio Orion ERP Cloud:
- Financial Cloud: General ledger, accounts payable/receivable, asset management, and multi-currency consolidation.
- Distribution & Supply Chain: Warehouse management, procurement automation, and inventory tracking.
- Contracting & Project Accounting: Milestone billing, job costing, and subcontractor management.
- Manufacturing Cloud: Production scheduling, bill of materials (BOM), and quality control.`,
  },
  {
    id: 'company-presence-stats',
    title: 'Azentio Key Statistics & Global Presence',
    category: 'Company & Presence',
    keywords: ['stats', 'presence', 'clients', 'locations', 'countries', 'about', 'middle east', 'africa', 'asia'],
    url: '/about',
    content: `Azentio Global BFSI Footprint:
- 650+ Enterprise Clients across Banking, Insurance, Capital Markets, and ERP.
- 30+ Years of specialized domain and technological expertise.
- 1,900+ Technology & BFSI Industry Professionals.
- 60+ Countries served across Middle East, Africa, Southeast Asia, and South Asia.
- 19 Location Presence including Singapore, Dubai, Riyadh, Mumbai, Kuala Lumpur, and Nairobi.`,
  },
  {
    id: 'hackathon-registration',
    title: 'Azentio AI Hackathon & Event Details',
    category: 'Hackathon & Events',
    keywords: ['hackathon', 'event', 'registration', 'challenge', 'participate', 'demo'],
    url: '/hackathon',
    content: `Azentio.ai Hackathon Details:
- Theme: 'Build intelligence. Create shared value.'
- Objective: Showcase Azentio BFSI solutions, secure tenant workspaces, collective learning from client observations, and product improvement loops.
- Anyone interested can request a demo or register their team interest via the Hackathon page (/hackathon).`,
  },
];

