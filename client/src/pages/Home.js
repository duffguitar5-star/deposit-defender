import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import HeroBanner from '../components/layout/HeroBanner';

function Home() {
  return (
    <AppLayout>
      <HeroBanner />

      <main className="container pb-24">

        {/* Validation Strip — 3 punchy factual hits */}
        <section className="mt-16 mb-20">
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
