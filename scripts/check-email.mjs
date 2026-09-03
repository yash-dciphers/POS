import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Verifies the Microsoft Graph mail setup end to end, the same way
// check-db-connection.mjs verifies the database: token first, then a real
// send. Splitting the two matters — a token proves the app registration and
// secret are right, and only the send proves admin consent and the sender
// mailbox. A single combined failure would leave you guessing which half
// is broken.
//
// Usage: npm run email:check -- someone@example.com

const [, , recipientArg] = process.argv;

if (!recipientArg) {
  console.error('Usage: npm run email:check -- <recipient@example.com>');
  process.exit(1);
}

const envText = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');

// Accepts double-quoted, single-quoted, or bare values, and trims stray
// whitespace around bare ones — the same shapes create-admin-user.mjs allows.
function readEnv(key) {
  const match = envText.match(new RegExp(`^${key}=(?:"([^"]*)"|'([^']*)'|(.*))$`, 'm'));
  const value = match?.[1] ?? match?.[2] ?? match?.[3]?.trim();
  return value || undefined;
}

const tenantId = readEnv('MS_TENANT_ID');
const clientId = readEnv('MS_CLIENT_ID');
const clientSecret = readEnv('MS_CLIENT_SECRET');
const mailFrom = readEnv('MAIL_FROM');

const missing = Object.entries({ MS_TENANT_ID: tenantId, MS_CLIENT_ID: clientId, MS_CLIENT_SECRET: clientSecret, MAIL_FROM: mailFrom })
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing from .env.local: ${missing.join(', ')}`);
  process.exit(1);
}

// MAIL_FROM may be either a bare address or "Display Name <addr@domain>".
// Graph addresses the mailbox by the bare address only.
const senderAddress = mailFrom.match(/<([^>]+)>/)?.[1]?.trim() ?? mailFrom.trim();

// --- Step 1: token -----------------------------------------------------

console.log('1/2  Requesting token from Microsoft...');

let accessToken;
try {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const code = String(payload.error_description ?? '').match(/AADSTS\d+/)?.[0];
    console.error(`\nTOKEN_FAILED  ${response.status}  ${code ?? payload.error ?? 'unknown'}`);
    console.error(explainTokenError(code));
    console.error(`\nFull message: ${payload.error_description ?? JSON.stringify(payload)}`);
    process.exit(1);
  }

  accessToken = payload.access_token;
  console.log('     Token acquired — tenant ID, client ID and secret are all valid.');
} catch (error) {
  console.error(`\nTOKEN_REQUEST_ERROR  ${error.message}`);
  console.error('Could not reach login.microsoftonline.com. Check network or proxy.');
  process.exit(1);
}

// --- Step 2: send ------------------------------------------------------

console.log(`2/2  Sending a test message as ${senderAddress} to ${recipientArg}...`);

const message = {
  message: {
    subject: 'DCIPHERS PO System — mail setup test',
    body: {
      contentType: 'HTML',
      content: [
        '<p>This is a test message from the DCIPHERS Purchase Order system.</p>',
        '<p>If you are reading this, Microsoft Graph sending is configured correctly:',
        ' the app registration, client secret, admin consent and sender mailbox all work.</p>',
        `<p style="color:#64707F;font-size:12px">Sent from ${senderAddress} via Microsoft Graph.</p>`,
      ].join(''),
    },
    toRecipients: [{ emailAddress: { address: recipientArg } }],
  },
  saveToSentItems: true,
};

const sendResponse = await fetch(
  `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderAddress)}/sendMail`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  }
);

// A successful sendMail returns 202 Accepted with an empty body.
if (sendResponse.status === 202) {
  console.log('     Accepted by Microsoft Graph.\n');
  console.log(`GRAPH_SEND_OK=true`);
  console.log(`\nCheck ${recipientArg} — including the spam folder. Delivery can take a minute.`);
  process.exit(0);
}

const errorBody = await sendResponse.text();
let graphCode;
try {
  graphCode = JSON.parse(errorBody)?.error?.code;
} catch {
  graphCode = undefined;
}

console.error(`\nGRAPH_SEND_FAILED  ${sendResponse.status}  ${graphCode ?? 'unknown'}`);
console.error(explainGraphError(graphCode, sendResponse.status, senderAddress));
console.error(`\nFull response: ${errorBody}`);
process.exit(1);

// --- Error explanations ------------------------------------------------

function explainTokenError(code) {
  switch (code) {
    case 'AADSTS7000215':
      return 'The client secret is wrong. Note that Azure shows a Secret ID and a Secret Value — MS_CLIENT_SECRET must be the Value, which is only displayed once at creation.';
    case 'AADSTS7000222':
      return 'The client secret has expired. Create a new one under Certificates & secrets.';
    case 'AADSTS700016':
      return 'No application with this client ID exists in this tenant. Check MS_CLIENT_ID, and that the app was registered in this same directory.';
    case 'AADSTS900023':
      return 'The tenant ID is not recognised. Check MS_TENANT_ID against the Directory (tenant) ID on the app registration Overview page.';
    default:
      return 'Check MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET against the app registration in Azure.';
  }
}

function explainGraphError(code, status, sender) {
  if (status === 403 || code === 'ErrorAccessDenied' || code === 'Authorization_RequestDenied') {
    return [
      'Authentication worked but sending was refused. Two usual causes:',
      '  1. Admin consent has not been granted for the Mail.Send application permission.',
      '     A Global or Exchange Admin must click "Grant admin consent" in API permissions.',
      '  2. An ApplicationAccessPolicy is restricting this app to different mailboxes',
      `     than ${sender}.`,
    ].join('\n');
  }
  if (code === 'MailboxNotEnabledForRESTAPI') {
    return `${sender} exists but has no Exchange Online mailbox that Graph can use. Shared mailboxes work; on-premises or unlicensed user accounts do not.`;
  }
  if (code === 'ErrorInvalidUser' || code === 'ResourceNotFound' || status === 404) {
    return `No mailbox found for ${sender}. Check MAIL_FROM matches a real mailbox in this tenant.`;
  }
  if (status === 401) {
    return 'The token was rejected. It may have expired mid-run — try again.';
  }
  return 'See the full response below for what Graph objected to.';
}
