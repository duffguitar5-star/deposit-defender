import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

function PaymentCancelPage() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('case_id');
    if (id) setCaseId(id);
  }, []);

  return (
    <AppLayout>
      <main className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-slate-900 mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >No worries — nothing was charged.</h2>
          <p className="text-slate-500 text-sm mb-8">
            All your case data is saved. You can pick up exactly where you left off.
          </p>
          <div className="flex flex-col gap-3">
            {caseId && (
              <button
                onClick={() => navigate(`/review/${caseId}`)}
                className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-3.5 font-bold text-sm transition-colors inline-flex items-center justify-center"
              >
                Pick Up Where I Left Off
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="border border-slate-200 hover:border-slate-300 bg-white text-slate-600 rounded-xl px-6 py-3.5 font-medium text-sm transition-colors inline-flex items-center justify-center"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

export default PaymentCancelPage;
