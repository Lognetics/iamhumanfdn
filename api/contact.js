/**
 * Contact + mailing-list handler for I Am Human Foundation.
 *
 * Runs as a Vercel Serverless Function at POST /api/contact. It delivers through
 * Resend (https://resend.com), which needs two environment variables set in the
 * Vercel project:
 *
 *   RESEND_API_KEY   your Resend API key
 *   MAIL_FROM        a verified sender on your domain, e.g. website@iamhumanfdn.org
 *
 * Optional:
 *   MAIL_TO          where messages land (defaults to contact@iamhumanfdn.org)
 *
 * Until RESEND_API_KEY is set the endpoint answers 501, and the site falls back
 * to opening the visitor's own mail client, so nothing is silently lost.
 */

const MAIL_TO = process.env.MAIL_TO || 'contact@iamhumanfdn.org';
const MAIL_FROM = process.env.MAIL_FROM || 'website@iamhumanfdn.org';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // Honeypot: real people leave this hidden field empty. Answer 200 so a bot
  // filling it in learns nothing from the response.
  if (clean(body.company, 200)) return res.status(200).json({ ok: true });

  const type = body.type === 'subscribe' ? 'subscribe' : 'contact';
  const email = clean(body.email, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const name = clean(body.name, 120);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 6000);
  const interests = Array.isArray(body.interests)
    ? body.interests.map((i) => clean(i, 60)).filter(Boolean).join(', ')
    : clean(body.interests, 300);

  if (type === 'contact' && message.length < 10) {
    return res.status(400).json({ error: 'Please add a little more detail to your message.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'Email delivery is not configured yet.' });
  }

  const heading = type === 'subscribe'
    ? 'New mailing list signup'
    : 'New message from the website';

  const rows = [
    ['Name', name || '(not given)'],
    ['Email', email],
    type === 'subscribe' ? ['Interested in', interests || '(not specified)'] : ['Subject', subject || 'General enquiry'],
  ];

  const html = `
    <h2 style="font-family:system-ui,sans-serif">${escapeHtml(heading)}</h2>
    <table style="font-family:system-ui,sans-serif;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:4px 12px 4px 0;color:#556"><strong>${escapeHtml(k)}</strong></td>
        <td style="padding:4px 0">${escapeHtml(v)}</td>
      </tr>`).join('')}
    </table>
    ${message ? `<p style="font-family:system-ui,sans-serif;white-space:pre-wrap;margin-top:16px">${escapeHtml(message)}</p>` : ''}
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `I Am Human Foundation <${MAIL_FROM}>`,
        to: [MAIL_TO],
        reply_to: email,
        subject: type === 'subscribe'
          ? `Mailing list: ${email}`
          : `Website: ${subject || 'General enquiry'}${name ? ` (${name})` : ''}`,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Resend rejected the message:', response.status, detail);
      return res.status(502).json({ error: 'The message could not be delivered.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Mail delivery failed:', err);
    return res.status(502).json({ error: 'The message could not be delivered.' });
  }
}
