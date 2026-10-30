# Frontend & UX Architecture Plan: azentio.ai

**Author:** Gemini (Frontend & UX Architect)  
**Role:** Frontend & UX Design, Component Architecture, Motion & Styling  
**Scope:** Public marketing portal, authentication flows, multi-tenant portal shells, persona workspaces, design tokens, GSAP choreography, and demo click-paths. Plan only; zero application code.  
**Framework & Baseline:** Next.js 16.4.3 (App Router, Turbopack, React 19.3.0, `@theme` Tailwind CSS v4, `@gsap/react` 2.1+).  
**Companion Documents:** `source.md` (Hackathon requirements), `docs/azentio-design-system.md` (Design system), `docs/plan/codex-backend-security.md` (Backend & Security architecture).

---

## 1. Route & Page Map

All routes live strictly under `app/` adhering to the project directory structure convention (`app/(ui)/`, `app/(common-lib)/`, `app/api/`). Public pages leverage Server Components with edge/static caching, while portal pages are dynamic server-rendered shells wrapping authorized client islands with server-side RBAC and active workspace enforcement.

### 1.1 Public Marketing & Discovery Routes

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/page.tsx` (`/`) | Public visitor | Flagship homepage. Showcase Azentio BFSI AI offerings, trust metrics, and social proof. | Announcement bar, Hero with mint underline & green geometric collage, Product category 5-column row, Key stats navy band, Awards carousel, Testimonial slider, Contact block. |
| `app/about/page.tsx` (`/about`) | Public visitor | Corporate overview, company history (30+ years), presence across Middle East, Africa, Asia. | Leadership grid, regional footprint map, academy/talent transformation highlights. |
| `app/products/page.tsx` (`/products`) | Public visitor | Unified catalogue across Banking, Capital Markets, Risk & Compliance, Insurance, ERP. | Filterable product matrix, capability chips, search input, "Request Demo" CTA pills. |
| `app/products/[category]/page.tsx` (`/products/:category`) | Public visitor | Category landing (e.g. `/products/banking`, `/products/risk-compliance`). | Category hero with mint accent, sub-product cards with line icons, customer proof quotes. |
| `app/products/[category]/[slug]/page.tsx` (`/products/:category/:slug`) | Public visitor | Product deep-dive (e.g. iMAL, AMLOCK, Lending Cloud). | Dark product hero, breadcrumb with leaf mark, stat cards (e.g. 50% faster origination), lifecycle grid, case study split. |
| `app/insights/page.tsx` (`/insights`) | Public visitor | Content hub: Thought leadership, webinars, whitepapers, case studies. | Filterable card grid (offering, topic, format), search bar, featured hero article. |
| `app/insights/[slug]/page.tsx` (`/insights/:slug`) | Public visitor | Single insight article / case study reading view. | Prose layout, author metadata, key takeaways callout, related insights carousel. |
| `app/request-demo/page.tsx` (`/request-demo`) | Public visitor | Standalone lead capture form for product demonstration. | Two-column form (HubSpot style), offering multi-select, region dropdown, legal checkboxes. |
| `app/hackathon/page.tsx` (`/hackathon`) | Public visitor | Hackathon context, collective learning overview, guest registration. | Challenge brief summary, community guidelines, registration interest form. |

### 1.2 Authentication & Workspace Onboarding Routes

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/login/page.tsx` (`/login`) | Unauthenticated visitor | Unified sign-in entry. Dual tab: (1) Azentio Employees (@azentio.com OTP/magic-link), (2) Client Partners (Magic link). Quick-switch demo persona selector for hackathon judges. | Branded card with Azentio dark logo, email input, OTP pin verification, security disclaimer. |
| `app/invite/[token]/page.tsx` (`/invite/:token`) | Invited client member | Single-use expiring invitation acceptance screen. Displays inviting tenant and assigned role. | Verified email confirmation, Workspace Terms review, explicit Notice that joining is NOT consent to share/train. |
| `app/workspace/select/page.tsx` (`/workspace/select`) | Multi-org users | Active tenant selection screen for users holding multiple memberships. | Card list of organizations, role badges (`Client Member`, `Client Admin`), "Enter Workspace" pill. |
| `app/logout/page.tsx` (`/logout`) | Authenticated | Session invalidation and redirect to public homepage. | Immediate cookie clearance and transition banner. |

### 1.3 Client Portal Routes (Tenant Scoped)

*Access Boundary:* Verified `client_member` or `client_admin` with valid `org_id`. Server Component DAL enforces tenant boundary on every resource read.

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/portal/client/page.tsx` (`/portal/client`) | Client Member / Admin | Client home dashboard showing active tenant, entitled offerings, and recent collaboration activity. | Active Org badge, Entitled Offering cards, Quick contribution CTA, Recent status ticker, Empty states for unentitled tools. |
| `app/portal/client/demos/page.tsx` (`/portal/client/demos`) | Client Member / Admin | Entitled sandbox demos. Synthetic test environments strictly isolated by tenant. | Card grid of entitled products, scenario launch pills, data synthesis badge. |
| `app/portal/client/demos/[offeringId]/page.tsx` (`/portal/client/demos/:offeringId`) | Client Member / Admin | Interactive product sandbox runner (e.g. AMLOCK transaction screening simulation). | Parameter form, deterministic run trigger, simulated evidence graph, feedback capture. |
| `app/portal/client/observations/page.tsx` (`/portal/client/observations`) | Client Member / Admin | "My Observations" & "Our Organisation's Observations" list view. | Tab switcher (My vs Org), status filter pills, search bar, sortable table, "New Observation" mint pill CTA. |
| `app/portal/client/observations/new/page.tsx` (`/portal/client/observations/new`) | Client Member | Multi-step contribution authoring form with privacy guidance. | Structured inputs, sensitivity heuristic warning, 3-way sharing selector, independent consent checkboxes. |
| `app/portal/client/observations/[id]/page.tsx` (`/portal/client/observations/:id`) | Client Member / Admin | Detailed observation timeline, version history, audit events, withdrawal control. | Version switcher, redaction history view, reviewer feedback box, "Withdraw Contribution" dangerous action button (<60s SLA). |
| `app/portal/client/observations/[id]/edit/page.tsx` (`/portal/client/observations/:id/edit`) | Contribution Author | Revision form for drafts or contributions returned for clarification. | Pre-filled form, moderator clarification message banner, revision changelog input. |
| `app/portal/client/shared-learning/page.tsx` (`/portal/client/shared-learning`) | Client Member / Admin | Searchable collective learning feed of approved, de-identified community contributions. | Faceted search (offering, industry, region, time), de-identified cards, "Report Content" modal trigger. |
| `app/portal/client/shared-learning/[sharedCopyId]/page.tsx` (`/portal/client/shared-learning/:sharedCopyId`) | Client Member / Admin | De-identified shared observation view. Stripped of tenant IDs, raw attachments, and private metadata. | De-identified summary, observation period, confidence level, report button. |
| `app/portal/client/themes/page.tsx` (`/portal/client/themes`) | Client Member / Admin | Community Theme Dashboard. Displays aggregated market signals meeting privacy threshold. | Theme cards, minimum 3 distinct org count indicator, small cohort limitation warnings, linked offerings. |
| `app/portal/client/themes/[themeId]/page.tsx` (`/portal/client/themes/:themeId`) | Client Member / Admin | Theme exploration view with permitted citations and linked roadmap items. | Problem synthesis, linked approved evidence cards, associated improvement ideas. |
| `app/portal/client/ideas/page.tsx` (`/portal/client/ideas`) | Client Member / Admin | Client-facing improvement idea tracker. Plain-language status updates. | Status filter (Under Review, Planned, Released), offering tag, non-promissory disclaimer. |
| `app/portal/client/admin/team/page.tsx` (`/portal/client/admin/team`) | Client Admin only | Organization member administration and role allocation. | Member list, single-use invite generator, role dropdown (member vs admin only), revoke button. |

### 1.4 Employee Portal Routes

*Access Boundary:* Verified `@azentio.com` identity with active employee role grant.

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/portal/employee/page.tsx` (`/portal/employee`) | Employee | Internal employee innovation dashboard and broadcast central. | Internal notices, assigned improvement ideas, quick links to Playground & Live broadcasts. |
| `app/portal/employee/playground/page.tsx` (`/portal/employee/playground`) | Employee | Guided synthetic experiment playground across all Azentio offerings. | Scenario catalog, parameter tweak drawer, deterministic simulation engine, feedback form. |
| `app/portal/employee/live/page.tsx` (`/portal/employee/live`) | Employee | Employee-only live webinar streams and technical recordings. | Restricted video player, schedule calendar, attendee Q&A panel. |
| `app/portal/employee/experiments/page.tsx` (`/portal/employee/experiments`) | Employee | Internal innovation submissions, hackathon ideas, and prototype release notes. | Experiment cards, vote/feedback widget, author attribution, prototype link. |
| `app/portal/employee/knowledge/page.tsx` (`/portal/employee/knowledge`) | Employee | Internal knowledge base with explicit owners, review dates, and compliance tags. | Full-text search, category tree, owner metadata cards, verification badges. |

### 1.5 Moderator Console Routes

*Access Boundary:* Explicit `learning_moderator` role grant.

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/portal/moderator/page.tsx` (`/portal/moderator`) | Moderator | Moderation queue command center, SLA metrics, triage urgency indicators. | Triage stats (Pending, Flagged, Needs Clarification), queue status table, quick filter. |
| `app/portal/moderator/queue/page.tsx` (`/portal/moderator/queue`) | Moderator | Full triage queue of contributions submitted for collective learning sharing. | Tabular list, age in queue, offering filter, sensitivity heuristic risk score badge. |
| `app/portal/moderator/review/[contributionId]/page.tsx` (`/portal/moderator/review/:contributionId`) | Moderator | Split-screen redaction & sanitization workbench. | Left: raw private source; Right: editable shared copy. Inline PII redaction brush, consent verification card, clarification modal, publish/reject controls. |
| `app/portal/moderator/reports/page.tsx` (`/portal/moderator/reports`) | Moderator | Inappropriate or confidential content investigation queue. | Reporter remarks (anonymous to author), immediate temporary suspension toggle, resolution logger. |
| `app/portal/moderator/audit/page.tsx` (`/portal/moderator/audit`) | Moderator / Admin | Append-only moderation action history log. | Filterable audit stream: moderator ID, action taken, redactions applied, timestamp. |

### 1.6 Product Owner Console Routes

*Access Boundary:* Explicit `product_owner` role grant.

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/portal/product-owner/page.tsx` (`/portal/product-owner`) | Product Owner | Product improvement pipeline overview across offerings. | Ideas by status kanban/table, emerging themes alert, recent client feedback. |
| `app/portal/product-owner/themes/page.tsx` (`/portal/product-owner/themes`) | Product Owner | Recurring theme synthesis workbench. | Cluster visualizer, citation linker, distinct org verification check (`>=3`). |
| `app/portal/product-owner/ideas/new/page.tsx` (`/portal/product-owner/ideas/new`) | Product Owner | Create new improvement idea linked to approved themes. | Title, problem statement, offering selector, supporting citations picker, outcome draft. |
| `app/portal/product-owner/ideas/[ideaId]/page.tsx` (`/portal/product-owner/ideas/:ideaId`) | Product Owner | Idea management, public status update editor, client feedback loop closer. | Status lifecycle stepper, audience-safe status note editor, linked evidence viewer. |

### 1.7 Portal Administrator Console Routes

*Access Boundary:* Explicit `portal_admin` role grant. All actions audited.

| URL Path | Persona / Audience | Page Purpose & Azentio Visual Pattern | Key Components / Features |
|---|---|---|---|
| `app/portal/admin/page.tsx` (`/portal/admin`) | Portal Admin | Platform health, security audit stream, tenant allocation stats. | System metrics, active sessions counter, tenant quota monitors. |
| `app/portal/admin/organizations/page.tsx` (`/portal/admin/organizations`) | Portal Admin | Tenant directory management (Azentio internal vs Client organizations). | Tenant table, seat count, active status toggle, creation modal. |
| `app/portal/admin/roles/page.tsx` (`/portal/admin/roles`) | Portal Admin | Explicit role assignment matrix (separate grants: moderator, publisher, PO, admin). | User search, grant/revoke toggles, role expiration date picker, audit trail. |
| `app/portal/admin/entitlements/page.tsx` (`/portal/admin/entitlements`) | Portal Admin | Product sandbox and catalogue entitlement management per client tenant. | Tenant-offering matrix, feature flag toggles, validity period selector. |

---

## 2. Layouts: Public Shell vs. Portal Shell

Next.js 16 App Router route grouping cleanly separates the public marketing experience from the authenticated portal shell without URL path pollution.

```
app/
├── (public)/                 # Route group for marketing site
│   ├── layout.tsx            # Public layout (Announcement + Header + Footer + Floating Tab + Cookie)
│   ├── page.tsx              # Homepage
│   ├── about/
│   ├── products/
│   └── ...
├── portal/                   # Authenticated portal root
│   ├── layout.tsx            # Master portal shell (Auth gate, Topbar, Workspace Switcher, Sidebar)
│   ├── client/               # Client portal
│   ├── employee/             # Employee portal
│   ├── moderator/            # Moderator console
│   ├── product-owner/        # Product owner console
│   └── admin/                # Portal admin console
├── login/                    # Auth layout
├── invite/                   # Invitation layout
└── layout.tsx                # Root layout: Poppins font, global CSS, theme variables
```

### 2.1 Public Shell Layout (`app/(public)/layout.tsx`)

Adheres strictly to the visual patterns captured in `docs/screenshots/hero.png` and `docs/screenshots/home-full.png`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Announcement Bar: "Azentio recognised in Gartner Magic Quadrant" [Read report]  [×]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Public Header: [Azentio Logo]   About Azentio ▾  Products ▾  Support ▾  Insights ▾      │
│                                           [Contact us (Navy)]  [Demo (Mint)]  [Search] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                                                                        │
│   {children}  (Public Route Pages)                                                    │
│                                                                                        │
│                                                                                        │
│   [Floating "Book a Demo" Tab (pinned to right edge)]                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Public Footer (Navy #16303D):                                                           │
│  [Azentio White Logo]   SOLUTIONS         SOLUTIONS          RESOURCES     CONNECT     │
│                         Banking           Risk & compliance  Insights      Support     │
│                         Insurance         ERP                Featured      Partners    │
│  Newsletter: [Enter business email...] [Subscribe (Mint)]                              │
│  © 2026 Azentio Software Private Limited · Privacy · Terms · Cookies · Support Policy  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Cookie Banner (Fixed Bottom Navy): We use cookies... [Decline] [Allow all (Mint)]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Top Announcement Bar:** Full-width navy background (`#16303D`), 14px white text, mint pill CTA (`#55FFBE`), dismissible.
- **Sticky Public Header:** White background, 80px height, elevation shadow on scroll. Left: Azentio dual-tone SVG logo (164x45). Center: Nav items with hover underline and chevron dropdowns. Right: Navy pill "Contact us", Mint pill "Demo", Search icon, and a subtle "Portal Login" link.
- **Floating Right Tab:** Fixed to right viewport edge, vertical text "Book a Demo", navy pill tab with mint accent dot.
- **Footer:** Deep navy (`#16303D`), 4-column layout with green uppercase headers, newsletter subscription field with mint pill button, legal disclaimer bottom row.
- **Cookie Banner:** Fixed bottom bar, navy background, mint button for consent.

### 2.2 Portal Shell Layout (`app/portal/layout.tsx`)

Designed for focused enterprise productivity, tenant isolation, and clear context awareness:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Portal Topbar:                                                                         │
│  [Azentio Logo] | [Active Workspace Switcher ▾]            [Search] [🔔 (3)] [User ▾] │
│                   "Gulf Retail Bank (Client)"                                          │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Portal Sidebar:      │ Portal Breadcrumb: Home > Observations > Q4 SME Agriculture     │
│                      ├─────────────────────────────────────────────────────────────────┤
│  🏢 Workspace        │                                                                 │
│  📊 Dashboard        │                                                                 │
│  🧪 Sandboxes        │   {children}  (Dynamic Portal Route Content)                    │
│  📝 My Observations  │                                                                 │
│  🌐 Shared Learning  │                                                                 │
│  💡 Themes & Ideas   │                                                                 │
│  👥 Team Admin       │                                                                 │
│                      │                                                                 │
│  ─────────────────── │                                                                 │
│  🛡️ Moderator Queue  │                                                                 │
│  🎯 Product Owner    │                                                                 │
│  ⚙️ Admin Console    │                                                                 │
├──────────────────────┴─────────────────────────────────────────────────────────────────┤
│ Portal Minimal Footer: Security Level: Tenant Isolated · Encrypted in Transit · v1.0.4  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Workspace Switcher Component Specifications
- **Display:** Shows the currently active tenant (`org_name`) and the user's role in that tenant (e.g. `Gulf Retail Bank · Client Member`).
- **Interaction:** Clicking opens an accessible dropdown popover showing:
  - List of organizations the user is an approved member of.
  - Organization type badge (`Client Tenant` vs `Azentio Internal`).
  - Active checkmark on the currently selected workspace.
  - "Accept Pending Invitation" entry link.
- **Action Execution:** Selecting a workspace dispatches a Server Action (`POST /api/v1/workspaces`) which verifies membership server-side, updates the secure session cookie, and triggers `refresh()` to re-render the tree with tenant-isolated data.
- **Role-Aware Navigation:** The sidebar items adapt immediately based on the active workspace role (Client Member sees client routes; Employee in Azentio org sees Playground and Live; authorized Moderator sees the moderation queue).

---

## 3. Component Inventory Mapped to Azentio Patterns

Every component is defined with exact styling classes, responsive behavior, accessibility tags, and file locations in `app/(ui)/components/`.

### 3.1 Public Marketing Components

| Component Name | File Path | Azentio Design System Pattern | Responsive Behavior & Key Props |
|---|---|---|---|
| `AnnouncementBar` | `app/(ui)/components/public/announcement-bar.tsx` | Full-width navy `#16303D` bar with mint pill link and close icon. | Collapses on small screens; persists dismissal in session storage. |
| `PublicHeader` | `app/(ui)/components/public/public-header.tsx` | White header with logo left, navigation mega-menus center, action pills right. | Desktop: 80px sticky header with mega-menus. Mobile: Hamburger trigger with slide-over navigation drawer. |
| `HeroSection` | `app/(ui)/components/public/hero-section.tsx` | Two-line H1 with 3px mint underline (`.span-border-bottom`), lead text, mint CTA pill, person-with-tablet photo over geometric green collage, floating frosted navy chip. | Desktop: 2-column flex (60/40). Mobile: Stacked text first, graphic second with scaled down collage. Props: `headline`, `lead`, `ctaLabel`, `ctaHref`. |
| `ProductCategoryRow` | `app/(ui)/components/public/product-category-row.tsx` | 5-column grid: Banking, Capital Markets, Risk & Compliance, Insurance, ERP. Line icon (navy with green stroke), bold title, description, bold link. | Desktop: 5 columns (`grid-cols-5`). Tablet: 3 columns. Mobile: 1 column stack with horizontal swipe option. |
| `StatsBand` | `app/(ui)/components/public/stats-band.tsx` | Full-width navy background `#16303D`, large white statistics with mint `+` (650+ clients, 30+ years, 1900+ professionals, 60+ countries, 19 locations), decorative green tile stack right. | Desktop: 5 stat columns with animated numeric count-up. Mobile: 2x2 grid + 1 centered. |
| `CardCarousel` | `app/(ui)/components/public/card-carousel.tsx` | 3 cards visible, circular prev/next navigation arrows (40-50px circles with mint hover), dot pager below. | Smooth scroll / GSAP tween on slide change. Props: `items`, `renderCard`, `autoplay`. |
| `SplitCaseStudy` | `app/(ui)/components/public/split-case-study.tsx` | Split section: Mint-tint left (`#DDFFF2`) with client quote, metrics and mint pill CTA; right side video/image preview. | Desktop: 50/50 split. Mobile: Stacked with video on top. |
| `ContactFormBlock` | `app/(ui)/components/public/contact-form-block.tsx` | "Let's begin our journey together" section on light grey `#EFEFEF` background. Left: title and green arrow illustration. Right: 2-column form with mint submit button. | Client & server Zod validation, accessible error labels, loading spinner during Server Action submission. |
| `PublicFooter` | `app/(ui)/components/public/public-footer.tsx` | Navy background `#16303D`, white logo, 4 navigation columns with green uppercase headers, newsletter input with mint pill, bottom legal links. | Desktop: 4 columns + newsletter. Mobile: Accordion collapsible columns. |
| `FloatingDemoTab` | `app/(ui)/components/public/floating-demo-tab.tsx` | Vertical text "Book a Demo" pinned to right viewport edge in navy with mint accent dot. | Hidden on mobile (<768px) to prevent viewport clutter; visible on tablet/desktop. |

### 3.2 Portal & Enterprise Collaboration Components

| Component Name | File Path | Functional Purpose | Visual Specs & Azentio Theme Implementation |
|---|---|---|---|
| `StatusBadge` | `app/(ui)/components/portal/status-badge.tsx` | Displays contribution lifecycle and idea status. | Rounded pill (`rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1.5`). Matches state: `draft` (slate-100/text-slate-700), `submitted` (navy-100/text-az-navy), `in_review` (mint-tint/text-az-navy), `approved` (mint-500/text-az-navy), `published` (az-green/text-white), `withdrawn` (zinc-100/text-zinc-500 line-through). |
| `ContributionForm` | `app/(ui)/components/portal/contribution-form.tsx` | Structured authoring form for client market observations. | White card (`rounded-[12px] shadow-card p-6 md:p-8`). Multi-section: (1) Details & context, (2) PII Warning Banner with heuristic keyword scanner, (3) 3-way Sharing Choice radio group (Private, Org, Community), (4) Four independent consent checkboxes (a–d). |
| `ModerationDiffWorkbench` | `app/(ui)/components/portal/moderation-diff-workbench.tsx` | Moderator side-by-side view for de-identification and redaction. | Split container: Left = Original Private Source (read-only); Right = Proposed Shared Copy (editable text area with selection redaction toolbar). Inline PII highlighter chip, attribution consent indicator, action bar (Request Clarification modal, Reject modal, Publish button). |
| `ThemeDashboard` | `app/(ui)/components/portal/theme-dashboard.tsx` | Aggregated market signals dashboard. Enforces minimum 3 distinct contributing organizations. | Grid of theme cards (`rounded-[12px] border border-az-border p-6`). Distinct org counter badge: if `< 3`, shows "Suppressed / Small cohort" badge; if `>= 3`, displays org count + "Sample limitations" disclaimer. |
| `EmptyState` | `app/(ui)/components/portal/empty-state.tsx` | Zero-data placeholder for sandboxes, drafts, or queues. | Centered mint-tint card (`bg-az-mint-surface border-2 border-dashed border-az-mint rounded-[12px] p-8 text-center`). Line icon, Poppins bold H3, descriptive text, and a mint CTA pill button. |
| `WorkspaceSwitcher` | `app/(ui)/components/portal/workspace-switcher.tsx` | Active tenant selector in portal topbar. | Dropdown button with building icon, current tenant name, chevron. Popover menu with radio items per tenant and role badge. Dispatches Server Action on select. |
| `WithdrawalModal` | `app/(ui)/components/portal/withdrawal-modal.tsx` | Confirmation dialog for immediate contribution withdrawal. | Accessible dialog modal (`role="dialog"`). Red warning icon, plain-language explanation of <=60s search/AIRA purge SLA, irreversible disclaimer, "Confirm Withdrawal" red pill button. |
| `NotificationBell` | `app/(ui)/components/portal/notification-bell.tsx` | Real-time in-app notification center. | Bell icon with unread badge counter. Dropdown popover displaying idempotent outbox events (e.g. "Moderator requested clarification", "Observation published"). |

---

## 4. Tailwind CSS v4 Theme Tokens

In accordance with Tailwind CSS v4 conventions, theme tokens are declared directly in CSS via the `@theme` directive inside `app/globals.css`, eliminating the need for `tailwind.config.js`.

### 4.1 Global Stylesheet Configuration (`app/globals.css`)

```css
@import "tailwindcss";

@theme {
  /* ==========================================================================
     Azentio Brand Colors (Source: azentio.com & docs/azentio-design-system.md)
     ========================================================================== */
  --color-az-navy: #16303d;
  --color-az-navy-dark: #0f222b;
  --color-az-navy-light: #214354;
  --color-az-navy-surface: #f0f4f7;

  --color-az-mint: #55ffbe;
  --color-az-mint-hover: #3ee6a6;
  --color-az-mint-tint: #ddfff2;
  --color-az-mint-surface: #f3fdf8;

  --color-az-green: #2ed88e;
  --color-az-green-dark: #24af73;

  --color-az-deep-blue: #0d1c4f;

  --color-az-grey-bg: #efefef;
  --color-az-grey-light: #f8f8f8;
  --color-az-border: #e2e8f0;
  --color-az-border-subtle: #f1f5f9;

  --color-az-text: #333333;
  --color-az-text-muted: #76777a;
  --color-az-white: #ffffff;

  /* Lifecycle & Feedback States */
  --color-az-error: #e74c3c;
  --color-az-error-bg: #fdf2f2;
  --color-az-warning: #f39c12;
  --color-az-warning-bg: #fefcf2;
  --color-az-info: #3498db;
  --color-az-info-bg: #f0f8fd;

  /* ==========================================================================
     Typography (Poppins via Next.js next/font)
     ========================================================================== */
  --font-poppins: var(--font-poppins), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: var(--font-geist-mono), monospace;

  /* ==========================================================================
     Border Radii & Elevation
     ========================================================================== */
  --radius-card: 12px;
  --radius-pill: 50px;
  --radius-badge: 6px;
  --radius-sm: 4px;

  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 10px 15px -3px rgba(22, 48, 61, 0.12), 0 4px 6px -4px rgba(22, 48, 61, 0.06);
  --shadow-dropdown: 0 12px 24px -4px rgba(22, 48, 61, 0.18);
  --shadow-elevated: 0 20px 25px -5px rgba(22, 48, 61, 0.2);
}

/* ==========================================================================
   Azentio Signature Utilities
   ========================================================================== */
@layer utilities {
  /* Signature 3px mint underline for H1 and section H2s */
  .span-border-bottom {
    border-bottom: 3px solid var(--color-az-mint);
    padding-bottom: 2px;
    display: inline-block;
  }

  /* Full pill primary action button */
  .btn-pill-mint {
    background-color: var(--color-az-mint);
    color: var(--color-az-navy);
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 0.65rem 1.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .btn-pill-mint:hover {
    background-color: var(--color-az-mint-hover);
    transform: translateY(-1px);
  }

  .btn-pill-navy {
    background-color: var(--color-az-navy);
    color: var(--color-az-white);
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 0.65rem 1.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .btn-pill-navy:hover {
    background-color: var(--color-az-navy-light);
    transform: translateY(-1px);
  }
}
```

### 4.2 Font Setup via `next/font/google` (`app/layout.tsx`)

```tsx
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Azentio.ai | Enterprise BFSI Intelligence & Collaboration",
  description: "Azentio AI website and secure collaboration portal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} font-sans antialiased`}>
      <body className="min-h-screen flex flex-col bg-white text-az-text">
        {children}
      </body>
    </html>
  );
}
```

---

## 5. GSAP Animation Architecture (`@gsap/react`)

Animations are choreographed using GSAP 3.12+ and `@gsap/react` `useGSAP()`. To guarantee high performance, all motion is restricted to hardware-accelerated transforms (`transform: translate3d/scale`) and `opacity`.

### 5.1 Architectural Rules & Boundaries
1. **Server/Client Component Boundaries:**
   - Next.js Server Components handle data fetching and render semantic HTML without animation code.
   - Interactive sections are wrapped in dedicated `"use client"` container components (e.g. `hero-animation-wrapper.tsx`, `stats-counter-wrapper.tsx`).
   - Plugin registration (`gsap.registerPlugin(useGSAP, ScrollTrigger)`) occurs strictly on the client side inside client components or an application-level client initializer.
2. **Automatic Garbage Collection & Scoping:**
   - Every GSAP animation is initialized inside `useGSAP(() => { ... }, { scope: containerRef })`.
   - On component unmount, `useGSAP` automatically reverts all inline styles, kills tweens, and cleans up ScrollTrigger listeners, preventing memory leaks during client-side route transitions.
3. **Accessibility & Reduced Motion:**
   - All animations are wrapped in `gsap.matchMedia()`.
   - When `(prefers-reduced-motion: reduce)` evaluates to true, complex spatial movement, parallax, and continuous loops are suppressed; content renders with an instant or gentle opacity fade (duration <= 0.1s).

### 5.2 Animated Sections Choreography Plan

| Section / Component | Trigger Mechanism | GSAP Choreography & Easing | Reduced Motion Fallback |
|---|---|---|---|
| **Public Hero Section** (`app/(ui)/components/public/hero-section.tsx`) | On component mount (`useGSAP`) | 1. Headline line 1 & 2 enter: `y: 40 -> 0`, `opacity: 0 -> 1` (duration 0.8s, ease `power3.out`).<br>2. Mint underline reveals via `scaleX: 0 -> 1` (`transformOrigin: "left center"`, duration 0.6s).<br>3. Lead copy & CTA pill stagger in (`stagger: 0.15s`).<br>4. Geometric green collage shapes float gently (`y: -10 to 10`, ease `sine.inOut`, `yoyo: true`, `repeat: -1`). | Instant render (`opacity: 1`, `y: 0`, `scaleX: 1`). Floating collage tween disabled. |
| **Key Stats Band** (`app/(ui)/components/public/stats-band.tsx`) | `ScrollTrigger` (`start: "top 75%"`, `once: true`) | Integer counter tween: GSAP tweens proxy object from `0` to target (e.g., `650`, `30`, `1900`, `60`, `19`) over 1.8s (`ease: "power2.out"`). `onUpdate` updates the text node and adds the mint `+` symbol on complete. Staggered card entrance: `opacity: 0 -> 1, y: 30 -> 0` (`stagger: 0.1s`). | Numbers display targets immediately without count-up animation. |
| **Product Category Row** (`app/(ui)/components/public/product-category-row.tsx`) | `ScrollTrigger.batch` (`start: "top 85%"`) | Batch reveal of category columns: `opacity: 0 -> 1`, `y: 45 -> 0`, `stagger: 0.08s`, duration 0.6s (`ease: "power2.out"`). Hover state: icon green highlight stroke expands smoothly. | Columns render static without offset. Hover color transitions handled by CSS transitions. |
| **Card Carousels (Awards / Insights)** (`app/(ui)/components/public/card-carousel.tsx`) | User prev/next click & swipe | Slide transition timeline: active card scales down slightly and exits (`x: -100%`, `opacity: 0`), incoming card slides in (`x: 0`, `opacity: 1`, duration 0.5s, `ease: "power2.out"`). Dot pager indicators scale smoothly. | Instant slide switch without translational movement. |
| **Submission Success Banner** (`app/(ui)/components/portal/contribution-form.tsx`) | Server Action complete | Success alert drawer slides down from top of form (`y: -20 -> 0`, `opacity: 0 -> 1`, duration 0.4s, `ease: "back.out(1.5)"`). | Instant display without bounce. |
| **Moderator Diff Highlighting** (`app/(ui)/components/portal/moderation-diff-workbench.tsx`) | On redact / replace action | Highlight background flash on the edited segment (`backgroundColor: "#55ffbe" -> "transparent"`, duration 0.6s). | Static subtle highlight border without color pulse. |
| **Withdrawal Countdown Ticker** (`app/(ui)/components/portal/withdrawal-modal.tsx`) | On withdrawal execution | Circular SVG progress stroke offsets smoothly over a 60-second countdown demonstrating real-time invalidation SLA. | Numerical text countdown (seconds remaining). |

### 5.3 Client Component Wrapper Pattern Example

```tsx
"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export function StatsBandAnimated({ stats }: { stats: { label: string; value: number; suffix: string }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Standard motion for users with no preference
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const counters = containerRef.current?.querySelectorAll(".stat-number");
        if (!counters) return;

        ScrollTrigger.create({
          trigger: containerRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            counters.forEach((el) => {
              const target = Number(el.getAttribute("data-target")) || 0;
              const suffix = el.getAttribute("data-suffix") || "";
              const proxy = { val: 0 };

              gsap.to(proxy, {
                val: target,
                duration: 1.8,
                ease: "power2.out",
                onUpdate: () => {
                  el.textContent = `${Math.floor(proxy.val)}${suffix}`;
                },
              });
            });

            gsap.from(".stat-card", {
              opacity: 0,
              y: 30,
              duration: 0.8,
              stagger: 0.1,
              ease: "power2.out",
            });
          },
        });
      });

      // Accessible reduced motion
      mm.add("(prefers-reduced-motion: reduce)", () => {
        const counters = containerRef.current?.querySelectorAll(".stat-number");
        counters?.forEach((el) => {
          const target = el.getAttribute("data-target") || "0";
          const suffix = el.getAttribute("data-suffix") || "";
          el.textContent = `${target}${suffix}`;
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="bg-az-navy text-white py-16 px-4">
      {/* Render stats cards with data-target and data-suffix */}
    </div>
  );
}
```

---

## 6. Demo Walkthrough: 'Seasonality Context' Click Path

This step-by-step interactive click path fulfills the Section 10 & 11 requirement from `source.md`, demonstrating client submission, moderator sanitization, cross-client privacy aggregation (minimum 3 distinct organizations), product owner loop-closure, and guaranteed <=60s withdrawal invalidation.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        'SEASONALITY CONTEXT' DEMO CLICK PATH                           │
│                                                                                        │
│  [Step 1: Client A]     [Step 2: Clients B & C]    [Step 3: Moderator]                 │
│  Gulf Retail Bank       Levant & Nile SME Banks    De-identifies & redacts PII         │
│  Submits seasonal cash  Submit parallel seasonal   Publishes 3 approved shared copies  │
│  flow observation       observations               to community                        │
│          │                         │                              │                    │
│          ▼                         ▼                              ▼                    │
│  [Step 4: Dashboard]                               [Step 5: Product Owner]             │
│  Theme "Seasonality context" forms                 Creates improvement idea            │
│  Shows: Distinct Orgs = 3 (Threshold Met)          "Seasonality Engine" linked to safe │
│  Shows: Small cohort limitation warning            citations; status "Under review"    │
│          │                                                                             │
│          ▼                                                                             │
│  [Step 6: Loop Closed] ──────────────────────────► [Step 7: Privacy Withdrawal]        │
│  Client views idea in "Under review";              Client A clicks "Withdraw"          │
│  No private source exposed                         <=60s search & AIRA purge verified; │
│                                                    Theme org count drops to 2          │
│                                                    (Stats automatically suppressed)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Screen-by-Screen Walkthrough

| Step | User & Active Workspace | Screen & Route URL | User Action & Input | Visual State & System Response |
|---|---|---|---|---|
| **1** | **Client A User**<br>(`Gulf Retail Bank`) | `/portal/client/observations/new`<br>(Authoring Form) | 1. Enters Title: *"Q4 Agriculture Seasonal Cash Flow Volatility"*. Selected Offering: *"Financial Analysis Intelligence"*.<br>2. Observation: *"High cash flow swings during date harvest season trigger false default alerts."*<br>3. Sharing Choice: Selects `Propose Sharing to Collective Learning Community`.<br>4. Checks Consents: (a) Store/Process [x], (b) Publish Reviewed Copy [x], (c) Attribution [ ] (opt-out, de-identified), (d) Training [ ].<br>5. Clicks **"Submit for Review"**. | Form validates input. State updates to `submitted`. Audit event logged. In-app banner confirms submission. Submission appears in client's "My Observations" tab with navy `Submitted` status badge. |
| **2** | **Client B User** (`Levant Commercial Bank`) & **Client C User** (`Nile SME Capital`) | `/portal/client/observations/new` | Both users independently submit observations regarding seasonal agricultural liquidity and uneven quarterly loan repayments in their respective jurisdictions. | Both submissions enter `submitted` state with community sharing requested and attribution opt-out. Server records 3 distinct tenant contributions in the review pipeline. |
| **3** | **Moderator**<br>(`Azentio Compliance`) | `/portal/moderator/queue`<br>→ `/portal/moderator/review/c-101`<br>(Split-screen Workbench) | 1. Moderator opens Gulf Retail Bank's submission `c-101`.<br>2. Source Draft contains regional identifiers: *"Al-Qassim date harvest"*, *"Branch 14"*, *"$2.4M cohort"*.<br>3. Moderator uses Redaction Brush to generalize wording: *"Regional seasonal harvest cycle in agricultural portfolio"*, removes branch and dollar specifics.<br>4. Verifies attribution consent is de-identified.<br>5. Clicks **"Approve & Publish Shared Copy"**.<br>6. Repeats sanitization for Client B and Client C submissions. | System creates 3 separate `shared_copies` records. Raw drafts, client tenant IDs, and author metadata remain strictly sealed in private tables. Status of source contributions changes to `approved` / `published`. In-app notification delivered to authors. |
| **4** | **Client Member** or **Product Owner** | `/portal/client/themes`<br>(Community Theme Hub) | User navigates to the shared theme dashboard and clicks into **"Seasonality context in SME Lending"**. | Theme card aggregates the 3 approved shared copies:<br>• **Contributing Organizations:** `3 distinct organisations` (Badge: Mint `Threshold Met: >= 3`).<br>• **Limitation Caveat:** *"Sample size: 3 organisations. Exploratory market signal; non-causal."*<br>• **Permitted Evidence:** 3 de-identified summary cards displayed. Zero client names, zero tenant IDs visible. |
| **5** | **Product Owner**<br>(`Azentio PO`) | `/portal/product-owner/ideas/new`<br>(Idea Authoring View) | 1. Clicks "Create Improvement Idea from Theme".<br>2. Problem: *"Inconsistent seasonal cash flow treatment causes false-positive risk scoring."*<br>3. Title: *"Seasonality-Aware Cash Flow Comparison Engine"*.<br>4. Offering: *"Financial Analysis Intelligence"*.<br>5. Links the 3 de-identified shared citations.<br>6. Sets Status: `Under review`.<br>7. Adds public note: *"Assessing algorithm parameterization for seasonal variance. No roadmap delivery commitment."*<br>8. Clicks **"Publish Idea Status"**. | New `improvement_ideas` record created. Status stepper shows `Under review`. Public status note published to client portal. Internal PO backlog notes remain private. |
| **6** | **Client A User**<br>(`Gulf Retail Bank`) | `/portal/client/ideas`<br>(Client Ideas Feed) | Client searches for ideas under *Financial Analysis Intelligence*. | Sees idea *"Seasonality-Aware Cash Flow Comparison Engine"* with `Under review` status badge. Notes that community feedback was acknowledged without disclosing Gulf Retail Bank's identity or private data. |
| **7** | **Client A User**<br>(Exercising Privacy Right) | `/portal/client/observations/c-101`<br>(Observation Detail Screen) | 1. Client views observation timeline.<br>2. Clicks **"Withdraw Contribution"** button.<br>3. System opens `WithdrawalModal` outlining the <=60s purge SLA.<br>4. Client confirms withdrawal. | 1. Server executes atomic withdrawal transaction: tombstone set, `visibility_epoch` incremented.<br>2. Real-time ticker modal shows countdown: search index purged and AIRA citations invalidated in **< 15 seconds** (well within the 60s judging SLA).<br>3. Status updates to `Withdrawn` (grey strikethrough badge). |
| **8** | **Client B User** or **Judge Verification** | `/portal/client/themes/theme-seasonality`<br>(Verification Check) | User refreshes the Seasonality Theme page immediately following Client A's withdrawal. | **Privacy Suppression Triggered:**<br>• Active distinct contributing organisations dropped from 3 to **2**.<br>• Since count is now `< 3`, the system suppresses organization counts and hides the aggregate evidence tab.<br>• Warning Banner displays: *"Cohort size insufficient (< 3 organizations). Theme metrics temporarily suppressed under privacy policy."*<br>• Proves that withdrawal takes effect immediately and privacy thresholds are rigorously enforced. |

---

## 7. Next.js 16.4.3 & React 19 Best Practices Summary

1. **Async Request APIs:**
   - In Next.js 16.4.3, all dynamic parameters and server context (`params`, `searchParams`, `cookies()`, `headers()`) must be accessed asynchronously using `await`.
   - Layouts, pages, and route handlers comply with:
     ```tsx
     export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
       const { id } = await props.params;
       const query = await props.searchParams;
       // ...
     }
     ```
2. **Network Gate via `proxy.ts`:**
   - As per Next.js 16 breaking changes, the deprecated `middleware.ts` is replaced by root `proxy.ts` running in Node.js runtime.
   - `proxy.ts` performs optimistic edge path routing, redirecting unauthenticated users to `/login`.
   - Authoritative authorization is strictly enforced by the server-only DAL (`app/api/(services)/authz/`) inside Server Components and Server Actions.
3. **Cache Components & Mutations:**
   - Uses `cacheLife` and `cacheTag` from `next/cache` for static public catalogue pages.
   - Server Actions use `updateTag()` for read-your-writes data freshness on observation updates, and `refresh()` to re-render the active client layout upon workspace switching.
4. **Icons by Meaning:**
   - Following project coordination rules, icons are referenced semantically (`icon-search`, `icon-bell`, `icon-building`, `icon-check`, `icon-alert-triangle`, `icon-arrow-right`, `icon-redact`, `icon-lock`, `icon-trash`), enabling Claude's icon library selection to drop in without markup refactoring.

