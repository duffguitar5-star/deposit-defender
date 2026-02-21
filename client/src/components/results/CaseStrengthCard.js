import React from 'react';
import usePdfDownload from '../../hooks/usePdfDownload';

const GRADE_COLORS = {
  A: '#16a34a',
  B: '#2563eb',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
};

const POSITION_COLORS = {
  STRONG: { bg: '#dcfce7', text: '#15803d', border: '#16a34a' },
  MODERATE: { bg: '#dbeafe', text: '#1d4ed8', border: '#2563eb' },
  WEAK: { bg: '#fef3c7', text: '#92400e', border: '#d97706' },
  UNCERTAIN: { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' },
};

const URGENCY_LABELS = {
  HIGH: { label: 'High Urgency', color: '#dc2626', bg: '#fef2f2' },
  MEDIUM: { label: 'Medium Urgency', color: '#d97706', bg: '#fefce8' },
  LOW: { label: 'Low Urgency', color: '#16a34a', bg: '#f0fdf4' },
};

const ACTION_LABELS = {
  SEND_DEMAND_LETTER: 'Send Demand Letter',
  REQUEST_ITEMIZATION_OR_NEGOTIATE: 'Request Itemization / Negotiate',
  GATHER_EVIDENCE_THEN_EVALUATE: 'Gather Evidence, Then Evaluate',
  REVIEW_SITUATION: 'Review Situation',
};

/**
 * CaseStrengthCard (Layer 1)
 *
 * The hero card at the top of the report page.
 * Shows: leverage grade, score, win probability, recovery range,
 * strategic position, and recommended action.
 */
function CaseStrengthCard({ caseId, caseStrength, recoveryEstimate, strategy, onScrollToStrategy }) {
  const { downloadPdf, retry, loading, error, progress } = usePdfDownload(caseId);

  if (!caseStrength) {
    return (
      <div className="case-strength-loading">
        <p>Loading case analysis...</p>
      </div>
    );
  }

  const grade = caseStrength.leverage_grade || '?';
  const score = caseStrength.leverage_score || 0;
  const winProb = caseStrength.win_probability || 0;
  const position = caseStrength.strategic_position || 'UNCERTAIN';
  const gradeColor = GRADE_COLORS[grade] || '#64748b';
  const posStyle = POSITION_COLORS[position] || POSITION_COLORS.UNCERTAIN;

  const actionLabel = strategy ? (ACTION_LABELS[strategy.recommended_action] || strategy.recommended_action) : null;
  const urgencyInfo = strategy ? URGENCY_LABELS[strategy.urgency] : null;

  const likelyRecovery = recoveryEstimate?.likely_case;
  const bestRecovery = recoveryEstimate?.best_case;

  return (
    <div className="case-strength-card">
      {/* Grade + Score */}
      <div className="case-strength-grade-section">
        <div className="grade-badge" style={{ backgroundColor: gradeColor }}>
          <span className="grade-letter">{grade}</span>
          <span className="grade-score">{score}/100</span>
        </div>
        <div className="grade-labels">
          <span className="grade-title">Case Strength</span>
          <div
            className="position-badge"
            style={{ background: posStyle.bg, color: posStyle.text, borderColor: posStyle.border }}
          >
            {position}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="case-strength-metrics">
        <div className="metric">
          <span className="metric-label">Win Probability</span>
          <span className="metric-value">{winProb}%</span>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{ width: `${winProb}%`, backgroundColor: gradeColor }} />
          </div>
        </div>

        {likelyRecovery && (
          <div className="metric">
            <span className="metric-label">Likely Recovery</span>
            <span className="metric-value metric-currency">{likelyRecovery}</span>
          </div>
        )}

        {bestRecovery && (
          <div className="metric">
            <span className="metric-label">Best Case</span>
            <span className="metric-value metric-currency">{bestRecovery}</span>
          </div>
        )}

        {caseStrength.evidence_quality && (
          <div className="metric">
            <span className="metric-label">Evidence Quality</span>
            <span className="metric-value">
              {caseStrength.evidence_quality.charAt(0).toUpperCase() + caseStrength.evidence_quality.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Strategy recommendation */}
      {actionLabel && (
        <div
          className="recommendation-banner"
          style={{ background: urgencyInfo?.bg || '#f8fafc', borderColor: urgencyInfo?.color || '#e2e8f0' }}
        >
          {urgencyInfo && (
            <span className="urgency-tag" style={{ color: urgencyInfo.color, background: urgencyInfo.bg }}>
              {urgencyInfo.label}
            </span>
          )}
          <span className="recommendation-label">Recommended Action:</span>
          <strong className="recommendation-action">{actionLabel}</strong>
        </div>
      )}

      {/* Action buttons */}
      <div className="case-strength-actions">
        <div className="download-area">
          <button
            className="btn-primary"
            onClick={downloadPdf}
            disabled={loading}
          >
            {loading ? `Downloading... ${progress > 0 ? `${progress}%` : ''}` : 'Download PDF Report'}
          </button>

          {error && (
            <div className="download-error">
              <span>{error}</span>
              <button className="btn-retry" onClick={retry}>Retry</button>
            </div>
          )}
        </div>

        {onScrollToStrategy && (
          <button className="btn-secondary" onClick={onScrollToStrategy}>
            View Action Plan ↓
          </button>
        )}
      </div>

      {/* Bad faith indicators */}
      {caseStrength.bad_faith_indicators && caseStrength.bad_faith_indicators.length > 0 && (
        <div className="bad-faith-notice">
          <span className="bad-faith-title">⚠ Bad Faith Indicators Detected:</span>
          <ul>
            {caseStrength.bad_faith_indicators.map((indicator, i) => (
              <li key={i}>{indicator}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CaseStrengthCard;
