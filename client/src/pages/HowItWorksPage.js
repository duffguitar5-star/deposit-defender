import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

const STEPS = [
  {
    number: '01',
    headline: 'Share the basics.',
    body: 'Grab your lease and upload it — we\'ll auto-fill your details in seconds. No lease handy? You can enter everything manually.',
  },
  {
    number: '02',
    headline: 'We run the numbers.',
    body: 'We check the timeline against Texas law, review each deduction for legitimacy, and flag anything that doesn\'t hold up. The law is specific — landlords have to follow it exactly.',
  },
  {
    number: '03',
    headline: 'You get a clear picture.',
    body: 'You receive a structured breakdown of your case: where you stand, what the landlord did wrong, and how strong your position is. No jargon.',
  },
  {
    number: '04',
    headline: 'You decide the move.',
    body: 'Send a demand letter. Request itemization. Take it to small claims court. We give you the plan and the documents. You pull the trigger.',
  },
];

function HowItWorksPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <main className="container pb-24">

        {/* Header */}
        <section className="pt-16 pb-12 max-w-2xl">
          <h1
            className="text-5xl font-bold text-slate-900 leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            How It Works
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Four steps. No guesswork. Avoid the expense of hiring a lawyer.
          </p>
        </section>

        {/* Steps */}
        <section className="mb-20">
          <div className="space-y-0 border border-slate-200 rounded-2xl overflow-hidden">
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-8 px-10 py-10 ${i < STEPS.length - 1 ? 'border-b border-slate-200' : ''}`}
              >
                <div
                  className="text-5xl font-bold text-slate-200 leading-none select-none flex-shrink-0 w-14"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {step.number}
                </div>
                <div>
                  <h2
                    className="text-xl font-bold text-slate-900"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {step.headline}
                  </h2>
                  <p className="mt-2 text-slate-600 leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-16 border-t border-slate-100">
          <h2
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            Ready to see where you stand?
          </h2>
          <p className="mt-3 text-slate-500">It takes less than five minutes.</p>
          <button
            onClick={() => navigate('/intake')}
            className="mt-8 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-8 py-4 text-lg font-bold inline-flex items-center justify-center"
          >
            Get It Back
          </button>
        </section>

      </main>
    </AppLayout>
  );
}

export default HowItWorksPage;
