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
      <main className="container py-12">
        <div className="form-card text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Cancelled</h2>
          <div className="space-y-6">
            <div className="text-yellow-600 text-5xl mb-4">&#9888;</div>
            <p className="text-slate-600 text-lg">Your payment was not completed. No charges were made.</p>
            <p className="text-slate-600">You can try again when you are ready.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {caseId && <button onClick={() => navigate(`/review/${caseId}`)} className="btn-accent">Try Again</button>}
              <button onClick={() => navigate('/')} className="btn-outline">Return to Home</button>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

export default PaymentCancelPage;