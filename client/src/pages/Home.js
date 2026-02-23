import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import HeroBanner from '../components/layout/HeroBanner';

function Home() {
  return (
    <AppLayout>
      <HeroBanner />

      <main className="container pb-24">

        {/* Product explanation — what DepositBack does */}
        <section className="mt-12 mb-12 max-w-3xl mx-auto text-center px-4">
          <h2
            className="text-2xl font-bold text-slate-900 mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Did your landlord keep your deposit?
          </h2>
          <p className="text-slate-600 text-base leading-relaxed mb-8">
            Texas law requires landlords to return your deposit — or send a written itemized list of deductions — within 30 days of move-out. If yours didn't, you may be entitled to get it back, plus penalties.
            <br className="hidden md:block" />
            DepositBack analyzes your case, scores your legal position, and generates a demand letter you can send today.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { step: '1', label: 'Upload your lease', sub: 'We auto-fill your details' },
              { step: '2', label: 'We analyze your case', sub: 'Scored against Texas law' },
              { step: '3', label: 'Get your action plan', sub: 'Demand letter + next steps' },
            ].map(({ step, label, sub }) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mb-1">
                  {step}
                </div>
                <p className="text-sm font-semibold text-slate-900 leading-tight">{label}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof — why a letter works */}
        <section className="mb-10 max-w-2xl mx-auto px-4 text-center">
          <p className="text-slate-700 text-base font-semibold leading-snug mb-1">
            Most deposit disputes resolve with a single letter.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed">
            When landlords realize a tenant knows Texas law, the calculus changes:
            pay now or risk 3× penalties in court.
          </p>
        </section>

        {/* Validation Strip — 3 punchy factual hits */}
        <section className="mt-4 mb-20">
          <div className="grid gap-0 md:grid-cols-3 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-8 py-8 border-b md:border-b-0 md:border-r border-slate-200">
              <p
                className="text-3xl font-bold text-slate-900 leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                30 days.
              </p>
              <p className="mt-2 text-sm text-slate-500 leading-snug">
                Texas landlords have 30 days to return your deposit or itemize deductions. Did yours?
              </p>
            </div>
            <div className="px-8 py-8 border-b md:border-b-0 md:border-r border-slate-200">
              <p
                className="text-3xl font-bold text-slate-900 leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Itemize or forfeit.
              </p>
              <p className="mt-2 text-sm text-slate-500 leading-snug">
                Vague deductions don't hold up. Every charge must be specific and documented.
              </p>
            </div>
            <div className="px-8 py-8">
              <p
                className="text-3xl font-bold text-slate-900 leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                3× damages.
              </p>
              <p className="mt-2 text-sm text-slate-500 leading-snug">
                In bad faith cases, you could recover triple your deposit plus attorney's fees. Texas law has teeth.
              </p>
            </div>
          </div>
        </section>

        {/* Return visitor CTA */}
        <section className="text-center mb-20">
          <p className="text-sm text-slate-500">
            Already have a report?{' '}
            <a
              href="/access-report"
              className="text-blue-700 font-semibold hover:underline"
            >
              Access it here →
            </a>
          </p>
        </section>

      </main>

      <footer className="footer">
        <div className="container text-sm text-slate-500">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p
                className="font-bold text-slate-900 uppercase tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                DepositBack
              </p>
              <p className="mt-2">Texas document preparation for security deposit disputes.</p>
              <p className="mt-1">Not legal advice. Not a law firm. Your situation, analyzed.</p>
            </div>
            <ul className="space-y-1 md:text-right">
              <li><a href="/how-it-works" className="hover:text-slate-700">How It Works</a></li>
              <li><a href="/faq" className="hover:text-slate-700">FAQ</a></li>
              <li><a href="/access-report" className="hover:text-slate-700">Access My Report</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </AppLayout>
  );
}

export default Home;
