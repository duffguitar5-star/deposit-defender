const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Create a transporter based on environment config.
 * Supports SMTP (production) and Ethereal dev-mode auto-accounts.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true'; // true = TLS port 465

  if (!host || !user || !pass) {
    logger.warn('SMTP credentials not configured — email will be logged only (dev mode)');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'DepositBack';
const FROM_ADDRESS = process.env.SMTP_USER || 'noreply@depositback.com';
const FROM = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

/**
 * Send the report-access email after a successful payment.
 *
 * @param {string} toEmail - Tenant's email address
 * @param {string} caseId  - Case UUID
 * @param {string} clientOrigin - e.g. https://depositback.com
 */
async function sendReportEmail(toEmail, caseId, clientOrigin) {
  const reportUrl = `${clientOrigin}/action-plan/${caseId}`;

  const text = `
Hi,

Your DepositBack report is ready.

View your full action plan here:
${reportUrl}

This link is unique to your case. Keep it somewhere safe — you can use it any time to access your report.

If you need to retrieve this link later, visit ${clientOrigin}/access-report and enter your email address.

—
DepositBack
Texas security deposit analysis tool

This is an automated message. Not legal advice.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#1d4ed8;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">DepositBack</p>
            <p style="margin:6px 0 0;font-size:13px;color:#bfdbfe;">Texas security deposit analysis</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
              Your report is ready.
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
              Your full action plan and case analysis are waiting for you.
            </p>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <a href="${reportUrl}"
                     style="display:inline-block;background:#1d4ed8;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                    View My Action Plan →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Or copy this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:12px;color:#3b82f6;word-break:break-all;">${reportUrl}</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">

            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Need this link again later? Visit
              <a href="${clientOrigin}/access-report" style="color:#3b82f6;">${clientOrigin}/access-report</a>
              and enter your email address.<br><br>
              This is an automated message. DepositBack is not a law firm and this is not legal advice.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

  const transporter = createTransporter();

  if (!transporter) {
    // Dev mode — just log the link
    logger.info('[EMAIL DEV] Would send report email', { toEmail, reportUrl });
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: toEmail,
      subject: 'Your DepositBack report is ready',
      text,
      html,
    });
    logger.info('Report email sent', { toEmail, messageId: info.messageId, caseId });
  } catch (err) {
    logger.error('Failed to send report email', { toEmail, caseId, error: err.message });
    throw err;
  }
}

module.exports = { sendReportEmail };
