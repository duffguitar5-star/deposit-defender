import React, { useState } from 'react';

const URGENCY_STYLES = {
  HIGH:   { label: 'High Priority', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  MEDIUM: { label: 'Medium Priority', color: '#d97706', bg: '#fefce8', border: '#fde68a' },
  LOW:    { label: 'Lower Priority', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
};

const ESCALATION_ICONS = {
  phase_1: '1',
  phase_2: '2',
  phase_3: '3',
  phase_4: '4',
};

/**
 * StrategyPanel (Layer 2)
 *
 * Displays the recommended action, rationale, step-by-step next steps,
 * escalation path, and "if no response" guidance.
 */
function StrategyPanel({ strategy }) {
  const [showEscalation, setShowEscalation] = useState(false);

  if (!strategy) return null;

  const urgency = URGENCY_STYLES[strategy.urgency] || URGENCY_STYLES.LOW;

  return (
    <div className="strategy-panel">
      <div className="strategy-panel-header">
        <h2 className="strategy-panel-title">Your Action Plan</h2>
        <span
          className="strategy-urgency-tag"
          style={{ color: urgency.color, background: urgency.bg, borderColor: urgency.border }}
        >
          {urgency.label}
        </span>
      </div>

      {/* Rationale */}
      <div className="strategy-rationale" style={{ borderLeftColor: urgency.color }}>
        <p>{strategy.rationale}</p>
        {strategy.success_rate_note && (
          <p className="strategy-success-note">{strategy.success_rate_note}</p>
        )}
      </div>

      {/* Timeline + Cost */}
      {(strategy.timeline || strategy.cost_estimate) && (
        <div className="strategy-meta-row">
          {strategy.timeline && (
            <div className="strategy-meta-item">
              <span className="strategy-meta-label">Estimated Timeline</span>
              <span className="strategy-meta-value">{strategy.timeline}</span>
            </div>
          )}
          {strategy.cost_estimate && (
            <div className="strategy-meta-item">
              <span className="strategy-meta-label">Up-Front Cost</span>
              <span className="strategy-meta-value">{strategy.cost_estimate}</span>
            </div>
          )}
        </div>
      )}

      {/* Next Steps */}
      {strategy.next_steps && strategy.next_steps.length > 0 && (
        <div className="strategy-steps">
          <h3 className="strategy-steps-title">Step-by-Step Plan</h3>
          <ol className="strategy-steps-list">
            {strategy.next_steps.map((step) => (
              <li key={step.step} className="strategy-step">
                <div className="strategy-step-header">
                  <span className="strategy-step-number">{step.step}</span>
                  <strong className="strategy-step-action">{step.action}</strong>
                </div>
                <div className="strategy-step-detail">
                  {step.deadline && (
                    <span className="strategy-step-deadline">
                      Deadline: {step.deadline}
                    </span>
                  )}
                  {step.notes && (
                    <p className="strategy-step-notes">{step.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* If No Response */}
      {strategy.if_no_response && (
        <div className="strategy-no-response">
          <span className="strategy-no-response-label">If no response:</span>
          <p>{strategy.if_no_response}</p>
        </div>
      )}

      {/* Escalation Path (collapsible) */}
      {strategy.escalation_path && (
        <div className="strategy-escalation">
          <button
            className="strategy-escalation-toggle"
            onClick={() => setShowEscalation(v => !v)}
          >
            {showEscalation ? 'Hide' : 'Show'} Escalation Path
            <span className="strategy-escalation-arrow">{showEscalation ? '▲' : '▼'}</span>
          </button>

          {showEscalation && (
            <div className="strategy-escalation-steps">
              {Object.entries(strategy.escalation_path).map(([key, value]) => (
                <div key={key} className="escalation-phase">
                  <span className="escalation-phase-dot">{ESCALATION_ICONS[key] || '•'}</span>
                  <span className="escalation-phase-text">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="strategy-disclaimer">
        This action plan is informational only and is not legal advice. Consult a licensed Texas
        attorney for guidance specific to your situation.
      </p>
    </div>
  );
}

export default StrategyPanel;
