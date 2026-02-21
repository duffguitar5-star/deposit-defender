import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch (_) { return dateStr; }
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function deadlineDate(days) {
  const n = parseInt(days, 10) || 14;
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Field input ─────────────────────────────────────────────────────────────

function FieldInput({ label, value, onChange, placeholder = '', required = false, type = 'text', hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border p-2 text-sm ${
          required && !value ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </label>
  );
}

// ── Letter Preview ───────────────────────────────────────────────────────────

function LetterPreview({ fields, report }) {
  const {
    tenantName, tenantCurrentAddress, tenantCurrentCityStateZip,
    tenantEmail, tenantPhone,
    landlordName, landlordAddress, landlordCityStateZip,
    propertyAddress, propertyCity,
    moveOutDate, depositAmount, demandAmount, responseDeadlineDays,
    letterDate,
  } = fields;

  const timeline = report?.timeline || {};
  const leverage = report?.leverage_points || [];
  const cs = report?.case_strength || {};
  const daysSince = timeline.days_since_move_out;
  const past30 = timeline.past_30_days;
  const isBadFaith = cs.bad_faith_indicators && cs.bad_faith_indicators.length > 0;

  const fullPropertyAddress = propertyCity
    ? `${propertyAddress}, ${propertyCity}`
    : propertyAddress;

  const topViolations = leverage.filter(lp => lp.severity === 'high').slice(0, 3);

  const Blank = ({ v, label }) => v
    ? <span>{v}</span>
    : <span className="inline-block border-b border-slate-400 text-slate-400 italic min-w-[100px]">[{label}]</span>;

  return (
    <div
      className="bg-white shadow-md mx-auto font-serif text-sm leading-relaxed text-slate-900"
      style={{ maxWidth: 600, padding: '48px 56px', minHeight: 800, fontFamily: 'Georgia, serif', fontSize: '13px' }}
    >
      {/* Sender block */}
      <div className="mb-4 leading-6">
        <Blank v={tenantName} label="Your Name" /><br />
        <Blank v={tenantCurrentAddress} label="Your Current Address" /><br />
        <Blank v={tenantCurrentCityStateZip} label="City, State ZIP" /><br />
        {(tenantEmail || tenantPhone) && (
          <span>{[tenantEmail, tenantPhone].filter(Boolean).join('   |   ')}</span>
        )}
      </div>

      {/* Date */}
      <div className="mb-4">{letterDate || todayFormatted()}</div>

      {/* Recipient */}
      <div className="mb-4 leading-6">
        <Blank v={landlordName} label="Landlord Name" /><br />
        <Blank v={landlordAddress} label="Landlord Address" /><br />
        <Blank v={landlordCityStateZip} label="City, State ZIP" />
      </div>

      {/* RE line */}
      <div className="mb-4">
        <strong>RE: Formal Demand for Return of Security Deposit — </strong>
        <Blank v={fullPropertyAddress} label="Property Address" />
      </div>

      {/* Salutation */}
      <div className="mb-3">
        {landlordName ? `Dear ${landlordName}:` : 'To Whom It May Concern:'}
      </div>

      {/* P1: Tenancy summary */}
      <p className="mb-3 text-justify">
        I am writing to formally demand the return of my security deposit in connection with my former tenancy at{' '}
        <Blank v={fullPropertyAddress} label="property address" />
        {moveOutDate ? `, which ended on ${formatDate(moveOutDate)}` : ''}.{' '}
        I paid a security deposit{depositAmount ? ` of ${depositAmount}` : ''} at the commencement of my tenancy.{' '}
        To date, you have not returned the deposit, nor have you provided a written, itemized statement of any deductions as required by Texas law.
      </p>

      {/* P2: Legal violations */}
      <p className="mb-3 text-justify">
        {daysSince != null && (
          past30
            ? `As of today, ${daysSince} days have elapsed since my move-out date — well beyond the 30-day statutory period. `
            : `As of today, ${daysSince} days have elapsed since my move-out date, and the statutory 30-day deadline is approaching. `
        )}
        Texas Property Code § 92.103 requires a landlord to refund a security deposit, less any lawfully withheld amounts, no later than 30 days after the date the tenant surrenders the premises.{' '}
        Texas Property Code § 92.104 further requires that any deductions be itemized in a written statement provided to the tenant.{' '}
        You have complied with neither of these requirements.
      </p>

      {/* P3: Key violations */}
      {topViolations.length > 0 && (
        <div className="mb-3">
          <p>The following violations support this demand:</p>
          <ul className="mt-1 ml-4 space-y-1 list-none">
            {topViolations.map((lp, i) => {
              const citations = (lp.statute_citations || []).map(c => c.citation || c).join(', ');
              return (
                <li key={i}>
                  • {lp.title}{citations ? ` (${citations})` : ''}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* P4: Bad faith warning */}
      {isBadFaith && (
        <p className="mb-3 text-justify">
          Please be advised that a landlord who, in bad faith, retains a security deposit or fails to provide a written itemized accounting is liable under Texas Property Code § 92.109 for{' '}
          $100, three times the amount of the security deposit wrongfully withheld, and the tenant's reasonable attorney's fees.
        </p>
      )}

      {/* P5: Demand */}
      <p className="mb-3 text-justify">
        I hereby formally demand that you remit to me{' '}
        {demandAmount ? demandAmount : <Blank v={''} label="demand amount" />}{' '}
        within {responseDeadlineDays || 14} days of receipt of this letter{' '}
        (by {deadlineDate(responseDeadlineDays)}).
      </p>

      {/* P6: Escalation */}
      <p className="mb-3 text-justify">
        If I do not receive full payment within the stated period, I intend to pursue all available legal remedies,
        including filing suit in the appropriate justice court (small claims) for the full amount owed,
        statutory damages, and any attorney's fees permitted under Texas law.
        I hope we can resolve this matter without the need for litigation.
      </p>

      {/* Notice */}
      <p className="mb-4 text-xs italic text-slate-500">
        This letter constitutes written notice for all purposes under Texas Property Code Chapter 92.
      </p>

      {/* Closing */}
      <p className="mb-8">Sincerely,</p>

      <div className="border-b border-slate-700 w-48 mb-1" />
      <div className="leading-6">
        <Blank v={tenantName} label="Your Name" /><br />
        {tenantCurrentAddress && <><span>{tenantCurrentAddress}</span><br /></>}
        {tenantCurrentCityStateZip && <><span>{tenantCurrentCityStateZip}</span><br /></>}
        {tenantEmail && <><span>{tenantEmail}</span><br /></>}
        {tenantPhone && <span>{tenantPhone}</span>}
      </div>

      {/* Footer disclaimer */}
      <div className="mt-10 pt-3 border-t border-slate-200">
        <p className="text-xs italic text-slate-400 text-center">
          This letter was prepared using Deposit Defender, an informational tool.
          It does not constitute legal advice. Consult a licensed Texas attorney for legal advice specific to your situation.
        </p>
      </div>
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────

function LandlordLetterModal({ caseId, context, report, onClose }) {
  const [fields, setFields] = useState({
    tenantName: context?.tenantName || '',
    tenantCurrentAddress: '',
    tenantCurrentCityStateZip: '',
    tenantEmail: context?.tenantEmail || '',
    tenantPhone: context?.tenantPhone || '',
    landlordName: context?.landlordName || '',
    landlordAddress: context?.landlordAddress || '',
    landlordCityStateZip: [context?.landlordCity, context?.landlordState, context?.landlordZip]
      .filter(Boolean).join(', '),
    propertyAddress: context?.propertyAddress || '',
    propertyCity: context?.propertyCity || '',
    moveOutDate: context?.moveOutDate || '',
    depositAmount: context?.depositAmount || '',
    demandAmount: report?.recovery_estimate?.amount_still_owed || report?.recovery_estimate?.likely_case || '',
    responseDeadlineDays: '14',
    letterDate: todayFormatted(),
  });

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'preview' on mobile

  const setField = useCallback((key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const missingAddress = !fields.tenantCurrentAddress.trim();

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`${API_BASE}/api/documents/${caseId}/letter`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `demand-letter-${caseId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 150);
    } catch (err) {
      setDownloadError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal container */}
      <div className="flex flex-col bg-white w-full h-full overflow-hidden" style={{ maxHeight: '100dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Review Your Demand Letter</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in the highlighted fields, then download your letter as a PDF.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex border-b border-slate-200 lg:hidden flex-shrink-0">
          {['edit', 'preview'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'edit' ? 'Edit Fields' : 'Letter Preview'}
            </button>
          ))}
        </div>

        {/* Body — two columns on desktop, tab-switched on mobile */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: Edit Fields */}
          <div
            className={`flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 ${
              activeTab === 'edit' ? 'block' : 'hidden'
            } lg:block`}
            style={{ width: '100%', maxWidth: '380px' }}
          >
            <div className="p-4 space-y-5">

              {/* Required field callout */}
              {missingAddress && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
                  <p className="text-xs font-medium text-amber-800">
                    Your current mailing address is required for the letter header.
                  </p>
                </div>
              )}

              {/* Your Info */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your Information</legend>
                <FieldInput label="Full Name" value={fields.tenantName} onChange={v => setField('tenantName', v)} />
                <FieldInput
                  label="Your Current Address"
                  value={fields.tenantCurrentAddress}
                  onChange={v => setField('tenantCurrentAddress', v)}
                  placeholder="Street address"
                  required
                  hint="The address where the landlord should send your deposit"
                />
                <FieldInput
                  label="City, State ZIP"
                  value={fields.tenantCurrentCityStateZip}
                  onChange={v => setField('tenantCurrentCityStateZip', v)}
                  placeholder="Austin, TX 78701"
                />
                <FieldInput label="Email" value={fields.tenantEmail} onChange={v => setField('tenantEmail', v)} type="email" />
                <FieldInput label="Phone" value={fields.tenantPhone} onChange={v => setField('tenantPhone', v)} type="tel" />
              </fieldset>

              {/* Landlord Info */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Landlord Information</legend>
                <FieldInput label="Landlord Name" value={fields.landlordName} onChange={v => setField('landlordName', v)} />
                <FieldInput label="Landlord Address" value={fields.landlordAddress} onChange={v => setField('landlordAddress', v)} />
                <FieldInput
                  label="City, State ZIP"
                  value={fields.landlordCityStateZip}
                  onChange={v => setField('landlordCityStateZip', v)}
                  placeholder="Dallas, TX 75201"
                />
              </fieldset>

              {/* Property & Deposit */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Property & Deposit</legend>
                <FieldInput label="Property Street Address" value={fields.propertyAddress} onChange={v => setField('propertyAddress', v)} />
                <FieldInput label="Property City" value={fields.propertyCity} onChange={v => setField('propertyCity', v)} />
                <FieldInput label="Move-Out Date (YYYY-MM-DD)" value={fields.moveOutDate} onChange={v => setField('moveOutDate', v)} placeholder="2024-01-15" />
                <FieldInput label="Security Deposit Amount" value={fields.depositAmount} onChange={v => setField('depositAmount', v)} placeholder="$1,500.00" />
              </fieldset>

              {/* Demand Terms */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Demand Terms</legend>
                <FieldInput
                  label="Amount You Are Demanding"
                  value={fields.demandAmount}
                  onChange={v => setField('demandAmount', v)}
                  placeholder="$1,500.00"
                  hint="Pre-filled from your case analysis. Adjust if needed."
                />
                <FieldInput
                  label="Response Deadline (days)"
                  value={fields.responseDeadlineDays}
                  onChange={v => setField('responseDeadlineDays', v)}
                  type="number"
                  hint="14 days is standard. Deadline date updates in the preview."
                />
              </fieldset>

              {/* Letter Date */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Letter Date</legend>
                <FieldInput label="Date on Letter" value={fields.letterDate} onChange={v => setField('letterDate', v)} />
              </fieldset>

            </div>
          </div>

          {/* RIGHT: Letter Preview */}
          <div
            className={`flex-1 overflow-y-auto bg-slate-200 p-4 ${
              activeTab === 'preview' ? 'block' : 'hidden'
            } lg:block`}
          >
            <LetterPreview fields={fields} report={report} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {missingAddress && (
              <p className="text-xs text-amber-700 font-medium">
                Please enter your current address before downloading.
              </p>
            )}
            {downloadError && (
              <p className="text-xs text-red-600">{downloadError}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || missingAddress}
              className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Letter PDF
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LandlordLetterModal;
