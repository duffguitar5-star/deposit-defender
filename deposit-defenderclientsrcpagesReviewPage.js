import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { DISCLAIMERS } from '../disclaimers';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const fmt = v => v || 'Not provided';

function ReviewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [caseData, setCaseData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;
    fetch(`${API_BASE}/api/cases/${caseId}`, { credentials: 'include' })
      .then(r => { if (!r.ok) { setStatus('not_found'); return null; } return r.json(); })
      .then(payload => {
        if (!isMounted || !payload || payload.status !== 'ok') return;
        if (payload.data.case.paymentStatus === 'paid') { navigate(`/action-plan/${caseId}`); return; }
        setCaseData(payload.data.case);
        setStatus('ready');
      })
      .catch(() => { if (isMounted) setStatus('error'); });
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
        {status === 'loading' && <div className="text-center py-20"><p className="text-slate-600 text-lg">Loading your case...</p></div>}
        {status === 'not_found' && <div className="text-center py-20"><p className="text-red-600 text-lg">Case not found. Please verify the link.</p></div>}
        {status === 'error' && <div className="text-center py-20"><p className="text-red-600 text-lg">Unable to load this case right now.</p></div>}

        {status === 'ready' && caseData && (
          <>
            <section className="text-center py-12 mb-8">
              <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-4 py-1 rounded-full mb-4">Data Received</div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Your Information Has Been Submitted</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Review your details below, then proceed to payment to generate your report.</p>
            </section>

            <section className="max-w-2xl mx-auto mb-8">
              <div className="card">
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

            <section className="max-w-2xl mx-auto mb-8">
              <div className="card bg-slate-50 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Document Preparation Fee</h3>
                <p className="text-4xl font-bold text-slate-900 mb-2">$49.99</p>
                <p className="text-sm text-slate-600 mb-6">One-time payment. No subscriptions.</p>
                {paymentError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{paymentError}</div>}
                <button onClick={handlePayment} disabled={isProcessing} className="cta-primary w-full text-lg disabled:opacity-60">
                  {isProcessing ? 'Redirecting to payment...' : 'Proceed to Payment — $49.99'}
                </button>
                <p className="text-xs text-slate-500 mt-4">Secure payment powered by Stripe</p>
              </div>
            </section>

            <section className="max-w-2xl mx-auto">
              <div className="notice-card">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Before You Pay</h3>
                <ul className="text-xs text-slate-600 space-y-1">{DISCLAIMERS.map(line => <li key={line}>{line}</li>)}</ul>
              </div>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  );
}

export default ReviewPage;