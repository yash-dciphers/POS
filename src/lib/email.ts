// Sends mail through Microsoft Graph using the app-only (client credentials)
// flow, so no user needs to be signed in for the app to send as the shared
// mailbox in MAIL_FROM.
//
// Graph's sendMail takes a single body content type, so there's no plain-text
// alternative alongside the HTML — messages are HTML only. That's fine for
// internal mail; it would matter more for bulk sending to outside domains.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

// Tokens last about an hour. Caching one at module scope means a burst of
// sends shares a single token request; the 60s safety margin avoids using a
// token that expires mid-flight.
let cachedToken: { value: string; expiresAt: number } | null = null;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing. Add it to .env.local (and to the Vercel environment variables in production).`);
  return value;
}

// MAIL_FROM may be a bare address or "Display Name <addr@domain>"; Graph
// addresses the sending mailbox by the bare address.
function senderAddress(): string {
  const mailFrom = requireEnv('MAIL_FROM');
  return mailFrom.match(/<([^>]+)>/)?.[1]?.trim() ?? mailFrom.trim();
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const tenantId = requireEnv('MS_TENANT_ID');
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('MS_CLIENT_ID'),
      client_secret: requireEnv('MS_CLIENT_SECRET'),
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    // AADSTS7000222 (expired secret) is the one that bites eventually — the
    // client secret has a fixed lifetime and sending stops the day it lapses.
    throw new Error(`Microsoft token request failed: ${payload.error_description ?? payload.error ?? response.status}`);
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export async function sendEmail({ to, subject, html }: EmailMessage): Promise<void> {
  const token = await getAccessToken();
  const from = senderAddress();

  const response = await fetch(`${GRAPH_ENDPOINT}/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  // A successful sendMail is 202 Accepted with an empty body.
  if (response.status === 202) return;

  const body = await response.text();
  throw new Error(`Microsoft Graph refused to send (${response.status}): ${body}`);
}
