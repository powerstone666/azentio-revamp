# Azentio design system (reference for azentio.ai portal)

Extracted from the live site https://www.azentio.com/ on 2026-10-30: theme CSS (`azentio_minifi.css`, `custom.css`), page HTML and Playwright screenshots. The PS asks us to reuse Azentio's visual direction, so this is the source of truth for fonts, colours and layout patterns.

Site stack (for context only): WordPress theme on Bootstrap 5, Slick carousels, Font Awesome icons, HubSpot forms.

## Screenshots

All captured at 1440px desktop width unless noted. Files live in [screenshots/](screenshots/).

| Screen | File | What it shows |
|---|---|---|
| Home – first viewport | [hero.png](screenshots/hero.png) | Announcement bar, header/nav, hero with pill CTA, image collage, side "Book a Demo" tab, cookie bar |
| Home – mobile (390px) | [mobile-home.png](screenshots/mobile-home.png) | Mobile header (logo, search, Demo pill, hamburger), stacked hero |
| Home – full page | [home-full.png](screenshots/home-full.png) | Full section rhythm: logos → products → awards slider → sanctions band → key stats → case studies → testimonials → culture → insights → contact form → footer |
| Product page (Lending) | [product-lending-full.png](screenshots/product-lending-full.png) | Dark product hero, breadcrumb, stat cards, case-study split, feature cards, lifecycle grid, related products |
| Category page (Risk & compliance) | [category-risk-full.png](screenshots/category-risk-full.png) | Category landing with product list |
| Insights hub | [insights-full.png](screenshots/insights-full.png) | Filterable resource/article grid |
| About | [about-full.png](screenshots/about-full.png) | Company story page |
| Request demo | [request-demo-full.png](screenshots/request-demo-full.png) | Demo form page |

![Home hero](screenshots/hero.png)

## Brand assets

- Logo (dark text, for light backgrounds): [public/brand/azentio-logo.svg](../public/brand/azentio-logo.svg), 164×45, fills `#16303D` + `#2ED88E`.
- Logo (white text, for dark backgrounds / footer): [public/brand/azentio-logo-white.svg](../public/brand/azentio-logo-white.svg), fills `white` + `#2ED88E`.
- Wordmark is lowercase "azentio" with a green leaf/bookmark mark above the "o".

## Typography

**Font family: Poppins** (self-hosted on azentio.com as separate families per weight: `Poppins`, `PoppinsLight`, `PoppinsSemiBold`, `PoppinsBold`, …). Arabic pages use **Almarai**.

For our Next.js app load it with `next/font/google` (Poppins weights 300, 400, 500, 600, 700; Almarai 400/700 if we add RTL).

| Use | Weight | Size (desktop) | Notes |
|---|---|---|---|
| Hero H1 | 600 SemiBold | 70px, tight line-height (~1.1) | Colour `#16303d`; underline accent on last line |
| Section H2 | 600 SemiBold | 38–40px (30px mobile) | Always with mint underline accent (see below) |
| H3 / card title | 400–500 | 22–26px | Dark navy |
| H4 / H5 | 300 Light | 18–20px | `PoppinsLight` |
| Eyebrow label ("Our products", "Awards", "Key stats") | 400 | 14–16px | Sits above H2, navy, no caps |
| Body | 400 | 16–18px, line-height 26–28px | Colour `#76777a` on site default, `#16303d`/`#333` in content blocks |
| Small / meta (dates, category tags) | 400 | 13–14px | Grey `#76777a` |
| Buttons / links | 500–600 | 16–17px | |

Most common sizes in the CSS: 20, 18, 16, 14, 17px.

## Colour palette

| Token | Hex | Where it's used |
|---|---|---|
| `--az-navy` (primary dark) | `#16303D` | Headings, primary buttons, announcement bar, dark hero, key-stats band, footer, cookie bar. Most-used colour after white. |
| `--az-mint` (accent / CTA) | `#55FFBE` | Secondary pill buttons ("Demo", "Explore our solutions"), heading underlines, active tabs, slider arrows, CTA on dark |
| `--az-green` (brand green) | `#2ED88E` | Logo mark, icon accents, hover colour for nav links, illustrative shapes in hero |
| `--az-mint-tint` | `#DDFFF2` / `#55FFBE26` (mint at 15%) | Light section backgrounds (case studies, lifecycle grid, sanctions band) |
| `--az-grey-bg` | `#EFEFEF` / `#F8F8F8` | Contact form section, input fills |
| `--az-text-muted` | `#76777A` | Body copy, meta text |
| `--az-text` | `#333333` | Long-form text |
| `--az-white` | `#FFFFFF` | Page background, cards |
| `--az-deep-blue` (rare) | `#0D1C4F` | Occasional dark accent |
| Error | `#E74C3C` / `#DC3545` | Form validation |

Rule of thumb seen on the site: **white page, navy text, mint for action and emphasis, green for icons/illustration**. Dark (navy) bands alternate with white and mint-tint bands to give rhythm.

Suggested CSS tokens:

```css
:root {
  --az-navy: #16303d;
  --az-mint: #55ffbe;
  --az-green: #2ed88e;
  --az-mint-tint: #ddfff2;
  --az-grey-bg: #efefef;
  --az-text: #333333;
  --az-text-muted: #76777a;
  --az-white: #ffffff;
  --az-error: #e74c3c;
  --az-radius-card: 12px;
  --az-radius-pill: 50px;
  --az-shadow-card: 0 4px 6px #0000001a;
  --az-container: 1280px;
}
```

## Shape, spacing, elevation

- **Buttons: fully rounded pills** (`border-radius: 50px`), padding ~12px 28px.
- **Cards:** white, `border-radius` 10–12px, soft shadow `0 4px 6px #0000001a`, generous inner padding (~24px).
- Circular elements: slider arrows (40–50px circles), icon badges.
- Container: content max-width ~1280px (site uses 1166/1280/1300/1440 breakpoints), ~80px side gutter on desktop, 16–24px on mobile.
- Section vertical padding: 60–100px desktop, 40px mobile.
- Transitions: `0.3s ease-in-out` on background colour; nav links fade to green on hover.

## Signature design patterns

1. **Mint underline under headings.** Section H2s and the hero headline have a 3px `#55FFBE` bar under the first phrase (`.span-border-bottom { border-bottom: 3px solid #55ffbe }`). This is the single most recognisable Azentio motif — use it on every section title.
2. **Announcement bar.** Full-width navy strip above header: one-line message + mint pill "Read the report" + close ×.
3. **Header.** White, logo left; nav items (About Azentio, Products, Support, Insights) with chevron mega-menus; then **navy pill "Contact us"** + **mint pill "Demo"** + search icon.
4. **Hero.** Left: large two-line headline with underline, paragraph, mint pill CTA, dot pager (carousel). Right: person-with-device photo over a **geometric green shape collage** (bars, arcs, triangles in `#2ED88E`), plus a frosted-glass navy chip (icon + "Insurance / Consistent risk management").
5. **Floating "Book a Demo" tab** pinned to the right edge, vertical text, navy.
6. **Eyebrow + H2 + "View all" navy pill** aligned right — standard section header.
7. **Product category row.** 5 columns: line icon (navy with green accent stroke), bold title, short description, bold "Find out more" link.
8. **Card carousels** (awards, case studies, insights): 3 cards visible, circular prev/next arrows outside the row, dot pagination. Case-study cards: image top, category label, title, excerpt, bold "Read more".
9. **Key stats band.** Navy background, big white numbers with "+" (650+ clients, 30+ years, 1900+ professionals, 60+ countries, 19 locations), stacked offset white/mint/green tiles on the right.
10. **Testimonial slider.** Big navy quote marks, quote text, name + title.
11. **Product page hero.** Navy full-width band: product name (white, large), tagline, mint pill "Request a demo" + outline pill "View case study", green line-art illustration on right; breadcrumb below with logo mark.
12. **Stat cards** (e.g. 50% faster loan origination): white cards in a row, big navy number with small %.
13. **Split case-study block:** mint-tint left with quote/headline + mint pill CTA, video/image right.
14. **"Let's begin our journey together" contact block.** Grey background, left headline + arrow illustration, right two-column form (first/last name, business email, phone with country code, job title, company, country, enquiry type, comments, consent checkboxes), mint pill submit aligned right.
15. **Footer.** Navy, white logo, columns: SOLUTIONS (Banking, Insurance, Capital markets) · SOLUTIONS (Risk & compliance, ERP) · RESOURCES (Insights, Featured) · CONNECT (Support, Partners); green uppercase column headers; newsletter email field + mint "Subscribe now"; bottom row © + Privacy / Terms / Cookies / Support policy.
16. **Cookie banner.** Navy bottom bar, mint "Decline" / "Allow all" buttons.

## Imagery and icons

- Photography: professionals (often women) holding tablets, warm natural light, cut out over green geometric shapes.
- Icons: simple line icons, navy stroke with a green highlight element.
- Illustrations: flat geometric green shapes; green line-art on dark product heroes.

## Applying this to the portal

- Public pages: copy the patterns above directly (header, hero, category row, stats band, insights carousel, contact form, footer).
- Portal (employee/client) screens are not on azentio.com, so extend the system: navy sidebar or top bar, white content area, white cards with 12px radius, mint pills for primary actions, mint underline on page titles, mint-tint for empty states and info callouts.
- Status chips for the contribution lifecycle: use navy (submitted), mint-tint with navy text (in review), green (published), grey (draft/withdrawn), error red (rejected). Always pair colour with a text label.
- Keep contrast: mint `#55FFBE` on white fails WCAG for text; use it as a fill behind navy text, never as text colour on white.
