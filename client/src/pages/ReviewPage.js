import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { DISCLAIMERS } from '../disclaimers';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const fmt = v => v || 'Not provided';

const GRADE_COLORS = {
  A: '#16a34a',
  B: '#2563eb',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
};

const ACTION_SUMMARY = {
  SEND_DEMAND_LETTER:               'Send a certified demand letter to your landlord immediately.',
  REQUEST_ITEMIZATION_OR_NEGOTIATE: 'Request a written itemization of all deductions.',
  GATHER_EVIDENCE_THEN_EVALUATE:    'Gather your evidence and documentation before acting.',
  REVIEW_SITUATION:                 'Review your situation — more information may strengthen your case.',
};

function ReviewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [caseData, setCaseData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    // Fetch case data (session-gated) and preview data (no session required) in parallel
    Promise.all([
      fetch(`${API_BASE}/api/cases/${caseId}`, { credentials: 'include' })
        .then(r => { if (!r.ok) return null; return r.json(); })
        .catch(() => null),
      fetch(`${API_BASE}/api/documents/${caseId}/preview`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([casePayload, previewPayload]) => {
      if (!isMounted) return;

      if (!casePayload || casePayload.status !== 'ok') {
        setStatus('not_found');
        return;
      }

      const caseRecord = casePayload.data.case;

      if (caseRecord.paymentStatus === 'paid') {
        navigate(`/action-plan/${caseId}`);
        return;
      }

      setCaseData(caseRecord);

      if (previewPayload?.status === 'ok' && previewPayload.data?.preview) {
        setPreviewData(previewPayload.data.preview);
      }

      setStatus('ready');
    }).catch(() => {
      if (isMounted) setStatus('error');
    });

    return () => { isMounted = false; };
  }, [caseId, navigate]);

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (!res.ok) { setPaymentError(data.message || 'Unable to initiate payment.'); setIsProcessing(false); return; }
      window.location.href = data.data.url;
    } catch { setPaymentError('Unable to initiate payment. Please try again.'); setIsProcessing(false); }
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        {status === 'loading' && <div className="text-center py-20"><p className="text-slate-600 text-lg">Analyzing your case...</p></div>}
        {status === 'not_found' && <div className="text-center py-20"><p className="text-red-600 text-lg">Case not found. Please verify the link.</p></div>}
        {status === 'error' && <div className="text-center py-20"><p className="text-red-600 text-lg">Unable to load this case right now.</p></div>}

        {status === 'ready' && caseData && (
          <>
            <section className="text-center py-12 mb-8">
              <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-4 py-1 rounded-full mb-4">Case Created</div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >Your case is ready to analyze.</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Review your details below, then unlock your full action plan.</p>
            </section>

            {/* Case Summary */}
            <section className="max-w-2xl mx-auto mb-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Case Summary</h3>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Tenant</span><span className="font-medium">{fmt(caseData.intake.tenant_information?.full_name)}</span></li>
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Email</span><span className="font-medium">{fmt(caseData.intake.tenant_information?.email)}</span></li>
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Property</span><span className="font-medium">{fmt(caseData.intake.property_information?.property_address)}</span></li>
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">City</span><span className="font-medium">{fmt(caseData.intake.property_information?.city)}</span></li>
                  <li className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Deposit Amount</span><span className="font-medium">{fmt(caseData.intake.security_deposit_information?.deposit_amount)}</span></li>
                  <li className="flex justify-between"><span className="text-slate-500">Move-out Date</span><span className="font-medium">{fmt(caseData.intake.move_out_information?.move_out_date)}</span></li>
                </ul>
              </div>
            </section>

            {/* ── Score Preview Card (pre-payment) ── */}
            {previewData && (
              <section className="max-w-2xl mx-auto mb-8">
                <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4 flex items-center gap-4">
                    {/* Grade badge */}
                    <div
                      className="flex-shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-sm"
                      style={{ backgroundColor: GRADE_COLORS[previewData.leverage_grade] || '#64748b' }}
                    >
                      <span className="text-2xl leading-none">{previewData.leverage_grade || '?'}</span>
                      <span className="text-xs opacity-80 leading-tight">{previewData.leverage_score}/100</span>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-0.5">Your Case Score</p>
                      <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Grade {previewData.leverage_grade} — {previewData.win_probability}% win probability
                      </p>
                    </div>
                  </div>

                  {/* Strongest argument */}
                  {previewData.strongest_argument && (
                    <div className="px-6 pb-4">
                      <div className="bg-white rounded-xl border border-blue-100 p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Your strongest legal argument
                        </p>
                        <p className="text-sm font-medium text-slate-900 leading-snug">
                          {previewData.strongest_argument}
                        </p>
                        {previewData.recommended_action && (
                          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            {ACTION_SUMMARY[previewData.recommended_action] || previewData.recommended_action}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Paywall teaser */}
                  <div className="px-6 pb-5">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Your full action plan includes a step-by-step guide, your demand letter, and the exact Texas statutes that protect you.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Payment Section */}
            <section className="max-w-2xl mx-auto mb-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Unlock Your Full Action Plan</h3>
                <p className="text-4xl font-bold text-slate-900 mt-3 mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >$49.99</p>
                <p className="text-sm text-slate-500 mb-5">One-time. No subscriptions.</p>

                <ul className="text-sm text-slate-600 space-y-1.5 mb-6 text-left max-w-xs mx-auto">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Full legal position analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Step-by-step action plan
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Demand letter template
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    PDF report delivered by email
                  </li>
                </ul>

                {paymentError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{paymentError}</div>}
                <button onClick={handlePayment} disabled={isProcessing} className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-4 text-lg font-bold transition-colors disabled:opacity-60 inline-flex items-center justify-center">
                  {isProcessing ? 'Redirecting to payment...' : 'Get My Action Plan — $49.99'}
                </button>
                <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Stripe-secured · One-time fee · Instant access
                </p>
              </div>
            </section>

            <section className="max-w-2xl mx-auto">
              <div className="border-l-4 border-slate-200 bg-slate-50 p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Before You Pay</h3>
                <ul className="text-xs text-slate-500 space-y-1">{DISCLAIMERS.map(line => <li key={line}>{line}</li>)}</ul>
              </div>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  );
}

export default ReviewPage;
