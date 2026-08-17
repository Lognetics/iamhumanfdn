# I Am Human Foundation website

A nine-page static site. No build step and no dependencies: open `index.html` in a browser,
or serve the folder with any static host (Netlify, Vercel, GitHub Pages, S3).

```
index.html            Home: the full campaign landing page
about.html            Who We Are: purpose, beliefs, how we work
mission.html          Our Mission: the four pillars in depth (anchored sections)
founder.html          Founder Story: Shalimar Abbiusi
impact.html           Impact & Regions: Africa, Europe, Global Advocacy (anchored)
projects.html         Projects: what is being scoped and developed
launch-dinner.html    Launch Dinner: the event, programme, tickets, FAQ
donate.html           Donate: every way to give, where it goes, FAQ
contact.html          Contact: form, details, ways to get involved

styles.css            design tokens, components, light/dark themes, responsive rules
script.js             theme toggle, hero + event sliders, dropdowns, mobile menu,
                      reveals, copy-IBAN, forms
assets/               logo-emblem.png, community-school.jpg, advocacy-court.jpg
pictures/             original source images (not referenced directly by the site)
```

## Navigation

The header carries four top-level items; three open a dropdown on hover **and** on keyboard
focus. Every item is also a real link, so the top level works without ever opening a menu.

| Top level | Links to | Dropdown |
|---|---|---|
| Home | `index.html` | n/a |
| About | `about.html` | Who We Are · Our Mission · Founder Story |
| Our Work | `impact.html` | Impact & Regions · Projects |
| Get Involved | `donate.html` | Donate · Launch Dinner · Contact |
| **Donate** (button) | `donate.html` | n/a |

On mobile the same structure appears in the full-screen menu, with each group's children as
pill links beneath it.

### Keeping the nine headers in sync

The header, mobile menu, footer, and icon sprite are **byte-identical in all nine pages**.
Only two things differ per page: the `<title>`/`<meta description>`, and the `data-page`
attribute on `<body>`. The active nav item is derived from `data-page` in CSS, so changing
which item is highlighted never means editing markup.

If you change the header or footer, change it in every page. To confirm they have not
drifted apart:

```bash
grep -c 'nav__item--has-menu' *.html      # expect 3 in every file
```

## Design system

All colour, type, spacing, and shape values live as custom properties at the top of
`styles.css`. Change a token there and it propagates everywhere.

| Role | Light | Dark |
|---|---|---|
| Background | warm ivory `#FBF6EE` | deep navy `#04101F` |
| Text | navy ink `#0F2138` | ivory `#EFE6D8` |
| Gold accent | `--gold-700` | `--gold-400` |
| Hopeful accent | terracotta + emerald | terracotta + emerald |

- **Type**: Fraunces (serif headlines) + Inter (sans body), loaded from Google Fonts with
  system-serif/sans fallbacks. Sizes use a fluid `clamp()` scale (`--step--1` … `--step-5`).
- **Themes**: light is defined on bare `:root`; dark is defined twice, once under
  `prefers-color-scheme` (guarded so an explicit light choice wins) and once under
  `[data-theme="dark"]`. **Light is the default first view on every page**, whatever the
  visitor's OS setting: dark is only ever applied when they have chosen it with the toggle,
  which saves to `localStorage` under `iah-theme`. An inline script in `<head>` applies that
  stored choice before first paint, so there is no flash.

### Component classes worth knowing

`.page-hero` (inner-page header with breadcrumb) · `.split` (text beside media, with
`--flip`, `--wide-text`, `--wide-media`) · `.rich` (long-form copy) · `.grid-cards` + `.card`
· `.steps` + `.step` (auto-numbered) · `.faq` (native `<details>`) · `.info-panel` ·
`.cta-band` (shared closing band) · `.form` + `.field` · `.photo` (real images) ·
`.media` (gradient placeholders) · `.band` / `.band--sunk` (section tints).

## Images

| Asset | Used on | Notes |
|---|---|---|
| `logo-emblem.png` | every page (header, footer, favicon) | Emblem cropped from the supplied lockup |
| `founder-shalimar.jpg` | `index.html`, `founder.html` | Founder portrait, 781×976 (4:5) |
| `launch-dinner.jpg` | `launch-dinner.html` | Event page hero image |
| `community-school.jpg` | `index.html`, `about.html`, `impact.html` | Corrected from a 90°-rotated original |
| `advocacy-court.jpg` | `founder.html` | Court protest, see the credit note below |
| `mission-advocacy.jpg` | `mission.html` | Advocacy & Justice pillar, 4:3 |
| `mission-community.jpg` | `mission.html` | Community Empowerment pillar, 4:3 |

Each was derived from an original in `pictures/` or from a supplied photograph. Two were
repaired on the way in: the schoolchildren photo was stored rotated 90°, and the founder
portrait arrived with a black frame baked into the file, which has been cropped off.

**The court photograph is a broadcast still from JoyNews (myjoyonline.com)**. It is credited
in its caption on `founder.html`. Confirm you have the right to republish it before the site
goes live, or replace it with an image you own.

The founder portrait is used in both founder boxes site-wide. If you replace it, swap the two
`assets/founder-shalimar.jpg` references and keep the 4:5 aspect ratio so the framing holds.

**Placeholders still to replace.** Every one is a `<figure class="media">` holding a
`.media__art` gradient panel and a `.media__badge` label, marked in the HTML with a comment
describing the intended photograph. To use a real photo, swap the figure for the `.photo`
component, no CSS changes needed:

```html
<figure class="photo photo--tall">
  <img src="assets/founder-shalimar.jpg" alt="Shalimar Abbiusi, Founder of I Am Human Foundation"
       width="1080" height="1350" loading="lazy" decoding="async">
</figure>
```

Aspect modifiers: `--tall` / `--portrait` (4:5), `--wide` (16:10), `--square`, `--fill`
(fills a positioned parent, as in the event card), `--framed` (image plus a caption bar). Add
a `<figcaption>` with a `<b>` first line for a captioned photo.

- **Hero background**: `.hero__slides` in `index.html` holds the five slider photographs. To
  change them, swap the `<img>` inside each `.hero__slide` and update the matching `aria-label`
  on its `[data-hero-go]` dot in `.hero__controls`. Add or remove a slide and its dot together.
  `.hero__scrim` provides the contrast overlay, so any photograph keeps the headline readable.
- **Mission pillars**: two gradient panels remain on `mission.html`: Essential Needs and
  Tailored Local Impact. (Advocacy & Justice and Community Empowerment now use photographs.)
- **Europe / Global Advocacy**: two panels on `impact.html`.
- **Education tile**: the small panel in the home page welcome section.
- **Partner logos**: `.partners__list` on `impact.html`.
- **Project updates**: the placeholder tiles at the foot of `projects.html`.

## Things that still need connecting

| What | Where | Needs |
|---|---|---|
| Contact form | `contact.html` | A form handler (Formspree, Netlify Forms, or your own endpoint). Marked `BACKEND INTEGRATION POINT` in `script.js`. |
| Newsletter | footer, every page | An email provider. Marked `CMS/ESP INTEGRATION POINT` in `script.js`. |
| Social links | footer + `contact.html` | Real profile URLs, currently `href="#"`. |
| Registered office | `contact.html` | Marked `TO CONFIRM`; currently reads "Address to be published." |
| Email address | footer + `contact.html` | `info@iamhumanfdn.org` is assumed from the domain, so verify it. |
| Privacy / Terms / Accessibility | footer | Pages do not exist yet. |

Live and verified: the GoFundMe link, the Launch Dinner ticket link, and the bank details
(account name **I Am Human**, IBAN **BE74 9735 0897 5707**, with copy-to-clipboard).

## Editorial rules applied

No impact statistics appear anywhere on the site. Regional and project work is labelled with
honest status tags (*Scoping*, *In development*, *Planned*, *Ongoing*) and `projects.html`
states plainly that figures will be published only once they are real.

## Accessibility

- Semantic landmarks, exactly one `<h1>` per page, ordered headings, breadcrumb navigation.
- Dropdowns open on hover *and* `:focus-within`, so they are reachable by keyboard; `aria-expanded`
  is kept truthful by JS and `Escape` closes the menu and restores focus to its trigger.
- `aria-current="page"` is set on the active nav item.
- Skip link, visible focus rings, focus trap and `Escape` handling in the mobile menu, focus
  moved to the target after in-page navigation.
- Body and secondary text meet WCAG AA (4.5:1) in both themes; large display text meets 3:1.
- Every animation is disabled under `prefers-reduced-motion: reduce`.
- Decorative SVGs are `aria-hidden`; icon-only controls carry `aria-label`.

## Browser support

Modern evergreen browsers. `color-mix()` and `text-wrap: balance` are progressive
enhancements with declared fallbacks. Clipboard copy falls back to `execCommand`.
