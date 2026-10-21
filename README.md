# I Am Human Foundation website

An eleven-page static site with one serverless function for email. No build step and no
dependencies: open `index.html` in a browser, or deploy the folder to Vercel.

**`index.html` is the Second Chance Initiative, not the landing page.** The campaign is
what the site opens on and what the logo returns to; the general landing page lives at
`home.html` and is reached through the "Home" nav item.

```
index.html            THE SECOND CHANCE INITIATIVE: the full prospectus, and the site root
home.html             Landing page: hero slider, featured project, mission, founder, giving
about.html            Who We Are: purpose, beliefs, how we work
mission.html          Our Mission: the five pillars in depth (anchored sections)
founder.html          Founder Story: Shalimar Abbiusi, with the video of her account
impact.html           Impact & Regions: Africa, Europe, Global Advocacy (anchored)
projects.html         Projects: delivered, ongoing, and in development
press.html            Press & Media: 12 real articles, project videos, media kit
launch-dinner.html    Our Launch: the November 2024 launch dinner, as a record
donate.html           Donate: every way to give, where it goes, FAQ
contact.html          Contact: form, volunteer + mailing list signup, details

thank-you.html        Payment receipt page Stripe returns to (noindex)

styles.css            design tokens, components, light/dark themes, responsive rules
script.js             theme toggle, hero + event sliders, video facades, dropdowns,
                      mobile menu, reveals, copy-IBAN, form delivery, Stripe checkout
api/contact.js        serverless mail handler for both forms (see "Email" below)
api/checkout.js       serverless Stripe Checkout handler (see "Payments" below)
check-payments.sh     one command to confirm card payments are live
package.json          declares type:module so the two api functions load as ESM
.env.example          the environment variable names, with no values
assets/               logo-emblem.png, founder-shalimar.jpg, photos/p01–p77.jpg
pictures/             original source images (not referenced directly by the site)
```

## Navigation

The header carries five top-level items; three open a dropdown on hover **and** on keyboard
focus. Every item is also a real link, so the top level works without ever opening a menu.

| Top level | Links to | Dropdown |
|---|---|---|
| Second Chance | `index.html` | n/a |
| Home | `home.html` | n/a |
| About | `about.html` | Who We Are · Our Mission · Founder Story |
| Our Work | `impact.html` | Impact & Regions · Projects · Press & Media |
| Get Involved | `donate.html` | Donate · Our Launch · Contact |
| **Donate** (button) | `donate.html` | n/a |

The brand logo, top left, points at `index.html`, the Second Chance Initiative. That is
deliberate: the campaign is the front door. "Second Chance" also carries a small brand dot
(`.nav__link--flag`) so it reads as the flagship rather than as one item among five.

On mobile the same structure appears in the full-screen menu, with each group's children as
pill links beneath it.

### The Second Chance page has its own menu

Below the site header, `index.html` carries a second sticky bar (`.subnav`) listing the nine
sections of the prospectus. `subnavModule` in `script.js` drives it: it offsets anchor jumps
past both sticky bars, marks the current section with an IntersectionObserver, and scrolls
the active chip into view when the bar itself has to scroll sideways on narrow screens. The
bar only exists on that page; the module returns early when `#subnav` is absent.

### Keeping the eleven headers in sync

The header, mobile menu, footer, and icon sprite are **byte-identical in all eleven pages**.
Only two things differ per page: the `<title>`/`<meta description>`, and the `data-page`
attribute on `<body>`. The active nav item is derived from `data-page` in CSS, so changing
which item is highlighted never means editing markup.

If you change the header or footer, change it in every page. To confirm they have not
drifted apart:

```bash
grep -c 'nav__item--has-menu' *.html      # expect 3 in every file
grep -c 'data-nav="second"' *.html        # expect 1 in every file
grep -c 'press.html' *.html               # expect 3 in every file (nav, mobile, footer)
```

The icon sprite must also be identical. Every `href="#i-…"` has to have a matching
`<symbol id="i-…">` **in the same file**. A sprite is per-document, so an icon used on one
page but defined only on another renders as an empty box:

```bash
python3 - <<'EOF'
import glob, re
for f in sorted(glob.glob('*.html')):
    s = open(f).read()
    missing = set(re.findall(r'href="#(i-[a-z-]+)"', s)) - set(re.findall(r'symbol id="(i-[a-z-]+)"', s))
    if missing: print(f, sorted(missing))
EOF
```

## Design system

All colour, type, spacing, and shape values live as custom properties at the top of
`styles.css`. Change a token there and it propagates everywhere.

The ramps are sampled from the logo emblem, so the palette and the mark agree.

| Role | Light | Dark |
|---|---|---|
| Background | warm ivory `#FBF6EE` | deep teal-navy `#041219` |
| Text | teal ink `#0C2731` | ivory `#EFE6D8` |
| Headline emphasis, links | `--grad-brand-text` (teal → leaf) | brightened teal → leaf |
| Buttons and controls | `--grad-brand-btn` | same |
| Gold (icon plates, status tags, globe) | `--gold-700` | `--gold-400` |
| Hopeful accent | terracotta + leaf green | terracotta + leaf green |

- **Brand colour**: `--teal-*` and `--leaf-*` are lifted straight off `logo-emblem.png`
  (`#0C3A48` → `#1FA5C9` → `#2FB47C`). `--navy-*` keeps its name but holds the logo's
  teal-navy.
- **Text and every interactive control is the logo colour.** That covers the italic `<em>`
  emphasis in every headline (`--grad-brand-text`, with `--grad-brand-text-light` for the
  same text on dark bands), `.subhead`, `.bigquote`, pull-quotes, `.card__link`,
  `.btn--text`, breadcrumbs, prose and footer links, display numerals (hero counter, event
  date chip, `.step__num`), plus all buttons, the floating mobile CTA, the mailing-list
  submit, the featured-card ring and its "Most popular" flag, the copy-IBAN button, form
  focus rings, hover borders and `::selection`.
- **Three brand gradients, because they do different jobs.** `--grad-brand` is the bright
  cut, for things that carry no text: eyebrow dots, section rules, the scroll progress bar,
  pillar icons. `--grad-brand-btn` is a deliberately deeper cut for anything with white
  text on it. `--grad-brand-text` clips to headline type.
- **Do not put white text on `--grad-brand`.** Its light stops are 2.9:1 and 2.6:1 against
  white, which fails WCAG AA outright. `--grad-brand-btn` exists for that reason: its stops
  measure 8.1:1, 5.6:1 and 5.3:1, so the text stays legible across the whole sweep and
  through the hover shift.
- Contrast for brand *text*: on ivory, `--teal-700` 7.6:1 and `--leaf-700` 6.1:1, with the
  lightest mid-stop `--teal-600` at 4.1:1 (it only ever carries large display type, where
  the AA floor is 3:1). On the dark ground every stop clears 9:1.
- **What is still gold**, deliberately, as the warm counterweight: the icon plates on cards,
  giving options and event details; `.tag--gold` status chips; the globe pins; and the
  founder plate glow.

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
`.media` (gradient placeholders) · `.band` / `.band--sunk` (section tints) ·
`.gallery` (masonry photo mosaic) · `.video` + `.video-grid` (click-to-load video) ·
`.press-list` + `.press-item` (coverage links) · `.check-grid` + `.check` (checkbox rows).

**Video** uses a facade rather than an embed: `.video__btn` carries `data-video="<youtube-id>"`
and a local poster image, and `script.js` swaps in a `youtube-nocookie.com` iframe only once
the visitor presses play. Nothing is requested from Google before that click.

**The gallery is a masonry**, `columns: 4` stepping down to 2, so every photograph keeps its
own proportions. Do not add fixed heights or `object-fit: cover` back to `.gallery__item img`;
that is what was cropping the landscape shots in half.

## The Second Chance Initiative page

`index.html` is a straight transcription of the Founding Partnership & Sponsorship
Prospectus: the conviction and its three-line creed, the four programme routes, the five
partnership tiers, the full benefit list for all five, the Friend tier, the six ways to open
a door, the track record with its three headline numbers, and the closing detail rows.

The prospectus also described a launch reception (28 November 2026, Accra) with individual
tickets and event perks on every tier. That event was removed from the site in October 2026:
the reception section, the `ticket` checkout item, and every invitation, stage and
reception benefit are gone. The Initiative, its tiers and its prices are unchanged.

Its components are namespaced and live in section 9 of `styles.css`, so nothing there
touches the rest of the site: `.sc-hero` · `.subnav` · `.creed` · `.sc-coda` · `.spec-grid`
· `.runsheet` · `.tiers` + `.tier--top` · `.benefit` + `.ticklist` · `.door-grid` ·
`.recgrid` · `.statline` · `.deets`.

Two things worth knowing before editing it:

- **The tick marks in `.ticklist` are drawn with a CSS mask**, not an icon, so they inherit
  `--brand` on light cards and `--teal-300` on the inverted ones without needing two sprites.
- **Any `<img>` sized by `aspect-ratio` also needs `height: auto`.** The `height=""`
  attribute is a presentational hint that otherwise wins, which is what stretched the track
  record photos into columns on the first pass.

Six icons were added to the sprite for this page and back-ported to every other page:
`i-crown`, `i-gem`, `i-star`, `i-tools`, `i-briefcase`, `i-link`.

## Payments

Card payments run through **Stripe Checkout**. The browser never handles card data and
neither does this site: `api/checkout.js` creates a Checkout Session server side and returns
its URL, and the browser redirects to Stripe's own page. That keeps the site out of PCI
scope entirely.

### Setup

One environment variable is required, set in **Vercel -> the project -> Settings ->
Environment Variables**, never in this repo:

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `sk_live_…` in production, `sk_test_…` while testing |
| `SITE_URL` | no | Canonical origin for Stripe's return URLs. Defaults to the request origin |
| `SECOND_CHANCE_CURRENCY` | no | Currency for prospectus items. Default `usd` |
| `STRIPE_CURRENCY` | no | Currency for general donations. Default `eur` |
| `STRIPE_PRICES` | see below | JSON price table in minor units. Required if you change a currency |

**No publishable key is needed.** The redirect flow never calls Stripe from the browser, so
there is no `pk_…` anywhere in the source. One less key to rotate.

Until `STRIPE_SECRET_KEY` is set the endpoint answers **501** and the buttons show a message
pointing at bank transfer, so giving never silently breaks.

### What is wired up

| Where | Item id | Price |
|---|---|---|
| `donate.html` panel, `home.html` giving card | `donation` | Open, EUR 1 to 50,000. Optional monthly |
| Second Chance tiers | `tier-founding` … `tier-champion` | USD 4,500 / 2,500 / 1,500 / 850 / 450 |
| Friend of Second Chance | `friend` | Open, USD 90 to 449 |

### The rule that matters

**Fixed prices live in `CATALOGUE` in `api/checkout.js`, on the server. The browser sends an
item id and never a price.** Anyone can edit the page in devtools; if the client could name
the amount, a GHS 50,000 partnership could be bought for GHS 1. Open amounts are range
checked server side against `OPEN` for the same reason. If you add an item, add it to the
catalogue, never to the markup alone.

Two smaller guards worth keeping: `cancel_url` is validated against a path pattern rather
than sanitised character by character, and item lookup uses `hasOwnProperty` so an id like
`constructor` cannot reach through to `Object.prototype`.

### Currency

The prospectus quotes Ghana Cedis, but **Stripe does not support Ghana as an account
country** and GHS is not a presentment currency for most accounts. Ghana is served through
Paystack instead. So the site charges **USD**, which every Stripe account can present.

The GHS figures are kept in the catalogue beside each USD price, as the record of where the
conversion came from:

| Tier | Prospectus | Charged |
|---|---|---|
| Founding Partner | GHS 50,000 | USD 4,500 |
| Impact Partner | GHS 30,000 | USD 2,500 |
| Programme Partner | GHS 15,000 | USD 1,500 |
| Supporting Partner | GHS 10,000 | USD 850 |
| Second Chance Champion | GHS 5,000 | USD 450 |
| Friend of Second Chance | GHS 1,000 to 4,999 | USD 90 to 449 |

Converted at **11.3730 GHS per USD**, the mid of two independent rates on **2026-09-07**,
then set to clean sponsorship figures. Founding, Programme and Champion sit above the
converted amount; Impact and Supporting sit slightly below it, by USD 138 and USD 29. Those
are deliberate prices, not conversion drift. The cedi moves, so re-check before a major
campaign and before reprinting the prospectus. Friend tops out at USD 449 so it stays
strictly below the Champion tier, as GHS 4,999 did below GHS 5,000.

Prices are stored per currency, and that is deliberate. An early version let an env var swap
the currency while leaving the amount alone, so switching to EUR would have charged a
founding partner EUR 50,000 instead of GHS 50,000, roughly sixteen times over. Now each item
carries a `prices` map keyed by currency, and an item with no price in the configured
currency is **refused with a 501** rather than sold at a figure meant for another currency.
Never reintroduce a bare currency swap.

### Paying in other currencies

Cards from any country work already: the charge is presented in USD and the cardholder's own
bank converts. To go further and show each visitor **their own local currency**, turn on
**Adaptive Pricing** in the Stripe Dashboard at
[settings/adaptive-pricing](https://dashboard.stripe.com/settings/adaptive-pricing). It
covers 150+ countries, needs no code change, and costs the foundation nothing (the 2 to 4
per cent conversion fee is borne by the payer, who can always choose to pay in USD instead).

Two caveats worth knowing. Adaptive Pricing requires the price currency to be one of your
**settlement currencies**, so a euro-settling account needs USD settlement added before it
takes effect. And Ghana is not among the 150+ covered markets, so Ghanaian supporters will
see USD either way.

### Going live: the whole checklist

The code is deployed and every payment button is wired. Only the key is missing.

1. **Roll the Stripe secret key.** Dashboard -> Developers -> API keys. Roll it, because
   any key that has been pasted into a chat, an email or a ticket should be considered
   public. Copy the new `sk_live_…`.
2. **Add it in Vercel.** Project -> Settings -> Environment Variables (or click into the
   Production environment). Add `STRIPE_SECRET_KEY`, tick **Production**, Save. Add
   `SITE_URL` = `https://iamhumanfdn.org` at the same time, so Stripe's receipt and cancel
   links return to the real domain rather than the vercel.app one.
3. **Redeploy.** Vercel does not apply variables to existing deployments. Deployments ->
   the latest one -> Redeploy.
4. **Confirm it worked**, without spending anything:

   ```bash
   ./check-payments.sh
   ```

   Four `OK` lines means live. `WAIT` means the key is not set or the redeploy has not
   happened. `FAIL` prints what Stripe objected to.

Start with a `sk_test_…` key and card `4242 4242 4242 4242` if you want to watch one go
through first. Same variable, different value, redeploy again to switch to live.

### Testing before going live

Use a `sk_test_…` key and card `4242 4242 4242 4242`, any future expiry, any CVC. Stripe's
dashboard has a test-mode toggle; payments made with a test key never appear in live mode.

## Press coverage

`press.html` lists **12 real articles**, newest first, each linked to its original
publication. Every URL was checked before being added. Do not add an item without opening
it first: fabricated or dead press citations damage the foundation's credibility far more
than a short list does.

Verified end to end (headline, publication and date read from the article itself):

| Publication | Date | Story |
|---|---|---|
| Graphic Online | 9 Dec 2025 | Farmers' Day outreach in Nima |
| MyJoyOnline | 13 Aug 2025 | Over $9K to empower 150 women in Edo State |
| Ghana News Agency | 26 Nov 2024 | ECOWAS Court rules Ghana violated her rights |
| DailyGuide Network | 11 Nov 2024 | Foundation launch announced |

The rest resolve but sit behind bot protection, so their headlines come from search results
and are corroborated by at least one other outlet covering the same event: GhanaWeb (three
pieces), The Guardian Nigeria, ModernGhana, 3News, YEN.com.gh and Citi Newsroom.

To re-check every link at once:

```bash
python3 - <<'EOF' | while read -r u; do
  printf '%-4s %s\n' "$(curl -sL -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0' "$u")" "$u"
done
import re
print('\n'.join(re.findall(r'class="press-item" href="(https://[^"]+)"', open('press.html').read())))
EOF
```

A 403 or 406 means bot protection, not a dead link; those pages open normally in a browser.
A 404 must be removed. One candidate (ghanamma.com) was dropped for exactly that reason.

**Instagram cannot be scraped.** The profile is fetchable for bio and highlight names, but
captions and the links inside story highlights are not readable without logging in. New
coverage has to be added here by hand, or supplied as a list.

## Images

| Asset | Used on | Notes |
|---|---|---|
| `logo-emblem.png` | every page (header, footer, favicon) | Emblem cropped from the supplied lockup |
| `founder-shalimar.jpg` | `index.html`, `founder.html` | Founder portrait, 781×976 (4:5) |
| `launch-dinner.jpg` | `launch-dinner.html` | Event page hero image |
| `photos/p01`–`p77.jpg` | throughout | Foundation photography from Ghana and Nigeria |
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
- **Europe photograph**: the one remaining gradient panel, on `impact.html#europe`. The HTML
  comment above it gives the exact markup to paste in. Wanted: the founder speaking at a
  conference (the Belgium talk), presenting a donation, or a press article.
- **Mission pillars**: two gradient panels remain on `mission.html`: Essential Needs and
  Tailored Local Impact.
- **Partner logos**: `.partners__list` on `impact.html`.
- **Press articles**: `press.html#coverage` carries three real links plus a `CMS PLACEHOLDER`
  comment with the exact `.press-item` shape. The Instagram highlights on `@shallieabbiusi` and
  `@iamhumanfdn` hold the article links to add.
- **Project updates**: the placeholder tiles at the foot of `projects.html`.

## Email

Both forms (contact, and the volunteer/mailing-list signup) POST JSON to `/api/contact`,
handled by `api/contact.js` as a Vercel Serverless Function. Vercel picks up the `api/`
folder with no configuration.

Delivery goes through [Resend](https://resend.com). Set these in **Vercel → Project →
Settings → Environment Variables**, then redeploy:

| Variable | Value | Required |
|---|---|---|
| `RESEND_API_KEY` | your Resend API key | yes |
| `MAIL_FROM` | a verified sender on the domain, e.g. `website@iamhumanfdn.org` | yes |
| `MAIL_TO` | where messages land; defaults to `contact@iamhumanfdn.org` | no |

Resend needs `iamhumanfdn.org` verified (it gives you the DNS records) before it will send
as an address on the domain.

**Until `RESEND_API_KEY` is set** the endpoint answers `501`, and `script.js` falls back to
opening the visitor's own mail client with the message pre-filled to
`contact@iamhumanfdn.org`. So mail reaches the foundation either way, and nothing is ever
silently accepted and dropped, which is what the old placeholder handler did.

Both forms carry an off-screen `.hp` honeypot field. Submissions that fill it in are answered
`200` and discarded.

## Things that still need connecting

| What | Where | Needs |
|---|---|---|
| Mail service | Vercel env vars | `RESEND_API_KEY` + `MAIL_FROM`, see **Email** above. |
| Social links | footer + `contact.html` | Real profile URLs, currently `href="#"`. Instagram is `@iamhumanfdn`. |
| Registered office | `contact.html` | Marked `TO CONFIRM`; currently reads "Address to be published." |
| Privacy / Terms / Accessibility | footer | Pages do not exist yet. |

Live and verified: the GoFundMe link and the bank details (account name **I Am Human**,
IBAN **BE74 9735 0897 5707**, with copy-to-clipboard). Launch dinner ticket sales are closed
and every ticket link has been removed.

## Editorial rules applied

No invented impact statistics appear anywhere on the site. Work is labelled with honest
status tags: *Delivered* for projects that have happened, *Ongoing* for continuous work,
*In development* / *Building* / *Expanding* for what is still ahead. Delivered projects are
backed by the photographs and video they are shown with.

Facts drawn from the photographs and video themselves, and worth a second check before a
press push: the market-women programme is dated **June 2025** in **Auchi, Edo North**, in
collaboration with **Sen. Adams Oshiomhole**, and the Ghana distribution is in **Nima,
Accra**. The naira figure on the presentation cheque is deliberately not quoted in body copy.

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
