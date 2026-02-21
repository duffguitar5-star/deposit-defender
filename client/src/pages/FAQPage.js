import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

const FAQS = [
  {
    q: 'Is this legal advice?',
    a: 'No. DepositBack is a document preparation and analysis tool, not a law firm. We analyze your situation against Texas law and help you understand your options. For representation, you need an attorney.',
  },
  {
    q: 'Does this guarantee I get my money back?',
    a: 'Nothing can guarantee that. What we do is give you an honest assessment of your position and the strongest tools to act on it. If your landlord broke the law, you\'ll know — and you\'ll know what to do about it.',
  },
  {
    q: 'What if my landlord just ignores me?',
    a: 'Ignoring a formal demand letter is itself a legal risk for landlords. If they don\'t respond, that strengthens your case in small claims court. We walk you through exactly what to do if they go quiet.',
  },
  {
    q: 'What if I\'m wrong about my case?',
    a: 'Then we\'ll tell you that too. If the deductions hold up and the timeline was followed correctly, we\'ll say so clearly. Better to know now than to spend time and energy on a weak claim.',
  },
  {
    q: 'What documents do I need?',
    a: 'Your lease, any move-out communication from your landlord, the itemized deduction statement (if they sent one), and your move-in and move-out dates. If you don\'t have everything, start anyway — we\'ll tell you what matters most.',
  },
  {
    q: 'How long does this take?',
    a: 'The intake is under five minutes. Your analysis is ready immediately after.',
  },
  {
    q: 'Is this only for Texas renters?',
    a: 'Right now, yes. Our analysis is built around Texas Property Code §§ 92.101–92.109, which governs security deposit returns. Other states have different rules. Texas coverage is deep and accurate — other states are coming.',
  },
  {
    q: 'Can this help if I already moved out?',
    a: 'Yes. Most renters come to us after the fact — after they\'ve received a partial refund, a deduction list they don\'t agree with, or nothing at all. The clock starts at move-out. Don\'t wait longer than you have to.',
  },
];

function FAQPage() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(prev => prev === i ? null : i);

  return (
    <AppLayout>
      <main className="container pb-24">

        {/* Header */}
        <section className="pt-16 pb-12 max-w-2xl">
          <h1
            className="text-5xl font-bold text-slate-900 leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            Questions.
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Straight answers. No runaround.
          </p>
        </section>

        {/* FAQ Accordion */}
        <section className="mb-20 max-w-3xl">
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className={i < FAQS.length - 1 ? 'border-b border-slate-200' : ''}
              >
                <button
                  className="w-full text-left px-8 py-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  onClick={() => toggle(i)}
                >
                  <span
                    className="text-base font-semibold text-slate-900"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {faq.q}
                  </span>
                  <span className="text-slate-400 flex-shrink-0 text-lg leading-none">
                    {openIndex === i ? '−' : '+'}
                  </span>
                </button>
                {openIndex === i && (
                  <div className="px-8 pb-6">
                    <p className="text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
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
            Still unsure? Start anyway.
          </h2>
          <p className="mt-3 text-slate-500">The analysis is free. See what we find.</p>
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

export default FAQPage;
