/**
 * Report PDF Generator (PDFKit)
 *
 * Generates a structured PDF from a Case Analysis Report.
 * Uses PDFKit instead of Puppeteer for reliability and speed.
 *
 * IMPORTANT: All content uses informational language only. Not legal advice.
 */

const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────
// Color / style constants
// ─────────────────────────────────────────────
const COLORS = {
  primary: '#1a2e4a',      // Dark navy
  accent: '#2563eb',       // Blue
  success: '#16a34a',      // Green
  warning: '#d97706',      // Amber
  danger: '#dc2626',       // Red
  light: '#f8fafc',        // Light gray background
  border: '#e2e8f0',       // Border gray
  text: '#1e293b',         // Main text
  muted: '#64748b',        // Secondary text
  white: '#ffffff',
};

const GRADE_COLORS = {
  A: '#16a34a',
  B: '#2563eb',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
};

const POSITION_COLORS = {
  STRONG: '#16a34a',
  MODERATE: '#2563eb',
  WEAK: '#d97706',
  UNCERTAIN: '#64748b',
};

// ─────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────

/**
 * Generate PDF buffer from Case Analysis Report
 * @param {object} report - Case Analysis Report
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateReportPdf(report) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 54, bottom: 54, left: 60, right: 60 },
        info: {
          Title: 'Deposit Defender — Case Analysis Report',
          Author: 'Deposit Defender',
          Subject: 'Texas Security Deposit Analysis',
        },
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      buildDocument(doc, report);
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

function buildDocument(doc, report) {
  const meta = report.report_metadata || {};
  const caseStrength = report.case_strength || {};
  const recovery = report.recovery_estimate || {};
  const strategy = report.strategy || {};
  const timeline = report.timeline || {};
  const compliance = report.compliance_checklist || {};
  const leveragePoints = report.leverage_points || [];
  const proceduralSteps = report.procedural_steps || [];
  const statutes = report.statutory_references || [];
  const damageDefense = report.damage_defense || {};
  const disclaimers = report.disclaimers || {};

  // ─────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────
  drawHeader(doc, meta);

  // ─────────────────────────────────────────────
  // DISCLAIMER BOX
  // ─────────────────────────────────────────────
  drawDisclaimerBox(doc, disclaimers.primary);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 1: CASE STRENGTH (Layer 1)
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'CASE STRENGTH SUMMARY');
  drawCaseStrengthPanel(doc, caseStrength, recovery, strategy);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 2: STRATEGY & NEXT STEPS (Layer 2)
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'RECOMMENDED STRATEGY & ACTION PLAN');
  drawStrategyPanel(doc, strategy);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 3: TIMELINE & COMPLIANCE
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'TIMELINE & COMPLIANCE');
  drawTimelineSection(doc, timeline, compliance);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 4: LEVERAGE POINTS
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'LEVERAGE POINTS');
  drawLeveragePoints(doc, leveragePoints);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 5: RECOVERY ESTIMATE
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'RECOVERY ESTIMATE');
  drawRecoverySection(doc, recovery);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 6: PROCEDURAL STEPS
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'YOUR ACTION CHECKLIST');
  drawProceduralSteps(doc, proceduralSteps);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 7: STATUTES
  // ─────────────────────────────────────────────
  sectionHeader(doc, 'APPLICABLE TEXAS LAW');
  drawStatutes(doc, statutes);

  addSpacing(doc, 6);

  // ─────────────────────────────────────────────
  // SECTION 8: DAMAGE DEFENSE (if applicable)
  // ─────────────────────────────────────────────
  if (damageDefense.defenses && damageDefense.defenses.length > 0) {
    sectionHeader(doc, 'POTENTIAL DAMAGE CLAIM DEFENSES');
    drawDamageDefense(doc, damageDefense);
    addSpacing(doc, 6);
  }

  // ─────────────────────────────────────────────
  // FOOTER DISCLAIMER
  // ─────────────────────────────────────────────
  drawFooterDisclaimer(doc, disclaimers);
}

// ─────────────────────────────────────────────
// Section: Header
// ─────────────────────────────────────────────
function drawHeader(doc, meta) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Background bar
  doc.rect(doc.page.margins.left, doc.y, pageWidth, 60)
    .fillColor(COLORS.primary)
    .fill();

  const barTop = doc.y;

  // Title
  doc.fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('DEPOSIT DEFENDER', doc.page.margins.left + 12, barTop + 12, { lineBreak: false });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#94a3b8')
    .text('Case Analysis Report  |  Texas Security Deposit', doc.page.margins.left + 12, barTop + 36);

  // Case ID + date (right aligned)
  if (meta.case_id) {
    doc.fillColor('#94a3b8')
      .fontSize(8)
      .text(`Case: ${meta.case_id.slice(0, 8).toUpperCase()}`, doc.page.margins.left, barTop + 12, {
        width: pageWidth - 12,
        align: 'right',
        lineBreak: false,
      });
  }

  if (meta.generated_at) {
    const dateStr = new Date(meta.generated_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago'
    });
    doc.fillColor('#94a3b8')
      .fontSize(8)
      .text(`Generated: ${dateStr}`, doc.page.margins.left, barTop + 28, {
        width: pageWidth - 12,
        align: 'right',
        lineBreak: false,
      });
  }

  doc.y = barTop + 60 + 8;
}

// ─────────────────────────────────────────────
// Section: Disclaimer box
// ─────────────────────────────────────────────
function drawDisclaimerBox(doc, text) {
  if (!text) return;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxY = doc.y;
  const boxHeight = 28;

  doc.rect(doc.page.margins.left, boxY, pageWidth, boxHeight)
    .fillColor('#fef3c7')
    .fill();

  doc.rect(doc.page.margins.left, boxY, 3, boxHeight)
    .fillColor(COLORS.warning)
    .fill();

  doc.fillColor('#92400e')
    .font('Helvetica')
    .fontSize(7.5)
    .text(
      'IMPORTANT: ' + text,
      doc.page.margins.left + 10,
      boxY + 8,
      { width: pageWidth - 16, lineBreak: true }
    );

  doc.moveDown(0.5);
}

// ─────────────────────────────────────────────
// Section: Case Strength Panel
// ─────────────────────────────────────────────
function drawCaseStrengthPanel(doc, cs, recovery, strategy) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const panelY = doc.y;
  const panelHeight = 90;

  // Panel background
  doc.rect(doc.page.margins.left, panelY, pageWidth, panelHeight)
    .fillColor(COLORS.light)
    .fill();

  doc.rect(doc.page.margins.left, panelY, pageWidth, panelHeight)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();

  // Grade badge (left col)
  const grade = cs.leverage_grade || '?';
  const gradeColor = GRADE_COLORS[grade] || COLORS.muted;
  const badgeX = doc.page.margins.left + 16;
  const badgeY = panelY + 12;

  doc.rect(badgeX, badgeY, 52, 52)
    .fillColor(gradeColor)
    .fill();

  doc.fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(30)
    .text(grade, badgeX, badgeY + 10, { width: 52, align: 'center', lineBreak: false });

  // Score under grade
  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(`${cs.leverage_score || 0}/100`, badgeX, badgeY + 46, { width: 52, align: 'center', lineBreak: false });

  // Metrics (right of badge)
  const metricsX = badgeX + 70;
  const col2X = doc.page.margins.left + pageWidth / 2;
  let metricY = panelY + 14;

  // Position label
  const posColor = POSITION_COLORS[cs.strategic_position] || COLORS.muted;
  doc.fillColor(posColor)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(cs.strategic_position || 'UNKNOWN', metricsX, metricY);

  metricY += 16;

  metricRow(doc, metricsX, metricY, 'Win Probability:', `${cs.win_probability || 0}%`);
  metricRow(doc, col2X, metricY, 'Likely Recovery:', recovery.likely_case || 'N/A');
  metricY += 14;
  metricRow(doc, metricsX, metricY, 'Best Case:', recovery.best_case || 'N/A');
  metricRow(doc, col2X, metricY, 'Evidence Quality:', capitalize(cs.evidence_quality || 'unknown'));
  metricY += 14;

  // Strategy recommendation
  if (strategy.recommended_action) {
    doc.fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('RECOMMENDED: ', metricsX, metricY, { continued: true })
      .fillColor(COLORS.text)
      .font('Helvetica')
      .text(formatActionLabel(strategy.recommended_action) + `  |  Urgency: ${strategy.urgency || ''}`, { lineBreak: false });
  }

  // Explicitly position just below the panel — avoids overshooting with large moveDown
  doc.y = panelY + panelHeight + 6;
}

// ─────────────────────────────────────────────
// Section: Strategy Panel
// ─────────────────────────────────────────────
function drawStrategyPanel(doc, strategy) {
  if (!strategy) return;

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Why This Approach:');

  doc.fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(strategy.rationale || '', { lineBreak: true });

  addSpacing(doc, 6);

  if (strategy.timeline || strategy.cost_estimate) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowY = doc.y;

    doc.rect(doc.page.margins.left, rowY, pageWidth, 22)
      .fillColor('#eff6ff')
      .fill();

    doc.fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Timeline: ${strategy.timeline || 'N/A'}`, doc.page.margins.left + 10, rowY + 6, { lineBreak: false, continued: true });

    if (strategy.cost_estimate) {
      doc.fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(`   |   Estimated Cost: ${strategy.cost_estimate}`, { lineBreak: false });
    }

    doc.y = rowY + 22 + 4;
  }

  addSpacing(doc, 4);

  if (strategy.next_steps && strategy.next_steps.length > 0) {
    doc.fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('Action Steps:');

    addSpacing(doc, 4);

    for (const step of strategy.next_steps) {
      const stepText = `Step ${step.step}: ${step.action}`;
      doc.fillColor(COLORS.accent)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('▶  ', { continued: true })
        .fillColor(COLORS.text)
        .font('Helvetica-Bold')
        .text(stepText);

      if (step.deadline || step.cost) {
        const note = [step.deadline && `By: ${step.deadline}`, step.cost && `Cost: ${step.cost}`].filter(Boolean).join('   ');
        doc.fillColor(COLORS.muted)
          .font('Helvetica')
          .fontSize(7.5)
          .text(`     ${note}`);
      }

      if (step.notes) {
        doc.fillColor(COLORS.muted)
          .font('Helvetica')
          .fontSize(8)
          .text(`     ${step.notes}`, { lineBreak: true });
      }
      addSpacing(doc, 3);
    }
  }

  if (strategy.if_no_response) {
    addSpacing(doc, 4);
    doc.fillColor(COLORS.warning)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('If No Response: ', { continued: true })
      .fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(8)
      .text(strategy.if_no_response);
  }
}

// ─────────────────────────────────────────────
// Section: Timeline & Compliance
// ─────────────────────────────────────────────
function drawTimelineSection(doc, timeline, compliance) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const halfW = (pageWidth - 12) / 2;
  const tlY = doc.y;
  const compX = doc.page.margins.left + halfW + 12;
  const BOX_H = 80;

  // Draw BOTH box backgrounds first — rects do not change doc.y
  doc.rect(doc.page.margins.left, tlY, halfW, BOX_H).fillColor(COLORS.light).fill();
  doc.rect(doc.page.margins.left, tlY, halfW, BOX_H).strokeColor(COLORS.border).stroke();
  doc.rect(compX, tlY, halfW, BOX_H).fillColor(COLORS.light).fill();
  doc.rect(compX, tlY, halfW, BOX_H).strokeColor(COLORS.border).stroke();

  // Render content in strict y-order so doc.y never needs to move backward.
  // lineBreak:false keeps doc.y at the rendered y so the next call at the same y is valid.

  // y = tlY+8 : both headers
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
    .text('Timeline', doc.page.margins.left + 8, tlY + 8, { lineBreak: false });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
    .text('Compliance Checklist', compX + 8, tlY + 8, { lineBreak: false });

  // y = tlY+24 : row 1
  infoRow(doc, doc.page.margins.left + 8, tlY + 24, 'Move-Out Date:', timeline.move_out_date || 'Not provided');
  complianceRow(doc, compX + 8, tlY + 24, 'Deposit Returned', compliance.deposit_returned);

  // y = tlY+37 / tlY+38 : row 2
  infoRow(doc, doc.page.margins.left + 8, tlY + 37, 'Days Elapsed:', timeline.days_since_move_out != null ? `${timeline.days_since_move_out} days` : 'Unknown');
  complianceRow(doc, compX + 8, tlY + 38, 'Itemization Provided', compliance.itemization_provided);

  // y = tlY+50 / tlY+52 : row 3
  infoRow(doc, doc.page.margins.left + 8, tlY + 50, '30-Day Deadline:', timeline.deadline_date || 'Unknown');
  complianceRow(doc, compX + 8, tlY + 52, 'Refund Within 30 Days', compliance.refund_within_30_days);

  // y = tlY+63 / tlY+66 : row 4 (status + last compliance)
  const pastDeadlineLabel = timeline.past_30_days === true
    ? '⚠ DEADLINE PASSED'
    : (timeline.past_30_days === false ? `✓ ${timeline.days_remaining_to_deadline} days remaining` : 'Unknown');
  const pastDeadlineColor = timeline.past_30_days === true ? COLORS.danger : COLORS.success;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text('Status:', doc.page.margins.left + 8, tlY + 63, { continued: true });
  doc.fillColor(pastDeadlineColor).font('Helvetica-Bold').fontSize(8)
    .text('  ' + pastDeadlineLabel, { lineBreak: false });
  complianceRow(doc, compX + 8, tlY + 66, 'Forwarding Address Given', compliance.forwarding_address_provided);

  // Advance past both boxes
  doc.y = tlY + BOX_H + 10;
}

// ─────────────────────────────────────────────
// Section: Leverage Points
// ─────────────────────────────────────────────
function drawLeveragePoints(doc, points) {
  for (const point of points) {
    checkPageBreak(doc, 80);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const headerY = doc.y;
    const headerBg = point.severity === 'high' ? '#fef2f2' : '#f0f9ff';
    const headerBorder = point.severity === 'high' ? COLORS.danger : COLORS.accent;

    doc.rect(doc.page.margins.left, headerY, pageWidth, 24)
      .fillColor(headerBg)
      .fill();

    doc.rect(doc.page.margins.left, headerY, 3, 24)
      .fillColor(headerBorder)
      .fill();

    // Rank badge
    doc.fillColor(headerBorder)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`#${point.rank}`, doc.page.margins.left + 8, headerY + 7, { lineBreak: false, continued: true });

    doc.fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`  ${point.title || ''}`, { lineBreak: false });

    // Severity badge
    doc.fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7)
      .text(`  [${(point.severity || '').toUpperCase()}]`, { lineBreak: false });

    doc.y = headerY + 28;

    // Why this matters
    if (point.why_this_matters) {
      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8.5)
        .text(point.why_this_matters, { lineBreak: true, indent: 8 });
      addSpacing(doc, 4);
    }

    // Supporting facts
    if (point.supporting_facts && point.supporting_facts.length > 0) {
      doc.fillColor(COLORS.muted)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('Supporting Facts:', { indent: 8 });
      for (const fact of point.supporting_facts) {
        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(8)
          .text(`• ${fact.fact || ''}`, { indent: 16 });
      }
      addSpacing(doc, 4);
    }

    // Statute citations
    if (point.statute_citations && point.statute_citations.length > 0) {
      doc.fillColor(COLORS.muted)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('Statutes Referenced:', { indent: 8 });

      const citations = point.statute_citations.map(c => c.citation || c).join('   |   ');
      doc.fillColor(COLORS.accent)
        .font('Helvetica')
        .fontSize(8)
        .text(citations, { indent: 16 });
      addSpacing(doc, 3);
    }

    addSpacing(doc, 4);
  }
}

// ─────────────────────────────────────────────
// Section: Recovery Estimate
// ─────────────────────────────────────────────
function drawRecoverySection(doc, recovery) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const panelY = doc.y;
  const panelH = 72;

  doc.rect(doc.page.margins.left, panelY, pageWidth, panelH)
    .fillColor(COLORS.light).fill();
  doc.rect(doc.page.margins.left, panelY, pageWidth, panelH)
    .strokeColor(COLORS.border).lineWidth(1).stroke();

  const colW = pageWidth / 3;
  const c1 = doc.page.margins.left;
  const c2 = c1 + colW;
  const c3 = c1 + colW * 2;

  // Render all labels at panelY+16, then all values at panelY+28.
  // lineBreak:false keeps doc.y at the rendered y so the next call at the same y is valid.
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text('LIKELY RECOVERY', c1 + 4, panelY + 16, { width: colW - 8, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text('BEST CASE', c2 + 4, panelY + 16, { width: colW - 8, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text('WORST CASE', c3 + 4, panelY + 16, { width: colW - 8, align: 'center', lineBreak: false });

  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(18)
    .text(recovery.likely_case || '—', c1 + 4, panelY + 28, { width: colW - 8, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.success).font('Helvetica-Bold').fontSize(18)
    .text(recovery.best_case || '—', c2 + 4, panelY + 28, { width: colW - 8, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.warning).font('Helvetica-Bold').fontSize(18)
    .text(recovery.worst_case || '—', c3 + 4, panelY + 28, { width: colW - 8, align: 'center', lineBreak: false });

  // Explicitly advance past the panel (no moveDown with 18pt font that would overshoot)
  doc.y = panelY + panelH + 8;
  addSpacing(doc, 4);

  if (recovery.statutory_penalty && recovery.statutory_penalty !== '$0') {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(`${recovery.statutory_penalty} § 92.109 penalty may be applicable if landlord acted in bad faith.`, { indent: 0 });
    addSpacing(doc, 4);
  }

  doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(7.5)
    .text(recovery.disclaimer || '', { lineBreak: true });
  doc.font('Helvetica');

  addSpacing(doc, 6);
}

// ─────────────────────────────────────────────
// Section: Procedural Steps
// ─────────────────────────────────────────────
function drawProceduralSteps(doc, steps) {
  for (const step of steps) {
    checkPageBreak(doc, 50);

    doc.fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`Step ${step.step_number}: ${step.title || ''}`);

    if (step.description) {
      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8.5)
        .text(step.description, { indent: 10, lineBreak: true });
    }

    if (step.checklist && step.checklist.length > 0) {
      addSpacing(doc, 3);
      for (const item of step.checklist) {
        doc.fillColor(COLORS.muted)
          .font('Helvetica')
          .fontSize(8)
          .text(`☐  ${item}`, { indent: 16 });
      }
    }

    if (step.resources && step.resources.length > 0) {
      addSpacing(doc, 3);
      for (const resource of step.resources) {
        doc.fillColor(COLORS.accent)
          .font('Helvetica')
          .fontSize(7.5)
          .text(`→ ${resource.title}: ${resource.url}`, { indent: 16, lineBreak: true });
      }
    }

    addSpacing(doc, 4);
  }
}

// ─────────────────────────────────────────────
// Section: Statutes
// ─────────────────────────────────────────────
function drawStatutes(doc, statutes) {
  for (const statute of statutes) {
    checkPageBreak(doc, 40);

    doc.fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(statute.citation || '', { continued: true });

    doc.fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(`  — ${statute.title || ''}`);

    if (statute.summary) {
      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8)
        .text(statute.summary, { indent: 12, lineBreak: true });
    }

    addSpacing(doc, 3);
  }
}

// ─────────────────────────────────────────────
// Section: Damage Defense
// ─────────────────────────────────────────────
function drawDamageDefense(doc, damageDefense) {
  if (damageDefense.strategic_note) {
    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(8.5)
      .text(damageDefense.strategic_note, { lineBreak: true });
    addSpacing(doc, 4);
  }

  for (const defense of damageDefense.defenses || []) {
    checkPageBreak(doc, 50);

    const strengthColor = defense.defense_strength === 'STRONG' ? COLORS.success : COLORS.warning;

    doc.fillColor(strengthColor)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`[${defense.defense_strength}]  `, { continued: true })
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(defense.title || '');

    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(`Statute: ${defense.statute || ''}`, { indent: 8 });

    if (defense.key_point) {
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8)
        .text(defense.key_point, { indent: 8, lineBreak: true });
    }

    if (defense.what_to_ask_landlord && defense.what_to_ask_landlord.length > 0) {
      addSpacing(doc, 3);
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
        .text('Questions to ask landlord:', { indent: 8 });
      for (const q of defense.what_to_ask_landlord) {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
          .text(`• ${q}`, { indent: 16 });
      }
    }

    addSpacing(doc, 4);
  }

  if (damageDefense.disclaimer) {
    doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(7.5)
      .text(damageDefense.disclaimer, { lineBreak: true });
    doc.font('Helvetica');
  }
}

// ─────────────────────────────────────────────
// Section: Footer disclaimer
// ─────────────────────────────────────────────
function drawFooterDisclaimer(doc, disclaimers) {
  checkPageBreak(doc, 50);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const footerY = doc.y + 10;

  doc.moveTo(doc.page.margins.left, footerY)
    .lineTo(doc.page.margins.left + pageWidth, footerY)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  addSpacing(doc, 8);

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
    .text('LEGAL DISCLAIMER', { align: 'center' });

  addSpacing(doc, 4);

  const parts = [disclaimers.primary, disclaimers.jurisdiction, disclaimers.estimates].filter(Boolean);
  for (const part of parts) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
      .text(part, { align: 'center', lineBreak: true });
    addSpacing(doc, 3);
  }

  addSpacing(doc, 6);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
    .text(`Generated by Deposit Defender  |  depositdefender.com  |  Texas Only`, { align: 'center' });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function sectionHeader(doc, title) {
  checkPageBreak(doc, 30);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;

  doc.rect(doc.page.margins.left, y, pageWidth, 18)
    .fillColor(COLORS.primary)
    .fill();

  doc.fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(title, doc.page.margins.left + 10, y + 5, { lineBreak: false });

  doc.y = y + 22;
}

function metricRow(doc, x, y, label, value) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text(label + ' ', x, y, { lineBreak: false, continued: true });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
    .text(value, { lineBreak: false });
}

function infoRow(doc, x, y, label, value) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text(label, x, y, { lineBreak: false, continued: true });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.5)
    .text('  ' + value, { lineBreak: false });
}

function complianceRow(doc, x, y, label, value) {
  const icon = value ? '✓' : '✗';
  const color = value ? COLORS.success : COLORS.danger;
  doc.fillColor(color).font('Helvetica-Bold').fontSize(9)
    .text(icon, x, y, { lineBreak: false, continued: true });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.5)
    .text('  ' + label, { lineBreak: false });
}

function addSpacing(doc, pts) {
  doc.moveDown(pts / 12);
}

function checkPageBreak(doc, neededHeight) {
  const bottomMargin = doc.page.margins.bottom;
  const remainingSpace = doc.page.height - doc.y - bottomMargin;
  if (remainingSpace < neededHeight) {
    doc.addPage();
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatActionLabel(action) {
  const labels = {
    SEND_DEMAND_LETTER: 'Send Demand Letter',
    REQUEST_ITEMIZATION_OR_NEGOTIATE: 'Request Itemization / Negotiate',
    GATHER_EVIDENCE_THEN_EVALUATE: 'Gather Evidence, Then Evaluate',
    REVIEW_SITUATION: 'Review Situation',
  };
  return labels[action] || action;
}

module.exports = { generateReportPdf };
