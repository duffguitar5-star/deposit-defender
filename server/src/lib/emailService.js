/**
 * Email Delivery Service
 *
 * Sends PDF documents via email without creating user accounts.
 * Email addresses are used transiently and not stored long-term.
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Create email transporter
 * Uses SMTP configuration from environment variables
 */
function createTransporter() {
  // For development, use ethereal.email test account
  // For production, configure SMTP settings via environment variables
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: console logging for development (no actual email sent)
  return {
    sendMail: async (mailOptions) => {
      logger.info('Email delivery (development mode - not sent)', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasAttachment: !!mailOptions.attachments,
      });
      return {
        messageId: `dev-${Date.now()}`,
        accepted: [mailOptions.to],
      };
    },
  };
}

/**
 * Send PDF document via email
 * @param {string} toEmail - Recipient email address
 * @param {string} caseId - Case ID for reference
 * @param {Buffer} pdfBuffer - PDF document buffer
 * @returns {Promise<Object>} Email delivery result
 */
async function sendPdfEmail(toEmail, caseId, pdfBuffer) {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@depositdefender.com',
    to: toEmail,
    subject: `Your Deposit Defender Document (Case ${caseId.slice(0, 8)})`,
    text: buildEmailTextBody(caseId),
    html: buildEmailHtmlBody(caseId),
    attachments: [
      {
        filename: `deposit-defender-${caseId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('PDF email sent successfully', {
      caseId,
      to: toEmail,
      messageId: info.messageId,
    });
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error('PDF email delivery failed', {
      caseId,
      to: toEmail,
      error,
    });
    throw error;
  }
}

/**
 * Build plain text email body
 */
function buildEmailTextBody(caseId) {
  return `
DEPOSIT DEFENDER - DOCUMENT DELIVERY

Your security deposit informational summary is attached to this email.

Case ID: ${caseId}

IMPORTANT LEGAL DISCLAIMER:

This document is provided for informational purposes only and does NOT constitute legal advice. Deposit Defender is a document preparation service, not a law firm. We do not provide legal representation, advice, or opinions.

By using this service, you acknowledge that:
- You understand this is NOT legal advice
- You should consult a licensed Texas attorney for legal guidance
- No attorney-client relationship has been created
- This document is for informational organization only

This service is available ONLY for Texas residential leases.

For support, reference your Case ID: ${caseId}

---
Deposit Defender
Texas-only residential security deposit document preparation
`.trim();
}

/**
 * Build HTML email body
 */
function buildEmailHtmlBody(caseId) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0c4a6e;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
    }
    .content {
      background: #f8fafc;
      padding: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 0 0 8px 8px;
    }
    .case-id {
      background: #fff;
      border: 2px solid #0c4a6e;
      border-radius: 6px;
      padding: 12px;
      margin: 16px 0;
      text-align: center;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      color: #0c4a6e;
    }
    .disclaimer {
      background: #fef3c7;
      border: 1px solid #d97706;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      font-size: 13px;
    }
    .disclaimer strong {
      color: #92400e;
      display: block;
      margin-bottom: 8px;
    }
    .disclaimer ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Deposit Defender - Document Delivery</h1>
  </div>

  <div class="content">
    <p>Your security deposit informational summary is attached to this email as a PDF document.</p>

    <div class="case-id">
      Case ID: ${caseId}
    </div>

    <p><strong>Document:</strong> deposit-defender-${caseId}.pdf</p>

    <div class="disclaimer">
      <strong>⚠️ IMPORTANT LEGAL DISCLAIMER</strong>
      <p>This document is provided for <strong>informational purposes only</strong> and does NOT constitute legal advice. Deposit Defender is a document preparation service, not a law firm. We do not provide legal representation, advice, or opinions.</p>
      <p>By using this service, you acknowledge that:</p>
      <ul>
        <li>You understand this is NOT legal advice</li>
        <li>You should consult a licensed Texas attorney for legal guidance</li>
        <li>No attorney-client relationship has been created</li>
        <li>This document is for informational organization only</li>
      </ul>
      <p>This service is available ONLY for Texas residential leases.</p>
    </div>

    <p><strong>For support:</strong> Reference your Case ID (${caseId}) in any correspondence.</p>
  </div>

  <div class="footer">
    <p>Deposit Defender<br>
    Texas-only residential security deposit document preparation</p>
  </div>
</body>
</html>
`.trim();
}

module.exports = {
  sendPdfEmail,
};
