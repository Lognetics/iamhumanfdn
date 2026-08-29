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
 *   STRIPE_CURRENCY_GHS  optional. Overrides the currency for the Second Chance
 *                        items if your Stripe account cannot present GHS.
 *                        e.g. set to "eur" or "usd".
 *   STRIPE_CURRENCY      optional. Overrides the currency for general donations.
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

// Second Chance prices are quoted in Ghana Cedis in the prospectus; general giving
// follows the foundation's euro account. Either can be overridden by env if the
// Stripe account does not support that presentment currency.
const GHS = (process.env.STRIPE_CURRENCY_GHS || 'ghs').toLowerCase();
const GEN = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();

/** Fixed-price items. `amount` is in minor units (pesewas / cents). */
const CATALOGUE = {
  'tier-founding': {
    amount: 5000000, currency: GHS,
    name: 'Founding Partner — The Second Chance Initiative',
    description: 'GHS 50,000 · 5 VIP invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-impact': {
    amount: 3000000, currency: GHS,
    name: 'Impact Partner — The Second Chance Initiative',
    description: 'GHS 30,000 · 3 VIP invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-programme': {
    amount: 1500000, currency: GHS,
    name: 'Programme Partner — The Second Chance Initiative',
    description: 'GHS 15,000 · 2 invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-supporting': {
    amount: 1000000, currency: GHS,
    name: 'Supporting Partner — The Second Chance Initiative',
    description: 'GHS 10,000 · 2 invitations to the launch reception, Accra, 28 November 2026.',
  },
  'tier-champion': {
    amount: 500000, currency: GHS,
    name: 'Second Chance Champion',
    description: 'GHS 5,000 · 1 invitation to the launch reception, Accra, 28 November 2026.',
  },
  'ticket': {
    amount: 90000, currency: GHS,
    name: 'Second Chance Launch Reception — individual ticket',
    description: 'GHS 900 per person. Entry, drinks and light bites, Accra, 28 November 2026.',
    quantityMax: 10,
  },
};

/** Open-amount items, range-checked server side. Bounds are in minor units. */
const OPEN = {
  donation: {
    currency: GEN, min: 100, max: 5000000,
    name: 'Donation to I Am Human Foundation',
    description: 'Supporting advocacy, essential needs, and community projects.',
    donate: true,
  },
  friend: {
    currency: GHS, min: 100000, max: 499900,
    name: 'Friend of Second Chance',
    description: 'GHS 1,000–4,999 · includes one complimentary reception seat.',
    donate: true,
  },
};

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

  if (fixed) {
    // The price comes from the server. Anything the client sent is ignored.
    amount = fixed.amount;
    if (fixed.quantityMax) {
      const q = Math.floor(Number(body.quantity));
      quantity = Number.isFinite(q) && q >= 1 ? Math.min(q, fixed.quantityMax) : 1;
    }
  } else {
    // Open amount: accept it, but only inside the published range.
    const minor = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(minor) || minor < open.min || minor > open.max) {
      const fmt = (v) => (v / 100).toLocaleString('en-US');
      return res.status(400).json({
        error: `Please enter an amount between ${fmt(open.min)} and ${fmt(open.max)}.`,
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
        currency: spec.currency,
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
