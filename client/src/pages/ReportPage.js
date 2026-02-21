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
  HIGH:   { bg: 'bg-red-100',    text: 'text-red-700'    },
  MEDIUM: { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  LOW:    { bg: 'bg-green-100',  text: 'text-green-700'  },
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

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

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

// ─── Main Component ───────────────────────────────────────────────────────────

function ReportPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');
  const [report, setReport] = useState(null);
  const [context, setContext] = useState(null);
  const [showLetterModal, setShowLetterModal] = useState(false);

  // Primary lane state — null = all collapsed, 1/2/3 = that lane is open
  const [openLane, setOpenLane] = useState(null);

  // LANE 1 sub-state
  const [showAllLeverage,  setShowAllLeverage]  = useState(false);
  const [showStatutoryRefs, setShowStatutoryRefs] = useState(false);

  // LANE 2 sub-state
  const [showAllSteps,       setShowAllSteps]       = useState(false);
  const [expandedSteps,      setExpandedSteps]      = useState({});
  const [checkedItems,       setCheckedItems]       = useState({});
  const [expandedSubSections, setExpandedSubSections] = useState({});

  // LANE 3 sub-state
  const [showDefense, setShowDefense] = useState(false);

  const [showBackToTop, setShowBackToTop] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ─── Interaction helpers ───────────────────────────────────────────────────

  // Toggle primary lane — only one open at a time
  const toggleLane = (lane) => setOpenLane((prev) => (prev === lane ? null : lane));

  const toggleStep = (num) =>
    setExpandedSteps((prev) => ({ ...prev, [num]: !prev[num] }));

  const toggleCheck = (stepNum, idx) => {
    const key = `${stepNum}-${idx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const isChecked = (stepNum, idx) => !!checkedItems[`${stepNum}-${idx}`];

  const toggleSubSection = (num, sec) => {
    const key = `${num}-${sec}`;
    setExpandedSubSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const isSubOpen = (num, sec) => !!expandedSubSections[`${num}-${sec}`];

  // Build key dates list from report timeline
  const getKeyDatesForDisplay = () => {
    if (!report?.timeline) return [];
    const t = report.timeline;
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

  // ─── Loading / error states ────────────────────────────────────────────────

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

  // ─── Derived display values ────────────────────────────────────────────────

  const cs          = report.case_strength || {};
  const grade       = cs.leverage_grade || '?';
  const score       = cs.leverage_score ?? cs.case_strength_score ?? 0;
  const winProb     = cs.win_probability || 0;
  const position    = cs.strategic_position || 'UNCERTAIN';
  const gradeColor  = GRADE_COLORS[grade] || '#64748b';
  const posStyle    = POSITION_STYLES[position] || POSITION_STYLES.UNCERTAIN;
  const urgStyle    = URGENCY_STYLES[report.strategy?.urgency] || URGENCY_STYLES.LOW;

  const leveragePoints  = report.leverage_points || [];
  const proceduralSteps = report.procedural_steps || [];
  const escalationPath  = report.strategy?.escalation_path || null;
  const topLP           = leveragePoints[0] || null;

  // Logic rules: show/hide lanes
  const showLane1 = leveragePoints.length > 0;
  const showLane2 = proceduralSteps.length > 0;
  const showLane3 = !!escalationPath;

  // Next upcoming deadline for Lane 2 collapsed preview
  const nextDeadline = getKeyDatesForDisplay().find((d) => !d.isPast);

  // Evidence matrix entries (exclude overall_strength key, show primitives only)
  const evidenceEntries = cs.evidence_matrix
    ? Object.entries(cs.evidence_matrix).filter(
        ([k, v]) => k !== 'overall_strength' && typeof v !== 'object'
      )
    : [];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <main className="container py-8 pb-20 max-w-2xl mx-auto px-4">

        {/* ════════════════════════════════════════════════════════
            TOP HEADER — Grade badge + one-sentence summary
            ════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4 font-medium">Your DepositBack Report</p>
          <div className="flex items-center gap-4 mb-3">
            {/* Grade circle */}
            <div
              className="flex-shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-sm"
              style={{ backgroundColor: gradeColor }}
            >
              <span className="text-2xl leading-none">{grade}</span>
              <span className="text-xs opacity-80 leading-tight">{score}/100</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Case Strength</p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
              >
                {position}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">Based on your lease and timeline, here's what Texas law says about your situation.</p>
        </div>

        {/* ════════════════════════════════════════════════════════
            GENERATE DEMAND LETTER — Prominent CTA
            ════════════════════════════════════════════════════ */}
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
              onClick={() => setShowLetterModal(true)}
              className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: '#F25C54' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e04b43'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F25C54'; }}
            >
              Generate Demand Letter
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            3 STRATEGIC LANES
            ════════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* ══════════════════════════════════════════════════════
              LANE 1 — YOUR POSITION
              ══════════════════════════════════════════════════ */}
          {showLane1 ? (
            <div
              className={`border rounded-xl shadow-sm overflow-hidden bg-white transition-colors ${
                openLane === 1 ? 'border-blue-400' : 'border-slate-200'
              }`}
            >
              {/* Lane header — always visible */}
              <button
                onClick={() => toggleLane(1)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <span className="text-lg font-semibold text-slate-900">Your Legal Position</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  {openLane !== 1 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${posStyle.bg} ${posStyle.text}`}>
                      {position}
                    </span>
                  )}
                  <ChevronIcon open={openLane === 1} />
                </div>
              </button>

              {/* Collapsed summary strip */}
              {openLane !== 1 && (
                <div className="px-5 pb-4 flex flex-wrap gap-5">
                  <div>
                    <p className="text-xs text-slate-500">Grade</p>
                    <p className="text-sm font-semibold" style={{ color: gradeColor }}>{grade}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estimated likelihood of recovery</p>
                    <p className="text-sm font-semibold text-slate-900">{winProb}%</p>
                  </div>
                  {report.recovery_estimate?.likely_case && (
                    <div>
                      <p className="text-xs text-slate-500">Most realistic outcome</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {report.recovery_estimate.likely_case}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded body */}
              {openLane === 1 && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                  {/* Score metrics row */}
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Grade', value: grade, color: gradeColor },
                      { label: 'Score', value: `${score}/100`, color: null },
                      { label: 'Estimated likelihood of recovery', value: `${winProb}%`, color: null },
                      report.recovery_estimate?.likely_case
                        ? { label: 'Most realistic outcome', value: report.recovery_estimate.likely_case, color: '#15803d' }
                        : null,
                    ].filter(Boolean).map((item) => (
                      <div key={item.label} className="bg-slate-50 rounded-lg px-4 py-3 text-center min-w-[80px]">
                        <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
                        <p
                          className="text-base font-bold"
                          style={{ color: item.color || '#0f172a' }}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Top leverage point */}
                  {topLP && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-lg font-semibold text-slate-900">{topLP.title}</p>
                        {topLP.severity && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            topLP.severity === 'high'   ? 'bg-red-100 text-red-700'
                            : topLP.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                          }`}>
                            {topLP.severity}
                          </span>
                        )}
                      </div>
                      {topLP.observation && (
                        <p className="text-sm text-slate-700 mb-3">{topLP.observation}</p>
                      )}
                      {topLP.supporting_facts?.length > 0 && (
                        <ul className="space-y-1">
                          {topLP.supporting_facts.map((sf, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
                              <span>{sf.fact || sf}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Bad faith indicators */}
                  {cs.bad_faith_indicators?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">
                        Signs of bad faith
                      </p>
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

                  {/* Statutory references — collapsed sub-accordion */}
                  {report.statutory_references?.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowStatutoryRefs((v) => !v)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="text-xs font-medium text-slate-600">
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
                                <a
                                  href={sr.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline mt-0.5 inline-block"
                                >
                                  View full text
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* "View full legal analysis" — reveals remaining leverage points */}
                  {leveragePoints.length > 1 && (
                    <div>
                      <button
                        onClick={() => setShowAllLeverage((v) => !v)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {showAllLeverage ? '▲ Hide full legal analysis' : '▼ View full legal analysis'}
                      </button>
                      {showAllLeverage && (
                        <div className="mt-3 space-y-3">
                          {leveragePoints.slice(1).map((lp, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 border border-slate-200 rounded-lg p-4"
                            >
                              <div className="flex items-center gap-2 mb-1">
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
                              {lp.observation && (
                                <p className="text-xs text-slate-600">{lp.observation}</p>
                              )}
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
                </div>
              )}
            </div>
          ) : (
            /* Lane 1 fallback when no leverage points */
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-sm text-slate-600">
                We need more information to assess your position. Add more details to strengthen your case.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              LANE 2 — WHAT TO DO NOW
              ══════════════════════════════════════════════════ */}
          {showLane2 && (
            <div
              className={`border rounded-xl shadow-sm overflow-hidden bg-white transition-colors ${
                openLane === 2 ? 'border-blue-400' : 'border-slate-200'
              }`}
            >
              {/* Lane header */}
              <button
                onClick={() => toggleLane(2)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <span className="text-lg font-semibold text-slate-900">What To Do Now</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  {openLane !== 2 && report.strategy?.urgency && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgStyle.bg} ${urgStyle.text}`}>
                      {URGENCY_LABELS[report.strategy.urgency] || report.strategy.urgency}
                    </span>
                  )}
                  <ChevronIcon open={openLane === 2} />
                </div>
              </button>

              {/* Collapsed summary strip */}
              {openLane !== 2 && (
                <div className="px-5 pb-4 flex flex-wrap gap-5">
                  {report.strategy?.recommended_action && (
                    <div>
                      <p className="text-xs text-slate-500">Your next step</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {ACTION_LABELS[report.strategy.recommended_action] || report.strategy.recommended_action}
                      </p>
                    </div>
                  )}
                  {report.strategy?.urgency && (
                    <div>
                      <p className="text-xs text-slate-500">Urgency</p>
                      <p className={`text-sm font-semibold ${urgStyle.text}`}>
                        {URGENCY_LABELS[report.strategy.urgency] || report.strategy.urgency}
                      </p>
                    </div>
                  )}
                  {nextDeadline && (
                    <div>
                      <p className="text-xs text-slate-500">Act by</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(nextDeadline.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded body */}
              {openLane === 2 && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                  {/* Procedural steps (first 3, or all if expanded) */}
                  <div className="space-y-3">
                    {proceduralSteps
                      .slice(0, showAllSteps ? proceduralSteps.length : 3)
                      .map((step) => (
                        <div
                          key={step.step_number}
                          className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => toggleStep(step.step_number)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            <div className="flex-shrink-0 w-7 h-7 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-semibold text-xs">
                              {step.step_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">{step.title}</p>
                              <span className="text-xs text-slate-500">
                                {categoryLabels[step.category] || step.category}
                              </span>
                            </div>
                            <SmallChevron open={!!expandedSteps[step.step_number]} />
                          </button>

                          {expandedSteps[step.step_number] && (
                            <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {step.description}
                              </p>

                              {/* Interactive checklist */}
                              {step.checklist?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg p-3">
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

                              {/* Resources */}
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

                              {/* Statute citations (sub-accordion per step) */}
                              {(() => {
                                const statutes = report.statutory_references?.slice(0, 2) || [];
                                if (statutes.length === 0) return null;
                                const isOpen = isSubOpen(step.step_number, 'statutes');
                                return (
                                  <div className="border border-slate-200 rounded-lg overflow-hidden">
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

                  {/* Key Dates block */}
                  {(() => {
                    const keyDates = getKeyDatesForDisplay();
                    if (keyDates.length === 0) return null;
                    return (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                          Key Dates
                        </p>
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
                    );
                  })()}

                  {/* "View complete action plan" toggle */}
                  {proceduralSteps.length > 3 && (
                    <button
                      onClick={() => setShowAllSteps((v) => !v)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showAllSteps
                        ? '▲ Hide additional steps'
                        : `▼ View complete action plan (${proceduralSteps.length - 3} more ${
                            proceduralSteps.length - 3 === 1 ? 'step' : 'steps'
                          })`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              LANE 3 — IF THEY IGNORE YOU
              ══════════════════════════════════════════════════ */}
          {showLane3 && (
            <div
              className={`border rounded-xl shadow-sm overflow-hidden bg-white transition-colors ${
                openLane === 3 ? 'border-blue-400' : 'border-slate-200'
              }`}
            >
              {/* Lane header */}
              <button
                onClick={() => toggleLane(3)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <span className="text-lg font-semibold text-slate-900">If They Don't Respond</span>
                </div>
                <ChevronIcon open={openLane === 3} />
              </button>

              {/* Collapsed summary strip */}
              {openLane !== 3 && (
                <div className="px-5 pb-4 space-y-1.5">
                  {escalationPath.phase_1 && (
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium mt-0.5">
                        Phase 1
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed">{escalationPath.phase_1}</p>
                    </div>
                  )}
                  {escalationPath.phase_2 && (
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium mt-0.5">
                        Phase 2
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed">{escalationPath.phase_2}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded body */}
              {openLane === 3 && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                  {/* Recovery estimate block */}
                  {report.recovery_estimate && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                        What you could recover
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Minimum outcome</p>
                          <p className="text-sm font-bold text-slate-700">
                            {report.recovery_estimate.worst_case || '$0'}
                          </p>
                        </div>
                        <div className="border-x border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">Most realistic outcome</p>
                          <p className="text-sm font-bold text-green-700">
                            {report.recovery_estimate.likely_case || '$0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Maximum recovery</p>
                          <p className="text-sm font-bold text-slate-700">
                            {report.recovery_estimate.best_case || '$0'}
                          </p>
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
                        <p className="text-xs text-slate-500 mt-2 italic">
                          {report.recovery_estimate.confidence_note}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Evidence matrix */}
                  {cs.evidence_matrix && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                        Your evidence
                      </p>
                      {cs.evidence_quality && (
                        <p className="text-sm font-medium text-slate-900 capitalize mb-2">
                          {cs.evidence_quality}
                        </p>
                      )}
                      {evidenceEntries.length > 0 && (
                        <div className="space-y-1.5">
                          {evidenceEntries.map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 capitalize">
                                {k.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-xs font-medium ${
                                v === 'strong' || v === true  ? 'text-green-600'
                                : v === 'weak' || v === false ? 'text-red-600'
                                : 'text-slate-500'
                              }`}>
                                {String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Escalation path */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                      Steps if they don't pay
                    </p>
                    <div className="space-y-2">
                      {Object.entries(escalationPath).map(([key, value], i) => (
                        <div key={key} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Defense section — collapsed sub-accordion */}
                  {report.damage_defense && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowDefense((v) => !v)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="text-xs font-medium text-slate-600">
                          If the landlord claims damage
                        </span>
                        <SmallChevron open={showDefense} />
                      </button>
                      {showDefense && (
                        <div className="px-4 py-3 bg-white">
                          {typeof report.damage_defense === 'string' ? (
                            <p className="text-xs text-slate-600">{report.damage_defense}</p>
                          ) : (
                            <div className="space-y-2">
                              {report.damage_defense.summary && (
                                <p className="text-xs text-slate-700">{report.damage_defense.summary}</p>
                              )}
                              {report.damage_defense.defenses?.length > 0 && (
                                <ul className="space-y-1">
                                  {report.damage_defense.defenses.map((d, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                      <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
                                      <span>{d.defense || d}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {/* Handle flat object defense data */}
                              {!report.damage_defense.summary && !report.damage_defense.defenses && (
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

                  {/* Court filing resource links */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Small claims option
                    </p>
                    <ul className="space-y-1.5">
                      <li>
                        <a
                          href="https://www.txcourts.gov/programs-interests/self-represented-litigants/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Texas Courts — Self-Represented Litigants Guide
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://texaslawhelp.org/article/filing-small-claims-court"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          TexasLawHelp.org — Filing in Small Claims Court
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://guides.sll.texas.gov/landlord-tenant-law/security-deposits"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Texas State Law Library — Security Deposit Law
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            PDF DOWNLOAD
            ════════════════════════════════════════════════════ */}
        <div className="mt-8">
          <button
            className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-4 text-base font-bold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            onClick={downloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading
              ? `Preparing PDF…${pdfProgress > 0 ? ` ${pdfProgress}%` : ''}`
              : 'Download PDF Report'}
          </button>
          {pdfError && (
            <div className="mt-2 flex items-center gap-3 text-sm text-red-600">
              <span>{pdfError}</span>
              <button onClick={retryPdf} className="text-xs underline">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            ATTORNEY REFERRAL
            ════════════════════════════════════════════════════ */}
        <section className="mt-8">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">Want a Texas attorney in your corner?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                This report gives you a strong starting point. If you want professional legal representation — especially for bad faith or high-dollar cases — these Texas tenant rights resources can connect you with an attorney.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <a
                      href="https://www.texasbar.com/AM/Template.cfm?Section=Lawyer_Referral_Service1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      Texas Bar Lawyer Referral Service
                    </a>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Official State Bar referral program. $20 consultation fee — 30 minutes with a licensed Texas attorney.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <a
                      href="https://texaslawhelp.org/find-legal-help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      TexasLawHelp.org — Find Legal Help
                    </a>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Free and low-cost legal aid directory for Texas tenants. Includes income-based qualification options.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <a
                      href="https://lonestarlegal.blog"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      Lone Star Legal Aid
                    </a>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Free civil legal services for low-income Texans. Covers Houston, East Texas, and the Gulf Coast region.
                    </p>
                  </div>
                </li>
              </ul>
              <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                Many tenant attorneys work on contingency for security deposit cases — meaning no upfront cost if you win.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            DISCLAIMER
            ════════════════════════════════════════════════════ */}
        <section className="mt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              {report.disclaimers?.primary ||
                'This report is provided for informational purposes only. It does not constitute legal advice. ' +
                'For legal advice specific to your situation, consult a licensed Texas attorney.'}
            </p>
          </div>
        </section>
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

      {/* Floating back-to-top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed right-4 bg-slate-900 text-white px-4 rounded-full shadow-lg hover:bg-slate-800 active:bg-slate-700 transition-all flex items-center justify-center gap-2 text-sm font-medium z-50 min-h-[48px] min-w-[48px]"
          style={{
            bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="hidden sm:inline">Back to Top</span>
        </button>
      )}
    </AppLayout>
  );
}

export default ReportPage;
