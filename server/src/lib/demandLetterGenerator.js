/**
 * Demand Letter PDF Generator (PDFKit)
 *
 * Generates a formal Texas security deposit demand letter.
 * All content is informational only — not legal advice.
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  primary: '#1a2e4a',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  white: '#ffffff',
};

/**
 * Generate a demand letter PDF from user-supplied fields and case report.
 * @param {object} fields - User-editable letter fields
 * @param {object} report - Case Analysis Report (for leverage context)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateDemandLetterPdf(fields, report) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: 'Security Deposit Demand Letter',
          Author: fields.tenantName || 'Tenant',
          Subject: 'Texas Security Deposit Demand',
        },
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      buildLetter(doc, fields, report);
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

function buildLetter(doc, fields, report) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const {
    tenantName = '',
    tenantCurrentAddress = '',
    tenantCurrentCityStateZip = '',
    tenantEmail = '',
    tenantPhone = '',
    landlordName = '',
    landlordAddress = '',
    landlordCityStateZip = '',
    propertyAddress = '',
    propertyCity = '',
    moveOutDate = '',
    depositAmount = '',
    demandAmount = '',
    responseDeadlineDays = '14',
    letterDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  } = fields;

  const timeline = report.timeline || {};
  const leverage = report.leverage_points || [];
  const cs = report.case_strength || {};
  const recovery = report.recovery_estimate || {};

  const daysSinceMoveOut = timeline.days_since_move_out;
  const past30Days = timeline.past_30_days;
  const isBadFaith = cs.bad_faith_indicators && cs.bad_faith_indicators.length > 0;

  const fullPropertyAddress = propertyCity
    ? `${propertyAddress}, ${propertyCity}`
    : propertyAddress;

  const deadlineDate = (() => {
    const days = parseInt(responseDeadlineDays, 10) || 14;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  // ── SENDER BLOCK ───────────────────────────────────────────
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.text);

  if (tenantName) {
    doc.text(tenantName, { lineBreak: true });
  }
  if (tenantCurrentAddress) {
    doc.text(tenantCurrentAddress, { lineBreak: true });
  }
  if (tenantCurrentCityStateZip) {
    doc.text(tenantCurrentCityStateZip, { lineBreak: true });
  }
  if (tenantEmail || tenantPhone) {
    const contact = [tenantEmail, tenantPhone].filter(Boolean).join('   |   ');
    doc.text(contact, { lineBreak: true });
  }

  doc.moveDown(1);

  // ── DATE ───────────────────────────────────────────────────
  doc.text(letterDate, { lineBreak: true });

  doc.moveDown(1);

  // ── RECIPIENT BLOCK ────────────────────────────────────────
  if (landlordName) {
    doc.text(landlordName, { lineBreak: true });
  }
  if (landlordAddress) {
    doc.text(landlordAddress, { lineBreak: true });
  }
  if (landlordCityStateZip) {
    doc.text(landlordCityStateZip, { lineBreak: true });
  }

  doc.moveDown(1);

  // ── RE LINE ────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text)
    .text('RE: ', { continued: true })
    .font('Helvetica-Bold')
    .text(`Formal Demand for Return of Security Deposit — ${fullPropertyAddress || '[Property Address]'}`, { lineBreak: true });

  doc.moveDown(1);

  // ── SALUTATION ─────────────────────────────────────────────
  const salutation = landlordName
    ? `Dear ${landlordName}:`
    : 'To Whom It May Concern:';
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.text)
    .text(salutation, { lineBreak: true });

  doc.moveDown(0.75);

  // ── PARAGRAPH 1: Tenancy Summary ──────────────────────────
  let moveOutLine = '';
  if (moveOutDate) {
    const formatted = (() => {
      try {
        return new Date(moveOutDate + 'T00:00:00').toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
      } catch (_) { return moveOutDate; }
    })();
    moveOutLine = ` which ended on ${formatted}`;
  }

  const depositLine = depositAmount ? ` of ${ depositAmount}` : '';

  doc.text(
    `I am writing to formally demand the return of my security deposit in connection with my former tenancy at ${fullPropertyAddress || '[property address]'}${moveOutLine}. ` +
    `I paid a security deposit${depositLine} at the commencement of my tenancy. ` +
    `To date, you have not returned the deposit, nor have you provided a written, itemized statement of any deductions as required by Texas law.`,
    { lineBreak: true, align: 'justify' }
  );

  doc.moveDown(0.75);

  // ── PARAGRAPH 2: Legal Violations ────────────────────────
  let deadlineStatus = '';
  if (daysSinceMoveOut != null) {
    if (past30Days) {
      deadlineStatus = `As of today, ${daysSinceMoveOut} days have elapsed since my move-out date — well beyond the 30-day statutory period. `;
    } else {
      deadlineStatus = `As of today, ${daysSinceMoveOut} days have elapsed since my move-out date, and the statutory 30-day deadline is approaching. `;
    }
  }

  doc.text(
    `${deadlineStatus}` +
    `Texas Property Code § 92.103 requires a landlord to refund a security deposit, less any lawfully withheld amounts, no later than 30 days after the date the tenant surrenders the premises. ` +
    `Texas Property Code § 92.104 further requires that any deductions be itemized in a written statement provided to the tenant. ` +
    `You have complied with neither of these requirements.`,
    { lineBreak: true, align: 'justify' }
  );

  // ── PARAGRAPH 3: Key Violations (from leverage points) ────
  const topViolations = leverage.filter(lp => lp.severity === 'high').slice(0, 3);
  if (topViolations.length > 0) {
    doc.moveDown(0.75);
    doc.text('The following violations support this demand:', { lineBreak: true });
    doc.moveDown(0.25);

    for (const lp of topViolations) {
      const citations = (lp.statute_citations || []).map(c => c.citation || c).join(', ');
      doc.font('Helvetica').fontSize(11)
        .text(`\u2022  ${lp.title}${citations ? ` (${citations})` : ''}`, {
          indent: 16,
          lineBreak: true,
        });
      if (lp.why_this_matters) {
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
          .text(lp.why_this_matters, { indent: 32, lineBreak: true });
        doc.fillColor(COLORS.text).fontSize(11);
      }
    }
  }

  // ── PARAGRAPH 4: Bad Faith Warning ───────────────────────
  if (isBadFaith) {
    doc.moveDown(0.75);
    doc.text(
      `Please be advised that a landlord who, in bad faith, retains a security deposit or fails to provide a written itemized accounting of deductions is liable under Texas Property Code § 92.109 for ` +
      `$100, three times the amount of the security deposit wrongfully withheld, and the tenant\u2019s reasonable attorney\u2019s fees incurred in the suit.`,
      { lineBreak: true, align: 'justify' }
    );
  }

  doc.moveDown(0.75);

  // ── PARAGRAPH 5: Demand ───────────────────────────────────
  const demandLine = demandAmount
    ? `the sum of ${demandAmount}`
    : `the full amount of my security deposit`;

  doc.text(
    `I hereby formally demand that you remit to me ${demandLine} within ${responseDeadlineDays} days of receipt of this letter (by ${deadlineDate}).`,
    { lineBreak: true, align: 'justify' }
  );

  doc.moveDown(0.75);

  // ── PARAGRAPH 6: Escalation Warning ──────────────────────
  doc.text(
    `If I do not receive full payment within the stated period, I intend to pursue all available legal remedies, including filing suit in the appropriate justice court (small claims) for the full amount owed, ` +
    `statutory damages, and any attorney\u2019s fees permitted under Texas law. I hope we can resolve this matter without the need for litigation.`,
    { lineBreak: true, align: 'justify' }
  );

  doc.moveDown(0.75);

  // ── NOTICE LINE ────────────────────────────────────────────
  doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted)
    .text(
      'This letter constitutes written notice for all purposes under Texas Property Code Chapter 92.',
      { lineBreak: true }
    );
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.text);

  doc.moveDown(1);

  // ── CLOSING ────────────────────────────────────────────────
  doc.text('Sincerely,', { lineBreak: true });
  doc.moveDown(2.5);

  // Signature line
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + 220, doc.y)
    .strokeColor(COLORS.text).lineWidth(0.75).stroke();
  doc.moveDown(0.25);

  if (tenantName) {
    doc.text(tenantName, { lineBreak: true });
  }
  if (tenantCurrentAddress) {
    doc.text(tenantCurrentAddress, { lineBreak: true });
  }
  if (tenantCurrentCityStateZip) {
    doc.text(tenantCurrentCityStateZip, { lineBreak: true });
  }
  if (tenantEmail) {
    doc.text(tenantEmail, { lineBreak: true });
  }
  if (tenantPhone) {
    doc.text(tenantPhone, { lineBreak: true });
  }

}

module.exports = { generateDemandLetterPdf };
