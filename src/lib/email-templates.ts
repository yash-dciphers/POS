// Email HTML has to survive Outlook, which renders with Word's engine —
// so this is tables and inline styles only. No flexbox, no grid, no
// stylesheet: those are silently dropped or mangled by common clients.
// Colours match the app's own palette in globals.css.

const NAVY = '#101B33';
const GOLD = '#C9A227';
const TEXT = '#14171F';
const MUTED = '#64707F';
const BORDER = '#E3E6EC';
const WASH = '#F4F6F9';

// Names and passwords are user-supplied and go straight into markup. A
// password containing < or & would otherwise break the layout or inject
// tags, so everything interpolated below is escaped first.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(bodyRows: string): string {
  return `
<div style="margin:0;padding:24px 12px;background:${WASH};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;">
    <tr>
      <td style="background:${NAVY};padding:22px 28px;border-radius:8px 8px 0 0;">
        <div style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.04em;">DCIPHERS</div>
        <div style="color:rgba(255,255,255,.55);font-size:11.5px;margin-top:2px;">Purchase Order Management</div>
      </td>
    </tr>
    ${bodyRows}
    <tr>
      <td style="padding:16px 28px 24px;border-top:1px solid ${BORDER};">
        <div style="color:${MUTED};font-size:11px;line-height:1.6;">
          This is an automated message from the DCIPHERS Purchase Order system.
          If you weren't expecting it, please contact your administrator.
        </div>
      </td>
    </tr>
  </table>
</div>`.trim();
}

function credentialsBlock(email: string, password: string, appUrl: string, showSignIn = true): string {
  return `
    <tr>
      <td style="padding:0 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WASH};border:1px solid ${BORDER};border-radius:6px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Email</div>
              <div style="color:${TEXT};font-size:14px;font-family:Consolas,Monaco,monospace;margin-top:3px;">${escapeHtml(email)}</div>
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:14px;">Password</div>
              <div style="color:${TEXT};font-size:14px;font-family:Consolas,Monaco,monospace;margin-top:3px;">${escapeHtml(password)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF6E6;border-left:3px solid ${GOLD};border-radius:4px;">
          <tr>
            <td style="padding:12px 14px;">
              <div style="color:${TEXT};font-size:12.5px;line-height:1.6;">
                <strong>This password was created by an administrator</strong>, which means
                someone other than you has seen it. For your account's security, please sign in
                and change it to something only you know.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${
      showSignIn
        ? `<tr>
      <td style="padding:22px 28px 6px;">
        <a href="${escapeHtml(appUrl)}/login"
           style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:600;padding:11px 22px;border-radius:6px;">
          Sign in
        </a>
        <div style="color:${MUTED};font-size:11.5px;margin-top:10px;">
          Or paste this into your browser: ${escapeHtml(appUrl)}/login
        </div>
      </td>
    </tr>`
        : ''
    }`;
}

export interface WelcomeEmailParams {
  fullName: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  invitedByName: string;
  appUrl: string;
}

export function buildWelcomeEmail(params: WelcomeEmailParams): { subject: string; html: string } {
  const roleLabel = params.role === 'admin' ? 'Administrator' : 'User';

  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">You've been given access</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.fullName)} — ${escapeHtml(params.invitedByName)} has set up an account
          for you on the DCIPHERS Purchase Order system, with the role of
          <strong style="color:${TEXT};">${roleLabel}</strong>. Here are your sign-in details.
        </div>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
    ${credentialsBlock(params.email, params.password, params.appUrl, false)}
    <tr><td style="height:18px;"></td></tr>
  `);

  return { subject: 'Your DCIPHERS Purchase Order system account', html };
}

export interface PasswordResetEmailParams {
  fullName: string;
  email: string;
  password: string;
  resetByName: string;
  appUrl: string;
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams): { subject: string; html: string } {
  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">Your password has been reset</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.fullName)} — ${escapeHtml(params.resetByName)} has set a new password
          on your DCIPHERS Purchase Order account. Your previous password no longer works.
        </div>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
    ${credentialsBlock(params.email, params.password, params.appUrl)}
    <tr><td style="height:18px;"></td></tr>
  `);

  return { subject: 'Your DCIPHERS Purchase Order password was reset', html };
}

export interface PendingApprovalEmailParams {
  adminName: string;
  requesterName: string;
  poNumber: string;
  vendorName: string;
  grandTotal: number;
  currency: string;
}

export function buildPendingApprovalEmail(params: PendingApprovalEmailParams): { subject: string; html: string } {
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: params.currency,
    maximumFractionDigits: 2,
  }).format(params.grandTotal);

  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">Purchase order awaiting approval</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.adminName)} — ${escapeHtml(params.requesterName)} has submitted
          <strong style="color:${TEXT};">${escapeHtml(params.poNumber)}</strong> for approval.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WASH};border:1px solid ${BORDER};border-radius:6px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Vendor</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(params.vendorName)}</div>
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:14px;">Total</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(amount)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
  `);

  return { subject: `Approval needed: ${params.poNumber}`, html };
}

export interface ApprovedPoEmailParams {
  requesterName: string;
  approverName: string;
  poNumber: string;
  vendorName: string;
  grandTotal: number;
  currency: string;
}

export function buildApprovedPoEmail(params: ApprovedPoEmailParams): { subject: string; html: string } {
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: params.currency,
    maximumFractionDigits: 2,
  }).format(params.grandTotal);

  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">Purchase order approved</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.requesterName)} — ${escapeHtml(params.approverName)} has approved
          <strong style="color:${TEXT};">${escapeHtml(params.poNumber)}</strong>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WASH};border:1px solid ${BORDER};border-radius:6px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Vendor</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(params.vendorName)}</div>
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:14px;">Total</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(amount)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
  `);

  return { subject: `Approved: ${params.poNumber}`, html };
}

export interface RejectedPoEmailParams {
  requesterName: string;
  approverName: string;
  poNumber: string;
  vendorName: string;
  grandTotal: number;
  currency: string;
  reason: string;
}

export function buildRejectedPoEmail(params: RejectedPoEmailParams): { subject: string; html: string } {
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: params.currency,
    maximumFractionDigits: 2,
  }).format(params.grandTotal);

  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">Purchase order rejected</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.requesterName)} — ${escapeHtml(params.approverName)} has rejected
          <strong style="color:${TEXT};">${escapeHtml(params.poNumber)}</strong>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WASH};border:1px solid ${BORDER};border-radius:6px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Vendor</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(params.vendorName)}</div>
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:14px;">Total</div>
              <div style="color:${TEXT};font-size:14px;margin-top:3px;">${escapeHtml(amount)}</div>
              <div style="color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:14px;">Reason</div>
              <div style="color:${TEXT};font-size:13px;line-height:1.6;margin-top:3px;">${escapeHtml(params.reason)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
  `);

  return { subject: `Rejected: ${params.poNumber}`, html };
}

export interface UrgentRenewalEmailItem {
  poNumber: string;
  vendorName: string;
  description: string;
  termEndDate: string;
  daysRemaining: number;
}

export interface UrgentRenewalEmailParams {
  adminName: string;
  thresholdDays: number;
  renewals: UrgentRenewalEmailItem[];
}

export function buildUrgentRenewalEmail(params: UrgentRenewalEmailParams): { subject: string; html: string } {
  const rows = params.renewals
    .map((renewal) => {
      const dueLabel = renewal.daysRemaining <= 0 ? 'Due today' : `${renewal.daysRemaining} days left`;
      return `
        <tr>
          <td style="padding:12px 10px;border-top:1px solid ${BORDER};color:${TEXT};font-size:12.5px;font-weight:600;">
            ${escapeHtml(renewal.poNumber)}
            <div style="color:${MUTED};font-size:11.5px;font-weight:400;margin-top:3px;">${escapeHtml(renewal.vendorName)}</div>
          </td>
          <td style="padding:12px 10px;border-top:1px solid ${BORDER};color:${TEXT};font-size:12.5px;line-height:1.45;">
            ${escapeHtml(renewal.description)}
          </td>
          <td style="padding:12px 10px;border-top:1px solid ${BORDER};color:${TEXT};font-size:12.5px;white-space:nowrap;">
            ${escapeHtml(new Date(renewal.termEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))}
            <div style="color:#B03B32;font-size:11.5px;font-weight:600;margin-top:3px;">${escapeHtml(dueLabel)}</div>
          </td>
        </tr>`;
    })
    .join('');

  const html = shell(`
    <tr>
      <td style="padding:26px 28px 0;">
        <div style="color:${TEXT};font-size:19px;font-weight:600;">Urgent renewal attention required</div>
        <div style="color:${MUTED};font-size:13.5px;line-height:1.65;margin-top:10px;">
          Hello ${escapeHtml(params.adminName)} — the following renewal${params.renewals.length === 1 ? ' is' : 's are'}
          within the configured urgent threshold of
          <strong style="color:${TEXT};">${params.thresholdDays} days</strong>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WASH};border:1px solid ${BORDER};border-radius:6px;border-collapse:separate;">
          <tr>
            <td style="padding:10px;color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">PO / Vendor</td>
            <td style="padding:10px;color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Item</td>
            <td style="padding:10px;color:${MUTED};font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Renewal Date</td>
          </tr>
          ${rows}
        </table>
      </td>
    </tr>
    <tr><td style="height:18px;"></td></tr>
  `);

  return {
    subject: `Urgent renewal alert: ${params.renewals.length} item${params.renewals.length === 1 ? '' : 's'}`,
    html,
  };
}
