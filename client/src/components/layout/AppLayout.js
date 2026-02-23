import React from 'react';
import { useNavigate } from 'react-router-dom';

function AppLayout({ children }) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1
              className="cursor-pointer m-0 leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.75rem', letterSpacing: '-0.03em' }}
              onClick={() => navigate('/')}
            >
              <span className="font-medium text-slate-700">Deposit</span>
              <span className="font-bold text-blue-700">Back</span>
            </h1>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/how-it-works" className="nav-link">How It Works</a>
            <a href="/faq" className="nav-link">FAQ</a>
          </nav>
        </div>
      </header>

      {children}

      <div className="border-t border-slate-100 py-4 mt-4">
        <div className="container text-center">
          <a href="/disclaimers" className="text-xs text-slate-400 hover:text-slate-600 underline">
            Disclaimers
          </a>
          <span className="text-xs text-slate-300 mx-2">·</span>
          <span className="text-xs text-slate-400">Not legal advice. Not a law firm.</span>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
