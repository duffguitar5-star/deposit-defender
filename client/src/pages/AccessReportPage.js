import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

function AccessReportPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/cases/resend-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg('Unable to connect. Please try again.');
      setStatus('error');
    }
  };

  return (
    <AppLayout>
      <main className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-slate-200 bg-white p-10">

          {status !== 'sent' ? (
            <>
              <h2
                className="text-2xl font-bold text-slate-900 mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                Access your report
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                Enter the email address you used when you created your case and we'll send you a fresh link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-3.5 font-bold text-sm transition-colors disabled:opacity-60 inline-flex items-center justify-center"
                >
                  {status === 'loading' ? 'Sending…' : 'Send My Report Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2
                className="text-xl font-bold text-slate-900"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                Check your inbox
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                If we have a report on file for <strong className="text-slate-700">{email}</strong>, we've sent the link. Check your spam folder if it doesn't arrive within a minute.
              </p>
              <button
                onClick={() => { setStatus('idle'); setEmail(''); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Try a different email
              </button>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

export default AccessReportPage;
