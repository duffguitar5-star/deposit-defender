/**
 * Report PDF Generator
 *
 * Generates a PDF document from a Case Analysis Report.
 * This replaces the legacy documentGenerator.js.
 *
 * IMPORTANT: All content uses informational language only.
 * No legal advice or conclusions.
 */

const puppeteer = require('puppeteer');

/**
 * Generate PDF buffer from Case Analysis Report
 *
 * @param {object} report - Case Analysis Report object
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateReportPdf(report) {
  const html = buildReportHtml(report);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Build HTML from Case Analysis Report
 */
function buildReportHtml(report) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Case Analysis Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2c5282;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 18pt;
      color: #2c5282;
      margin: 0 0 8px 0;
    }
    .header .subtitle {
      font-size: 10pt;
      color: #666;
    }
    .disclaimer-box {
      background: #fef3c7;
      border: 1px solid #d97706;
      border-radius: 4px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 9pt;
    }
    .disclaimer-box strong {
      color: #92400e;
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 600;
      color: #2c5282;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .subsection-title {
      font-size: 11pt;
      font-weight: 600;
      color: #4a5568;
      margin: 16px 0 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #e2e8f0;
      font-size: 10pt;
    }
    th {
      background: #f7fafc;
      font-weight: 600;
      color: #4a5568;
    }
    .status-yes { color: #059669; font-weight: 600; }
    .status-no { color: #dc2626; font-weight: 600; }
    .status-partial { color: #d97706; font-weight: 600; }
    .status-unknown { color: #6b7280; font-style: italic; }
    .rank-badge {
      display: inline-block;
      background: #2c5282;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 10pt;
      font-weight: 600;
      margin-right: 8px;
    }
    .leverage-point {
      background: #f8fafc;
      border-left: 3px solid #2c5282;
      padding: 12px 16px;
      margin-bottom: 12px;
    }
    .leverage-point h4 {
      margin: 0 0 8px 0;
      color: #1e40af;
    }
    .citation {
      font-family: 'Courier New', monospace;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9pt;
    }
    .checklist-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .checklist-checkbox {
      width: 16px;
      height: 16px;
      border: 1px solid #cbd5e1;
      margin-right: 8px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .checklist-checkbox.checked {
      background: #059669;
      border-color: #059669;
    }
    .step-number {
      display: inline-block;
      background: #e2e8f0;
      color: #4a5568;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 10pt;
      font-weight: 600;
      margin-right: 8px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #6b7280;
      text-align: center;
    }
    .page-break { page-break-before: always; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>

${buildHeaderSection(report)}
${buildDisclaimerSection(report)}
${buildTimelineSection(report)}
${buildComplianceSection(report)}
${buildLeveragePointsSection(report)}
${buildStatutoryReferencesSection(report)}
${buildLeaseClausesSection(report)}
${buildProceduralStepsSection(report)}
${buildEvidenceChecklistSection(report)}
${buildFooterSection(report)}

</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHeaderSection(report) {
  const meta = report.report_metadata;
  return `
  <div class="header">
    <h1>Case Analysis Report</h1>
    <div class="subtitle">
      Case ID: ${escapeHtml(meta.case_id)}<br>
      Generated: ${new Date(meta.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
      Jurisdiction: Texas
    </div>
  </div>`;
}

function buildDisclaimerSection(report) {
  return `
  <div class="disclaimer-box">
    <strong>IMPORTANT DISCLAIMER:</strong> ${escapeHtml(report.disclaimers.primary)}
  </div>`;
}

function buildTimelineSection(report) {
  const timeline = report.timeline;
  const keyDates = timeline.key_dates;

  let deadlinesHtml = '';
  if (Array.isArray(timeline.computed_deadlines) && timeline.computed_deadlines.length > 0) {
    const firstDeadline = timeline.computed_deadlines[0];
    if (firstDeadline.deadline_id) {
      deadlinesHtml = timeline.computed_deadlines.map(d => `
        <tr>
          <td>${escapeHtml(d.label)}</td>
          <td>${escapeHtml(d.date)}</td>
          <td>${d.has_passed ? '<span class="status-no">Passed</span>' : `${d.days_remaining} days remaining`}</td>
          <td><span class="citation">${escapeHtml(d.reference)}</span></td>
        </tr>
      `).join('');
    } else {
      deadlinesHtml = `<tr><td colspan="4">${escapeHtml(firstDeadline)}</td></tr>`;
    }
  }

  return `
  <div class="section">
    <div class="section-title">Timeline & Deadlines</div>

    <div class="subsection-title">Key Dates</div>
    <table>
      <tr><th>Date Type</th><th>Date</th></tr>
      <tr><td>Move-out Date</td><td>${escapeHtml(keyDates.move_out_date)}</td></tr>
      ${keyDates.forwarding_address_date ? `<tr><td>Forwarding Address Provided</td><td>${escapeHtml(keyDates.forwarding_address_date)}</td></tr>` : ''}
      ${keyDates.lease_start_date ? `<tr><td>Lease Start</td><td>${escapeHtml(keyDates.lease_start_date)}</td></tr>` : ''}
      ${keyDates.lease_end_date ? `<tr><td>Lease End</td><td>${escapeHtml(keyDates.lease_end_date)}</td></tr>` : ''}
    </table>

    <div class="subsection-title">Computed Deadlines</div>
    <table>
      <tr><th>Deadline</th><th>Date</th><th>Status</th><th>Reference</th></tr>
      ${deadlinesHtml}
    </table>

    <div class="subsection-title">Current Status</div>
    <p><strong>Days since move-out:</strong> ${timeline.current_status.days_since_move_out}</p>
    <p>${escapeHtml(timeline.current_status.summary_text)}</p>
  </div>`;
}

function buildComplianceSection(report) {
  const checklist = report.compliance_checklist;

  const itemsHtml = checklist.items.map(item => {
    const statusClass = `status-${item.status}`;
    const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
    return `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td><span class="${statusClass}">${statusLabel}</span></td>
        <td>${escapeHtml(item.basis)}</td>
        <td><span class="citation">${escapeHtml(item.reference)}</span></td>
      </tr>
    `;
  }).join('');

  return `
  <div class="section">
    <div class="section-title">Compliance Checklist</div>
    <p><em>${escapeHtml(report.disclaimers.sections.find(s => s.section === 'compliance_checklist')?.disclaimer || '')}</em></p>

    <table>
      <tr><th>Item</th><th>Status</th><th>Basis</th><th>Reference</th></tr>
      ${itemsHtml}
    </table>

    <p><strong>Summary:</strong> ${escapeHtml(checklist.summary.summary_text)}</p>
  </div>`;
}

function buildLeveragePointsSection(report) {
  const points = report.leverage_points;

  const pointsHtml = points.map(point => `
    <div class="leverage-point">
      <h4><span class="rank-badge">${point.rank}</span>${escapeHtml(point.title)}</h4>
      <p>${escapeHtml(point.observation)}</p>
      ${point.supporting_facts && point.supporting_facts.length > 0 ? `
        <ul>
          ${point.supporting_facts.map(f => `<li>${escapeHtml(f.fact)} <em>(${escapeHtml(f.source)})</em></li>`).join('')}
        </ul>
      ` : ''}
      ${point.statutory_context ? `<p><small>${escapeHtml(point.statutory_context)}</small></p>` : ''}
    </div>
  `).join('');

  return `
  <div class="section">
    <div class="section-title">Leverage Points</div>
    <p><em>${escapeHtml(report.disclaimers.sections.find(s => s.section === 'leverage_points')?.disclaimer || '')}</em></p>
    ${pointsHtml}
  </div>`;
}

function buildStatutoryReferencesSection(report) {
  const refs = report.statutory_references;

  const refsHtml = refs.map(ref => `
    <tr>
      <td><span class="citation">${escapeHtml(ref.citation)}</span></td>
      <td>${escapeHtml(ref.title)}</td>
      <td>${escapeHtml(ref.summary)}</td>
      <td>${escapeHtml(ref.relevance_to_case)}</td>
    </tr>
  `).join('');

  return `
  <div class="section page-break">
    <div class="section-title">Texas Property Code References</div>
    <p><em>${escapeHtml(report.disclaimers.sections.find(s => s.section === 'statutory_references')?.disclaimer || '')}</em></p>

    <table>
      <tr><th>Citation</th><th>Title</th><th>Summary</th><th>Relevance</th></tr>
      ${refsHtml}
    </table>
  </div>`;
}

function buildLeaseClausesSection(report) {
  const clauses = report.lease_clause_citations;

  if (clauses.length === 1 && (clauses[0].item_id === 'no_lease_uploaded' || clauses[0].item_id === 'no_clauses_found')) {
    return `
    <div class="section">
      <div class="section-title">Lease Clause Citations</div>
      <p><em>${escapeHtml(clauses[0].relevance_note)}</em></p>
    </div>`;
  }

  const clausesHtml = clauses.map(clause => `
    <tr>
      <td>${escapeHtml(clause.topic.replace(/_/g, ' '))}</td>
      <td>${escapeHtml(clause.excerpt)}</td>
      <td>${escapeHtml(clause.source_context)}</td>
      ${clause.potential_conflict ? `<td class="status-partial">${escapeHtml(clause.potential_conflict)}</td>` : '<td>-</td>'}
    </tr>
  `).join('');

  return `
  <div class="section">
    <div class="section-title">Lease Clause Citations</div>

    <table>
      <tr><th>Topic</th><th>Excerpt</th><th>Location</th><th>Notes</th></tr>
      ${clausesHtml}
    </table>
  </div>`;
}

function buildProceduralStepsSection(report) {
  const steps = report.procedural_steps;

  const stepsHtml = steps.map(step => `
    <div style="margin-bottom: 12px;">
      <p><span class="step-number">${step.step_number}</span><strong>${escapeHtml(step.title)}</strong></p>
      <p style="margin-left: 32px;">${escapeHtml(step.description)}</p>
      ${step.applicability_note ? `<p style="margin-left: 32px;"><small><em>${escapeHtml(step.applicability_note)}</em></small></p>` : ''}
      ${step.resources && step.resources.length > 0 ? `
        <ul style="margin-left: 32px;">
          ${step.resources.map(r => `<li><a href="${escapeHtml(r.url)}">${escapeHtml(r.title)}</a></li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  return `
  <div class="section">
    <div class="section-title">Procedural Steps</div>
    <p><em>${escapeHtml(report.disclaimers.sections.find(s => s.section === 'procedural_steps')?.disclaimer || '')}</em></p>
    ${stepsHtml}
  </div>`;
}

function buildEvidenceChecklistSection(report) {
  const checklist = report.evidence_checklist;

  const categoriesHtml = checklist.categories.map(cat => `
    <div class="subsection-title">${escapeHtml(cat.label)}</div>
    ${cat.items.map(item => `
      <div class="checklist-item">
        <div class="checklist-checkbox ${item.status === 'provided' ? 'checked' : ''}"></div>
        <div>
          ${escapeHtml(item.label)}
          <small>(${item.importance} importance, ${item.status})</small>
        </div>
      </div>
    `).join('')}
  `).join('');

  return `
  <div class="section">
    <div class="section-title">Evidence Checklist</div>
    ${categoriesHtml}

    ${checklist.summary.high_importance_missing.length > 0 ? `
      <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 4px;">
        <strong>High-importance items not yet provided:</strong>
        <ul>
          ${checklist.summary.high_importance_missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>`;
}

function buildFooterSection(report) {
  return `
  <div class="footer">
    <p>This document was generated by DepositDefender, a document preparation and informational service.</p>
    <p>This is NOT legal advice. No attorney-client relationship is created. No outcome is guaranteed.</p>
    <p>Case ID: ${escapeHtml(report.report_metadata.case_id)} | Generated: ${new Date(report.report_metadata.generated_at).toISOString()}</p>
  </div>`;
}

/**
 * Generate JSON file buffer from Case Analysis Report
 */
function generateReportJson(report) {
  return Buffer.from(JSON.stringify(report, null, 2), 'utf8');
}

module.exports = {
  generateReportPdf,
  generateReportJson,
};
