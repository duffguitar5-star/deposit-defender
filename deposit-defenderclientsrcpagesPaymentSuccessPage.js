import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
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
      <main className="container py-12">
        <div className="form-card text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Status</h2>
          {status === 'verifying' && (
            <div className="space-y-4">
              <p className="text-slate-600">Verifying your payment...</p>
              <div className="animate-pulse"><div className="h-2 bg-slate-200 rounded w-3/4 mx-auto"></div></div>
            </div>
          )}
          {status === 'pending' && (
            <div className="space-y-4">
              <p className="text-yellow-600 text-lg font-semibold">Payment Processing</p>
              <p className="text-slate-600">Your payment is still being processed. Please refresh in a few moments.</p>
              <button onClick={() => window.location.reload()} className="mt-4 btn-primary">Refresh Page</button>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-red-600 text-lg font-semibold">Verification Error</p>
              <p className="text-slate-600">Unable to verify your payment. Please contact support if you were charged.</p>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

export default PaymentSuccessPage;