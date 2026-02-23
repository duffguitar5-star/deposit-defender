import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import usePdfDownload from '../hooks/usePdfDownload';
import LandlordLetterModal from '../components/LandlordLetterModal';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

// ─── Display constants ────────────────────────────────────────────────────────

const GRADE_COLORS = {
  A: '#16a34a',
  B: '#2563eb',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
};

const POSITION_STYLES = {
  STRONG:    { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
  MODERATE:  { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300'   },
  WEAK:      { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300'  },
  UNCERTAIN: { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300'  },
};

const URGENCY_STYLES = {
  HIGH:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
  MEDIUM: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  },
  LOW:    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
};

const ACTION_LABELS = {
  SEND_DEMAND_LETTER:               'Send a certified demand letter',
  REQUEST_ITEMIZATION_OR_NEGOTIATE: 'Request itemization in writing',
  GATHER_EVIDENCE_THEN_EVALUATE:    'Gather your evidence first',
  REVIEW_SITUATION:                 'Review your current situation',
};

const URGENCY_LABELS = {
  HIGH:   'Take action now',
  MEDIUM: 'Address this soon',
  LOW:    'Monitor for now',
};

const categoryLabels = {
  documentation:      'Documentation',
  communication:      'Communication',
  legal_consultation: 'Legal Consultation',
  court_information:  'Court Information',
  review:             'Review',
  planning:           'Planning',
  next_steps:         'Next Steps',
};

// ─── Micro-components ─────────────────────────────────────────────────────────

function SmallChevron({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to overview
    </button>
  );
}

function NextButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-8 rounded-2xl py-4 text-base font-bold text-white flex items-center justify-center gap-2 transition-colors"
      style={{ backgroundColor: '#2563eb' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
    >
      {label}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─── HubView ──────────────────────────────────────────────────────────────────

function HubView({
  grade, score, gradeColor, position, posStyle,
  onNavigate, onLetterClick,
  downloadPdf, pdfLoading, pdfError, retryPdf, pdfProgress,
}) {
  const cards = [
    {
      key: 'status',
      num: '1',
      title: 'Your Case Status',
      subtitle: 'See your grade, legal position, and what gives you leverage.',
      numBg: '#2563eb',
      borderColor: '#93c5fd',
      borderHover: '#3b82f6',
    },
    {
      key: 'steps',
      num: '2',
      title: 'What To Do Now',
      subtitle: 'Step-by-step actions to get your deposit back.',
      numBg: '#f97316',
      borderColor: '#fdba74',
      borderHover: '#f97316',
    },
    {
      key: 'escalate',
      num: '3',
      title: "If They Still Won't Pay",
      subtitle: 'What happens if the landlord refuses — and how far you can take it.',
      numBg: '#475569',
      borderColor: '#94a3b8',
      borderHover: '#64748b',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4 font-medium">Your DepositBack Report</p>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div
            className="flex-shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold shadow"
            style={{ backgroundColor: gradeColor }}
          >
            <span className="text-2xl leading-none">{grade}</span>
            <span className="text-xs opacity-80">{score}/100</span>
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Case Strength</p>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
            >
              {position}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500">Click a section below to explore your full report.</p>
      </div>

      {/* 3 nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <button
            key={card.key}
            onClick={() => onNavigate(card.key)}
            className="text-left bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
            style={{
              border: `2px solid ${card.borderColor}`,
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = card.borderHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = card.borderColor; }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base text-white mb-3"
              style={{ backgroundColor: card.numBg }}
            >
              {card.num}
            </div>
            <p className="text-base font-bold text-slate-900 mb-1.5 leading-snug">{card.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{card.subtitle}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600">
              <span>Open</span>
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Demand letter CTA */}
      <div className="mb-6 rounded-2xl overflow-hidden border border-orange-200 bg-orange-50">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Ready to send a demand letter?</p>
              <p className="text-xs text-slate-600 mt-0.5">
                We'll pre-fill a formal demand letter with your case details. Review every field, make any edits, then download the PDF.
              </p>
            </div>
          </div>
          <button
            onClick={onLetterClick}
            className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: '#F25C54' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e04b43'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F25C54'; }}
          >
            Generate Demand Letter
          </button>
        </div>
      </div>

      {/* PDF Download — subtle, separate style */}
      <div className="border border-slate-200 rounded-xl px-5 py-4 bg-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Download your full report</p>
          <p className="text-xs text-slate-500 mt-0.5">Complete case analysis as a PDF you can keep and reference.</p>
        </div>
        <button
          onClick={downloadPdf}
          disabled={pdfLoading}
          className="flex-shrink-0 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {pdfLoading ? `${pdfProgress > 0 ? `${pdfProgress}%` : '…'}` : 'PDF'}
        </button>
      </div>
      {pdfError && (
        <div className="mt-2 flex items-center gap-3 text-sm text-red-600">
          <span>{pdfError}</span>
          <button onClick={retryPdf} className="text-xs underline">Retry</button>
        </div>
      )}
    </div>
  );
}

// ─── StatusView ───────────────────────────────────────────────────────────────

function StatusView({ report, cs, grade, score, gradeColor, position, winProb, posStyle, onNavigate, onBack }) {
  const [showAllLeverage, setShowAllLeverage]     = useState(false);
  const [showStatutoryRefs, setShowStatutoryRefs] = useState(false);

  const leveragePoints = report.leverage_points || [];
  const topLP          = leveragePoints[0] || null;

  return (
    <div>
      <BackButton onClick={onBack} />

      <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Case Status</h2>
      <p className="text-sm text-slate-500 mb-6">How your case stacks up under Texas law.</p>

      {/* Grade card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 flex items-center gap-5">
        <div
          className="flex-shrink-0 w-20 h-20 rounded-full flex flex-col items-center justify-center text-white font-bold shadow"
          style={{ backgroundColor: gradeColor }}
        >
          <span className="text-3xl leading-none">{grade}</span>
          <span className="text-xs opacity-80 mt-0.5">{score}/100</span>
        </div>
        <div className="space-y-2.5">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Legal Position</p>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
            >
              {position}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Estimated Likelihood of Recovery</p>
            <p className="text-xl font-bold text-slate-900">{winProb}%</p>
          </div>
        </div>
      </div>

      {/* Recovery estimate */}
      {report.recovery_estimate?.likely_case && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">Most Realistic Outcome</p>
          <p className="text-2xl font-bold text-green-700">{report.recovery_estimate.likely_case}</p>
          {report.recovery_estimate.confidence_note && (
            <p className="text-xs text-slate-500 mt-1 italic">{report.recovery_estimate.confidence_note}</p>
          )}
        </div>
      )}

      {/* Top leverage point */}
      {topLP && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Your Strongest Argument</p>
          <div className="flex items-start gap-2 mb-2 flex-wrap">
            <p className="text-lg font-bold text-slate-900">{topLP.title}</p>
            {topLP.severity && (
              <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                topLP.severity === 'high'   ? 'bg-red-100 text-red-700'
                : topLP.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
              }`}>
                {topLP.severity}
              </span>
            )}
          </div>
          {topLP.observation && (
            <p className="text-sm text-slate-700 mb-3 leading-relaxed">{topLP.observation}</p>
          )}
          {topLP.supporting_facts?.length > 0 && (
            <ul className="space-y-1.5">
              {topLP.supporting_facts.map((sf, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                  <span>{sf.fact || sf}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bad faith indicators */}
      {cs.bad_faith_indicators?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">Signs of Bad Faith</p>
          <ul className="space-y-1.5">
            {cs.bad_faith_indicators.map((indicator, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional leverage points */}
      {leveragePoints.length > 1 && (
        <div className="mb-4">
          <button
            onClick={() => setShowAllLeverage(v => !v)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showAllLeverage
              ? '▲ Hide additional arguments'
              : `▼ View ${leveragePoints.length - 1} more argument${leveragePoints.length > 2 ? 's' : ''}`}
          </button>
          {showAllLeverage && (
            <div className="mt-3 space-y-3">
              {leveragePoints.slice(1).map((lp, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{lp.title}</p>
                    {lp.severity && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        lp.severity === 'high'   ? 'bg-red-100 text-red-700'
                        : lp.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        {lp.severity}
                      </span>
                    )}
                  </div>
                  {lp.observation && <p className="text-xs text-slate-600">{lp.observation}</p>}
                  {lp.supporting_facts?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {lp.supporting_facts.map((sf, si) => (
                        <li key={si} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
                          <span>{sf.fact || sf}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statutory references */}
      {report.statutory_references?.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
          <button
            onClick={() => setShowStatutoryRefs(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="text-sm font-medium text-slate-700">
              Texas Law References ({report.statutory_references.length})
            </span>
            <SmallChevron open={showStatutoryRefs} />
          </button>
          {showStatutoryRefs && (
            <div className="px-4 py-3 space-y-3 bg-white">
              {report.statutory_references.map((sr, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium text-slate-700">{sr.citation}</p>
                  {sr.title   && <p className="text-slate-500 mt-0.5">{sr.title}</p>}
                  {sr.summary && <p className="text-slate-400 mt-0.5">{sr.summary}</p>}
                  {sr.url && (
                    <a href={sr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-0.5 inline-block">
                      View full text
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NextButton label="What To Do Now" onClick={() => onNavigate('steps')} />
    </div>
  );
}

// ─── StepsView ────────────────────────────────────────────────────────────────

function StepsView({ report, urgStyle, onNavigate, onBack, onLetterClick }) {
  const [expandedSteps,       setExpandedSteps]       = useState({});
  const [checkedItems,        setCheckedItems]         = useState({});
  const [expandedSubSections, setExpandedSubSections] = useState({});

  const proceduralSteps = report.procedural_steps || [];

  const toggleStep = (num) => setExpandedSteps(p => ({ ...p, [num]: !p[num] }));

  const toggleCheck = (stepNum, idx) => {
    const key = `${stepNum}-${idx}`;
    setCheckedItems(p => ({ ...p, [key]: !p[key] }));
  };
  const isChecked = (stepNum, idx) => !!checkedItems[`${stepNum}-${idx}`];

  const toggleSubSection = (num, sec) => {
    const key = `${num}-${sec}`;
    setExpandedSubSections(p => ({ ...p, [key]: !p[key] }));
  };
  const isSubOpen = (num, sec) => !!expandedSubSections[`${num}-${sec}`];

  // Build key dates list
  const getKeyDatesForDisplay = () => {
    if (!report?.timeline) return [];
    const t     = report.timeline;
    const dates = [];

    if (Array.isArray(t.computed_deadlines) && t.computed_deadlines.length > 0) {
      for (const d of t.computed_deadlines) {
        dates.push({ label: d.label, date: d.date, isPast: d.has_passed, daysRemaining: d.days_remaining });
      }
    }

    const moveOut = t.key_dates?.move_out_date || t.move_out_date;
    if (moveOut) {
      dates.unshift({ label: 'Move-out date', date: moveOut, isPast: true, daysRemaining: null });
    }

    if (dates.length <= 1 && moveOut && t.days_since_move_out != null) {
      const moveOutDate = new Date(moveOut);
      if (!isNaN(moveOutDate.getTime())) {
        const deadline = new Date(moveOutDate);
        deadline.setDate(deadline.getDate() + 30);
        dates.push({
          label: '30-day deadline',
          date: deadline.toISOString().slice(0, 10),
          isPast: t.past_30_days === true,
          daysRemaining: 30 - t.days_since_move_out,
        });
      }
    }

    return dates;
  };

  const keyDates          = getKeyDatesForDisplay();
  const urgency           = report.strategy?.urgency;
  const recommendedAction = report.strategy?.recommended_action;

  return (
    <div>
      <BackButton onClick={onBack} />

      <h2 className="text-2xl font-bold text-slate-900 mb-1">What To Do Now</h2>
      <p className="text-sm text-slate-500 mb-6">Follow these steps to maximize your chances of recovery.</p>

      {/* Urgency banner */}
      {urgency && (
        <div className={`rounded-2xl p-4 mb-5 border ${urgStyle.bg} ${urgStyle.border}`}>
          <div className="flex items-center gap-3">
            <svg className={`w-5 h-5 flex-shrink-0 ${urgStyle.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className={`text-sm font-bold ${urgStyle.text}`}>{URGENCY_LABELS[urgency] || urgency}</p>
              {recommendedAction && (
                <p className={`text-xs mt-0.5 ${urgStyle.text} opacity-80`}>
                  Recommended: {ACTION_LABELS[recommendedAction] || recommendedAction}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key dates */}
      {keyDates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Key Dates</p>
          <div className="space-y-2">
            {keyDates.map((d, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-600">{d.label}:</span>
                <span className="font-medium text-slate-900">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
                {d.isPast && d.daysRemaining != null && d.daysRemaining < 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {Math.abs(d.daysRemaining)} days ago
                  </span>
                )}
                {!d.isPast && d.daysRemaining != null && d.daysRemaining > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {d.daysRemaining} days left
                  </span>
                )}
                {d.daysRemaining === 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    Today
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Procedural steps */}
      <div className="space-y-3 mb-5">
        {proceduralSteps.map((step) => (
          <div key={step.step_number} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleStep(step.step_number)}
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {step.step_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-slate-900">{step.title}</p>
                <span className="text-xs text-slate-400">
                  {categoryLabels[step.category] || step.category}
                </span>
              </div>
              <SmallChevron open={!!expandedSteps[step.step_number]} />
            </button>

            {expandedSteps[step.step_number] && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                <p className="text-sm text-slate-700 leading-relaxed">{step.description}</p>

                {step.checklist?.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">Check off as you complete:</p>
                    <ul className="space-y-2">
                      {step.checklist.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 cursor-pointer select-none"
                          onClick={() => toggleCheck(step.step_number, idx)}
                          role="checkbox"
                          aria-checked={isChecked(step.step_number, idx)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              toggleCheck(step.step_number, idx);
                            }
                          }}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 border-2 rounded mt-0.5 flex items-center justify-center transition-colors ${
                            isChecked(step.step_number, idx)
                              ? 'bg-green-500 border-green-500'
                              : 'border-slate-300'
                          }`}>
                            {isChecked(step.step_number, idx) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs transition-colors ${
                            isChecked(step.step_number, idx)
                              ? 'text-slate-400 line-through'
                              : 'text-slate-600'
                          }`}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.resources?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Resources:</p>
                    <ul className="space-y-0.5">
                      {step.resources.map((resource, idx) => (
                        <li key={idx}>
                          {resource.url && /^https?:\/\//i.test(resource.url) ? (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {resource.title}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-600">{resource.title}</span>
                          )}
                          {resource.description && (
                            <span className="text-xs text-slate-400"> — {resource.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(() => {
                  const statutes = report.statutory_references?.slice(0, 2) || [];
                  if (statutes.length === 0) return null;
                  const isOpen = isSubOpen(step.step_number, 'statutes');
                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleSubSection(step.step_number, 'statutes')}
                        className="w-full px-3 py-2 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="text-xs font-medium text-slate-500">
                          Texas Law References ({statutes.length})
                        </span>
                        <SmallChevron open={isOpen} />
                      </button>
                      {isOpen && (
                        <div className="px-3 py-2 space-y-2 bg-white">
                          {statutes.map((statute, idx) => (
                            <div key={idx} className="text-xs">
                              <p className="font-medium text-slate-700">{statute.citation}</p>
                              {statute.title   && <p className="text-slate-500">{statute.title}</p>}
                              {statute.summary && <p className="text-slate-400 mt-0.5">{statute.summary}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Demand letter CTA */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 mb-2">
        <p className="text-sm font-bold text-slate-900 mb-1">Ready to take action?</p>
        <p className="text-xs text-slate-600 mb-3">
          Generate a formal demand letter. We'll pre-fill it with your details — review every field before downloading.
        </p>
        <button
          onClick={onLetterClick}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-colors"
          style={{ backgroundColor: '#F25C54' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e04b43'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F25C54'; }}
        >
          Generate Demand Letter
        </button>
      </div>

      <NextButton label="If They Still Won't Pay" onClick={() => onNavigate('escalate')} />
    </div>
  );
}

// ─── EscalateView ─────────────────────────────────────────────────────────────

function EscalateView({ report, cs, onBack }) {
  const [showDefense, setShowDefense] = useState(false);

  const escalationPath = report.strategy?.escalation_path || null;

  return (
    <div>
      <BackButton onClick={onBack} />

      <h2 className="text-2xl font-bold text-slate-900 mb-1">If They Still Won't Pay</h2>
      <p className="text-sm text-slate-500 mb-6">What happens if the landlord refuses — your escalation options.</p>

      {/* Recovery estimate */}
      {report.recovery_estimate && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-4">What You Could Recover</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-500 mb-1">Minimum</p>
              <p className="text-base font-bold text-slate-700">{report.recovery_estimate.worst_case || '$0'}</p>
            </div>
            <div className="border-x border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Most Realistic</p>
              <p className="text-base font-bold text-green-700">{report.recovery_estimate.likely_case || '$0'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Maximum</p>
              <p className="text-base font-bold text-slate-700">{report.recovery_estimate.best_case || '$0'}</p>
            </div>
          </div>
          {report.recovery_estimate.probability_distribution && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {report.recovery_estimate.probability_distribution.full_recovery != null && (
                <span>Full recovery: <strong className="text-slate-700">{report.recovery_estimate.probability_distribution.full_recovery}%</strong></span>
              )}
              {report.recovery_estimate.probability_distribution.partial_recovery != null && (
                <span>Partial: <strong className="text-slate-700">{report.recovery_estimate.probability_distribution.partial_recovery}%</strong></span>
              )}
              {report.recovery_estimate.probability_distribution.no_recovery != null && (
                <span>None: <strong className="text-slate-700">{report.recovery_estimate.probability_distribution.no_recovery}%</strong></span>
              )}
            </div>
          )}
          {report.recovery_estimate.statutory_penalty && report.recovery_estimate.statutory_penalty !== '$0' && (
            <p className="text-xs text-slate-600 mt-2">
              <span className="font-medium">Statutory penalty:</span>{' '}
              {report.recovery_estimate.statutory_penalty}
            </p>
          )}
          {report.recovery_estimate.confidence_note && (
            <p className="text-xs text-slate-400 mt-2 italic">{report.recovery_estimate.confidence_note}</p>
          )}
        </div>
      )}

      {/* Escalation path */}
      {escalationPath && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Escalation Steps</p>
          <div className="space-y-3">
            {Object.entries(escalationPath).map(([key, value], i) => (
              <div key={key} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Damage defense accordion */}
      {report.damage_defense && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
          <button
            onClick={() => setShowDefense(v => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">If the Landlord Claims Damage</p>
              <p className="text-xs text-slate-400 mt-0.5">How to counter deductions from your deposit</p>
            </div>
            <SmallChevron open={showDefense} />
          </button>
          {showDefense && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 bg-white">
              {typeof report.damage_defense === 'string' ? (
                <p className="text-sm text-slate-600">{report.damage_defense}</p>
              ) : (
                <div className="space-y-3">
                  {(report.damage_defense.summary || report.damage_defense.strategic_note) && (
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {report.damage_defense.summary || report.damage_defense.strategic_note}
                    </p>
                  )}
                  {report.damage_defense.defenses?.length > 0 && (
                    <div className="space-y-3">
                      {report.damage_defense.defenses.map((d, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                          {typeof d === 'string' ? (
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
                              <span>{d}</span>
                            </div>
                          ) : (
                            <>
                              {d.title    && <p className="font-semibold text-slate-800 mb-0.5">{d.title}</p>}
                              {(d.defense || d.key_point) && <p>{d.defense || d.key_point}</p>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!report.damage_defense.summary && !report.damage_defense.strategic_note && !report.damage_defense.defenses && (
                    <div className="space-y-1.5">
                      {Object.entries(report.damage_defense)
                        .filter(([, v]) => typeof v !== 'object')
                        .map(([k, v]) => (
                          <div key={k} className="flex items-start gap-2">
                            <span className="text-xs font-medium text-slate-600 capitalize min-w-[100px]">
                              {k.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-xs text-slate-500">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Small claims resources */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Small Claims Court</p>
        <ul className="space-y-2.5">
          <li>
            <a
              href="https://www.txcourts.gov/programs-interests/self-represented-litigants/"
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Texas Courts — Self-Represented Litigants Guide
            </a>
          </li>
          <li>
            <a
              href="https://texaslawhelp.org/article/filing-small-claims-court"
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              TexasLawHelp.org — Filing in Small Claims Court
            </a>
          </li>
          <li>
            <a
              href="https://guides.sll.texas.gov/landlord-tenant-law/security-deposits"
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Texas State Law Library — Security Deposit Law
            </a>
          </li>
        </ul>
      </div>

      {/* Attorney referral */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Want an Attorney in Your Corner?</p>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          This report gives you a strong starting point. For bad faith or high-dollar cases, these resources can connect you with a Texas attorney.
        </p>
        <ul className="space-y-3">
          {[
            {
              href: 'https://www.texasbar.com/AM/Template.cfm?Section=Lawyer_Referral_Service1',
              title: 'Texas Bar Lawyer Referral Service',
              desc: 'Official State Bar referral. $20 consultation — 30 minutes with a licensed Texas attorney.',
            },
            {
              href: 'https://texaslawhelp.org/find-legal-help',
              title: 'TexasLawHelp.org — Find Legal Help',
              desc: 'Free and low-cost legal aid directory for Texas tenants.',
            },
            {
              href: 'https://lonestarlegal.blog',
              title: 'Lone Star Legal Aid',
              desc: 'Free civil legal services for low-income Texans.',
            },
          ].map(({ href, title, desc }) => (
            <li key={href} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
                  {title}
                </a>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
          Many tenant attorneys work on contingency for security deposit cases — no upfront cost if you win.
        </p>
      </div>
    </div>
  );
}

// ─── Main ReportPage ──────────────────────────────────────────────────────────

function ReportPage() {
  const { caseId } = useParams();
  const navigate   = useNavigate();

  const [status, setStatus]               = useState('loading');
  const [report, setReport]               = useState(null);
  const [context, setContext]             = useState(null);
  const [showLetterModal, setShowLetterModal] = useState(false);

  const [activeView, setActiveView] = useState('hub');
  const [fading, setFading]         = useState(false);

  const {
    downloadPdf,
    retry: retryPdf,
    loading: pdfLoading,
    error: pdfError,
    progress: pdfProgress,
  } = usePdfDownload(caseId);

  // ─── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    fetch(`${API_BASE}/api/documents/${caseId}/json`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 402) {
          if (isMounted) navigate(`/review/${caseId}`);
          return null;
        }
        return r.json();
      })
      .then((payload) => {
        if (!isMounted || !payload) return;
        if (payload.status === 'ok' && payload.data.report) {
          setReport(payload.data.report);
          setContext(payload.data.context || null);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (isMounted) setStatus('error');
      });

    return () => { isMounted = false; };
  }, [caseId, navigate]);

  // ─── Slide-fade navigation ────────────────────────────────────────────────

  const navigateTo = (view) => {
    setFading(true);
    setTimeout(() => {
      setActiveView(view);
      setFading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
  };

  // ─── Loading / error ───────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppLayout>
        <main className="container py-8 pb-20">
          <div className="text-center py-20">
            <p className="text-slate-600 text-lg">Loading your report...</p>
            <div className="animate-pulse mt-4">
              <div className="h-2 bg-slate-200 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
        </main>
      </AppLayout>
    );
  }

  if (status === 'error') {
    return (
      <AppLayout>
        <main className="container py-8 pb-20">
          <div className="form-card text-center">
            <p className="text-red-600 text-lg font-semibold">Unable to load your report</p>
            <p className="text-slate-600 mt-2">Please try again or contact support.</p>
            <button onClick={() => window.location.reload()} className="mt-4 btn-primary">
              Try Again
            </button>
          </div>
        </main>
      </AppLayout>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const cs         = report.case_strength || {};
  const grade      = cs.leverage_grade || '?';
  const score      = cs.leverage_score ?? cs.case_strength_score ?? 0;
  const winProb    = cs.win_probability || 0;
  const position   = cs.strategic_position || 'UNCERTAIN';
  const gradeColor = GRADE_COLORS[grade] || '#64748b';
  const posStyle   = POSITION_STYLES[position] || POSITION_STYLES.UNCERTAIN;
  const urgStyle   = URGENCY_STYLES[report.strategy?.urgency] || URGENCY_STYLES.LOW;

  const sharedProps = { report, cs, grade, score, gradeColor, position, winProb, posStyle, urgStyle };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <main className="container py-8 pb-20 max-w-3xl mx-auto px-4">

        {/* Slide-fade wrapper */}
        <div
          style={{
            opacity:    fading ? 0 : 1,
            transform:  fading ? 'translateY(8px)' : 'translateY(0)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          {activeView === 'hub' && (
            <HubView
              {...sharedProps}
              onNavigate={navigateTo}
              onLetterClick={() => setShowLetterModal(true)}
              downloadPdf={downloadPdf}
              pdfLoading={pdfLoading}
              pdfError={pdfError}
              retryPdf={retryPdf}
              pdfProgress={pdfProgress}
            />
          )}

          {activeView === 'status' && (
            <StatusView
              {...sharedProps}
              onNavigate={navigateTo}
              onBack={() => navigateTo('hub')}
            />
          )}

          {activeView === 'steps' && (
            <StepsView
              {...sharedProps}
              onNavigate={navigateTo}
              onBack={() => navigateTo('hub')}
              onLetterClick={() => setShowLetterModal(true)}
            />
          )}

          {activeView === 'escalate' && (
            <EscalateView
              {...sharedProps}
              onBack={() => navigateTo('hub')}
            />
          )}
        </div>

        {/* Disclaimer — always visible at the bottom */}
        <div className="mt-10 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {report.disclaimers?.primary ||
              'This report is provided for informational purposes only. It does not constitute legal advice. ' +
              'For legal advice specific to your situation, consult a licensed Texas attorney.'}
          </p>
        </div>
      </main>

      {/* Demand Letter Modal */}
      {showLetterModal && (
        <LandlordLetterModal
          caseId={caseId}
          context={context}
          report={report}
          onClose={() => setShowLetterModal(false)}
        />
      )}
    </AppLayout>
  );
}

export default ReportPage;
