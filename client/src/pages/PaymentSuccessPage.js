import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [caseId, setCaseId] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) { setStatus('error'); return; }

    const verify = () => {
      fetch(`${API_BASE}/api/payments/verify/${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'ok' && data.data.isPaid) {
            navigate(`/action-plan/${data.data.caseId}`);
          } else {
            setRetryCount(prev => {
              const next = prev + 1;
              if (next < MAX_RETRIES) { setTimeout(verify, RETRY_DELAY_MS); return next; }
              setStatus('pending'); return next;
            });
          }
        })
        .catch(() => setStatus('error'));
    };
    verify();
  }, [navigate]);

  return (
    <AppLayout>
      <main className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-slate-200 bg-white p-10 text-center">
          {status === 'verifying' && (
            <div className="space-y-4">
              <svg className="w-10 h-10 text-blue-600 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-lg font-semibold text-slate-800">Confirming your payment…</p>
              <p className="text-sm text-slate-500">This usually takes just a moment.</p>
            </div>
          )}
          {status === 'pending' && (
            <div className="space-y-4">
              <svg className="w-10 h-10 text-amber-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-semibold text-slate-800">Almost there</p>
              <p className="text-slate-500 text-sm">Your payment is still processing. Give it a moment and try refreshing.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-3 font-bold text-sm transition-colors inline-flex items-center justify-center"
              >
                Refresh
              </button>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <svg className="w-10 h-10 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-semibold text-slate-800">Couldn't verify payment</p>
              <p className="text-sm text-slate-500">If you were charged, email us and we'll sort it out immediately.</p>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

export default PaymentSuccessPage;