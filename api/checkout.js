/**
 * Stripe Checkout handler for I Am Human Foundation.
 *
 * Runs as a Vercel Serverless Function at POST /api/checkout. It creates a Stripe
 * Checkout Session and returns its URL; the browser then redirects to Stripe, so no
 * card details ever reach this site or this server.
 *
 * Environment variables, set in the Vercel project (never in this repo):
 *
 *   STRIPE_SECRET_KEY    required. Your sk_live_… (or sk_test_… while testing).
 *   SITE_URL             optional. Canonical origin for the return URLs.
 *                        Defaults to the request's own origin.
  *   SECOND_CHANCE_CURRENCY  optional. Currency for the prospectus items. Default ghs.
 *   STRIPE_CURRENCY         optional. Currency for general donations. Default eur.
 *   STRIPE_PRICES           optional. JSON price table, in the currency's minor unit,
 *                           e.g. {"tier-founding":{"eur":300000}}. Required when the
 *                           currency is changed, since prices are per currency.
 *
 * Until STRIPE_SECRET_KEY is set the endpoint answers 501 and the site keeps showing
 * its existing bank-transfer and GoFundMe routes, so giving never breaks.
 *
 * SECURITY: prices for fixed items live in CATALOGUE below, on the server. The browser
 * sends an item id, never a price. A visitor editing the page cannot buy a GHS 50,000
 * partnership for GHS 1. Open amounts are range-checked here too.
 */

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';
const STRIPE_VERSION = '2024-06-20';

/**
 * Which currency each group of items is charged in.
 *
 *   SECOND_CHANCE_CURRENCY  the prospectus items. Default 'ghs'.
 *   STRIPE_CURRENCY         general donations.    Default 'eur'.
 *
 * Prices below are keyed BY CURRENCY on purpose. A currency can never be changed
 * without supplying the matching amount, because switching 'ghs' to 'eur' while
 * keeping unit_amount 5000000 would charge EUR 50,000 instead of GHS 50,000.
 * If the configured currency has no price, the item is refused rather than
 * charged at the wrong figure.
 *
 * NOTE: Stripe does not support Ghana as an account country and GHS is not a
 * presentment currency for most accounts. A Belgium-based account will need the
 * eur prices filled in below (or via STRIPE_PRICES) before these items can sell.
 */
const SC_CUR = (process.env.SECOND_CHANCE_CURRENCY || 'ghs').toLowerCase();
const GEN_CUR = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();

/**
 * Optional JSON override, e.g.
 *   STRIPE_PRICES={"tier-founding":{"eur":300000},"ticket":{"eur":5500}}
 * Amounts are in the currency's minor unit. Merged over the table below.
 */
function priceOverrides() {
  if (!process.env.STRIPE_PRICES) return {};
  try {
    const parsed = JSON.parse(process.env.STRIPE_PRICES);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.error('STRIPE_PRICES is not valid JSON; ignoring it.');
    return {};
  }
}

/** Fixed-price items. `prices` maps currency -> amount in minor units. */
const CATALOGUE = {
  'tier-founding': {
    prices: { ghs: 5000000 },
    name: 'Founding Partner \u2014 The Second Chance Initiative',
    description: '5 VIP invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-impact': {
    prices: { ghs: 3000000 },
    name: 'Impact Partner \u2014 The Second Chance Initiative',
    description: '3 VIP invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-programme': {
    prices: { ghs: 1500000 },
    name: 'Programme Partner \u2014 The Second Chance Initiative',
    description: '2 invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-supporting': {
    prices: { ghs: 1000000 },
    name: 'Supporting Partner \u2014 The Second Chance Initiative',
    description: '2 invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-champion': {
    prices: { ghs: 500000 },
    name: 'Second Chance Champion',
    description: '1 invitation to the launch reception, Accra, 28 November 2026.',
  },
  'ticket': {
    prices: { ghs: 90000 },
    name: 'Second Chance Launch Reception \u2014 individual ticket',
    description: 'Entry, drinks and light bites. Accra, 28 November 2026.',
    quantityMax: 10,
  },
};

/** Open-amount items. `bounds` maps currency -> [min, max] in minor units. */
const OPEN = {
  donation: {
    group: 'general',
    bounds: { eur: [100, 5000000], usd: [100, 5000000], gbp: [100, 5000000] },
    name: 'Donation to I Am Human Foundation',
    description: 'Supporting advocacy, essential needs, and community projects.',
    donate: true,
  },
  friend: {
    group: 'second-chance',
    bounds: { ghs: [100000, 499900] },
    name: 'Friend of Second Chance',
    description: 'Includes one complimentary reception seat.',
    donate: true,
  },
};

/** Which currency an item is charged in. */
function currencyFor(item) {
  const open = Object.prototype.hasOwnProperty.call(OPEN, item) ? OPEN[item] : null;
  if (open) return open.group === 'general' ? GEN_CUR : SC_CUR;
  return SC_CUR;
}

/** Stripe's API is form-encoded, including for nested structures. */
function encode(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value === undefined || value === null) return;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object' && !Array.isArray(value)) encode(value, path, out);
    else if (Array.isArray(value)) value.forEach((v, i) => encode(v, `${path}[${i}]`, out));
    else out.push(`${encodeURIComponent(path)}=${encodeURIComponent(String(value))}`);
  });
  return out;
}

/**
 * Cancel URLs come from the browser, so they are validated rather than sanitised:
 * one leading slash, a page name, an optional anchor, nothing else. Anything that
 * does not match falls back to the donate page. A blunt character strip would let
 * "//evil.com/x" through as a protocol-relative-looking path.
 */
function safePath(value) {
  const raw = String(value == null ? '' : value).slice(0, 120);
  return /^\/[A-Za-z0-9._-]*(?:#[A-Za-z0-9_-]+)?$/.test(raw) ? raw : '/donate.html';
}

function originOf(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(501).json({ error: 'Card payments are not configured yet.' });
  }
  if (!/^sk_(test|live)_/.test(secret)) {
    console.error('STRIPE_SECRET_KEY does not look like a Stripe secret key.');
    return res.status(500).json({ error: 'Card payments are misconfigured.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const item = String(body.item || '').slice(0, 40);
  const origin = originOf(req);
  const fixed = Object.prototype.hasOwnProperty.call(CATALOGUE, item) ? CATALOGUE[item] : null;
  const open = Object.prototype.hasOwnProperty.call(OPEN, item) ? OPEN[item] : null;

  if (!fixed && !open) {
    return res.status(400).json({ error: 'Unknown item.' });
  }

  let amount;
  let quantity = 1;
  const spec = fixed || open;
  const currency = currencyFor(item);
  const overrides = priceOverrides();

  if (fixed) {
    // The price comes from the server, keyed by currency. Anything the client sent
    // is ignored. No price for the configured currency means no sale, rather than a
    // sale at a figure meant for a different currency.
    const table = { ...fixed.prices, ...(overrides[item] || {}) };
    amount = table[currency];
    if (!Number.isFinite(amount)) {
      console.error(`No ${currency} price for "${item}". Set STRIPE_PRICES or SECOND_CHANCE_CURRENCY.`);
      return res.status(501).json({
        error: 'This option is not available for online payment yet. Please contact us and we will arrange it.',
      });
    }
    if (fixed.quantityMax) {
      const q = Math.floor(Number(body.quantity));
      quantity = Number.isFinite(q) && q >= 1 ? Math.min(q, fixed.quantityMax) : 1;
    }
  } else {
    const bounds = (overrides[item] && overrides[item].bounds) || open.bounds[currency];
    if (!Array.isArray(bounds)) {
      console.error(`No ${currency} bounds for "${item}".`);
      return res.status(501).json({
        error: 'This option is not available for online payment yet. Please contact us and we will arrange it.',
      });
    }
    // Open amount: accept it, but only inside the published range.
    const minor = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(minor) || minor < bounds[0] || minor > bounds[1]) {
      const fmt = (v) => (v / 100).toLocaleString('en-US');
      return res.status(400).json({
        error: `Please enter an amount between ${fmt(bounds[0])} and ${fmt(bounds[1])}.`,
      });
    }
    amount = minor;
  }

  const email = String(body.email || '').trim().slice(0, 200);
  const recurring = body.recurring === true && !!open && item === 'donation';

  const payload = {
    mode: recurring ? 'subscription' : 'payment',
    success_url: `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${safePath(body.cancelPath)}`,
    line_items: [{
      quantity,
      price_data: {
        currency,
        unit_amount: amount,
        product_data: { name: spec.name, description: spec.description },
        ...(recurring ? { recurring: { interval: 'month' } } : {}),
      },
    }],
    metadata: { item, site: 'iamhumanfdn.org' },
  };

  if (!recurring && spec.donate) payload.submit_type = 'donate';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payload.customer_email = email;

  try {
    const response = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_VERSION,
      },
      body: encode(payload).join('&'),
    });

    const data = await response.json();

    if (!response.ok) {
      // Log the detail for the maintainer; tell the visitor only what helps them.
      console.error('Stripe rejected the session:', response.status, data && data.error);
      const code = data && data.error && data.error.code;
      if (code === 'currency_not_supported' || code === 'parameter_invalid_empty') {
        return res.status(502).json({
          error: 'This currency is not enabled on the payment account yet.',
        });
      }
      return res.status(502).json({ error: 'The payment could not be started.' });
    }

    return res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('Stripe checkout failed:', err);
    return res.status(502).json({ error: 'The payment could not be started.' });
  }
}
