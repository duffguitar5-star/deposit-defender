import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { DISCLAIMERS } from '../disclaimers';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const TABS = [
  { id: 'tenant', label: 'Your Info' },
  { id: 'property', label: 'Property & Lease' },
  { id: 'deposit', label: 'Deposit & Move-out' },
  { id: 'notes', label: 'Notes & Submit' },
];

const EMPTY_FORM = {
  tenant_information: { full_name: '', email: '', phone: '' },
  landlord_information: { landlord_name: '', landlord_address: '', landlord_city: '', landlord_state: 'TX', landlord_zip: '', landlord_phone: '' },
  property_information: { property_address: '', city: '', zip_code: '', county: '' },
  lease_information: { lease_start_date: '', lease_end_date: '', lease_type: 'written' },
  move_out_information: { move_out_date: '', forwarding_address_provided: 'unknown', forwarding_address_date: '' },
  security_deposit_information: { deposit_amount: '', pet_deposit_amount: '', deposit_paid_date: '', deposit_returned: 'no', amount_returned: '' },
  post_move_out_communications: { itemized_deductions_received: 'unknown', date_itemized_list_received: '', communication_methods_used: [] },
  additional_notes: { tenant_notes: '' },
  acknowledgements: { texas_only_confirmation: false, non_legal_service_acknowledged: false },
  jurisdiction: 'TX',
};

function IntakePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Lease upload state
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | done | error
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadSkipped, setUploadSkipped] = useState(false);
  const [extractedLeaseText, setExtractedLeaseText] = useState('');

  const update = (section, field, value) =>
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  const toggleComm = (method) => {
    const cur = form.post_move_out_communications.communication_methods_used;
    update('post_move_out_communications', 'communication_methods_used',
      cur.includes(method) ? cur.filter((m) => m !== method) : [...cur, method]);
  };

  // Apply extracted lease data to form
  const applyExtractedData = (ext) => {
    if (!ext) return;
    setForm((prev) => ({
      ...prev,
      tenant_information: {
        ...prev.tenant_information,
        full_name: ext.tenant_name || prev.tenant_information.full_name,
      },
      landlord_information: {
        ...prev.landlord_information,
        landlord_name: ext.landlord_name || prev.landlord_information.landlord_name,
        landlord_address: (
          ext.landlord_address && typeof ext.landlord_address === 'object'
            ? ext.landlord_address.street
            : ext.landlord_address
        ) || prev.landlord_information.landlord_address,
        landlord_city: (
          ext.landlord_address && typeof ext.landlord_address === 'object'
            ? ext.landlord_address.city
            : ext.landlord_city
        ) || prev.landlord_information.landlord_city,
        landlord_state: (
          ext.landlord_address && typeof ext.landlord_address === 'object'
            ? ext.landlord_address.state
            : null
        ) || prev.landlord_information.landlord_state,
        landlord_zip: (
          ext.landlord_address && typeof ext.landlord_address === 'object'
            ? ext.landlord_address.zip
            : ext.landlord_zip
        ) || prev.landlord_information.landlord_zip,
      },
      property_information: {
        ...prev.property_information,
        property_address: ext.property_address || prev.property_information.property_address,
        city: ext.city || prev.property_information.city,
        zip_code: ext.zip_code || prev.property_information.zip_code,
        county: ext.county || prev.property_information.county,
      },
      lease_information: {
        ...prev.lease_information,
        lease_start_date: ext.lease_start_date || prev.lease_information.lease_start_date,
        lease_end_date: ext.lease_end_date || prev.lease_information.lease_end_date,
      },
      security_deposit_information: {
        ...prev.security_deposit_information,
        deposit_amount: ext.deposit_amount || prev.security_deposit_information.deposit_amount,
        pet_deposit_amount: ext.pet_deposit_amount || prev.security_deposit_information.pet_deposit_amount,
      },
    }));
  };

  const handleLeaseFile = async (file) => {
    if (!file) return;
    setUploadState('uploading');
    setUploadMessage('');
    const formData = new FormData();
    formData.append('lease', file);
    try {
      const res = await fetch(`${API_BASE}/api/cases/lease-extract`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        applyExtractedData(data.data.extractedData);
        if (data.data.leaseText) setExtractedLeaseText(data.data.leaseText);
        const hasData = data.data.extractedData && Object.keys(data.data.extractedData).length > 0;
        setUploadState('done');
        setUploadMessage(hasData
          ? data.message || 'Fields auto-filled from your lease. Review and correct anything that looks wrong.'
          : 'Lease uploaded, but we could not auto-detect your details. Please fill in the fields below.');
      } else {
        setUploadState('error');
        setUploadMessage(data.message || 'Unable to process the file. Please fill in the fields manually.');
      }
    } catch {
      setUploadState('error');
      setUploadMessage('Upload failed. Please check your connection and try again, or fill in the fields manually.');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleLeaseFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleLeaseFile(file);
  };

  const skipUpload = () => {
    setUploadSkipped(true);
    setUploadState('done');
  };

  const showUploadStep = uploadState !== 'done';

  const canAdvance = () => {
    const id = TABS[activeTab].id;
    if (id === 'tenant') return form.tenant_information.full_name.trim() && form.tenant_information.email.includes('@');
    if (id === 'property') return form.property_information.property_address.trim() && form.property_information.city.trim() && form.move_out_information.move_out_date;
    if (id === 'deposit') return !!form.security_deposit_information.deposit_amount.trim();
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) { setError('Please fill in the required fields before continuing.'); return; }
    setError(''); setActiveTab((t) => t + 1); window.scrollTo(0, 0);
  };
  const handleBack = () => { setError(''); setActiveTab((t) => t - 1); window.scrollTo(0, 0); };

  const handleSubmit = async () => {
    if (!form.tenant_information.full_name || !form.tenant_information.email) { setError('Name and email are required.'); return; }
    if (!form.acknowledgements.texas_only_confirmation || !form.acknowledgements.non_legal_service_acknowledged) { setError('Please confirm the acknowledgements before submitting.'); return; }
    if (!form.security_deposit_information.deposit_amount.trim()) { setError('Security deposit amount is required.'); return; }
    setIsSubmitting(true); setError('');
    try {
      const submitPayload = extractedLeaseText
        ? { ...form, lease_text: extractedLeaseText }
        : form;
      const res = await fetch(`${API_BASE}/api/cases`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Unable to submit.'); setIsSubmitting(false); return; }
      if (data.data?.caseId) navigate(`/review/${data.data.caseId}`);
    } catch { setError('Unable to submit. Check your connection and try again.'); setIsSubmitting(false); }
  };

  const commMethods = form.post_move_out_communications.communication_methods_used;
  const depositReturned = form.security_deposit_information.deposit_returned;

  return (
    <AppLayout>
      <main className="container pb-20">
        <section className="text-center py-10 mb-6">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Start Your Case</h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Upload your lease to auto-fill your details, then review and complete the form.
          </p>
        </section>

        <div className="max-w-3xl mx-auto space-y-6">

          {/* ── Lease Upload Step ──────────────────────────────────────── */}
          {showUploadStep && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-slate-900">Upload Your Lease</h3>
                <button onClick={skipUpload} className="text-sm text-slate-400 hover:text-slate-600 underline">
                  Skip — fill in manually
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                We will read your lease and auto-fill as many fields as possible. PDF works best.
              </p>

              {uploadState === 'idle' || uploadState === 'error' ? (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, PNG, or JPG &bull; max 10 MB</p>
                  {uploadState === 'error' && uploadMessage && (
                    <p className="mt-3 text-sm text-red-600">{uploadMessage}</p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,.pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 py-6">
                  <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-slate-600">Reading your lease...</p>
                </div>
              )}
            </div>
          )}

          {/* Upload result banner */}
          {uploadState === 'done' && !uploadSkipped && uploadMessage && (
            <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
              uploadMessage.toLowerCase().includes('could not') || uploadMessage.toLowerCase().includes('not available')
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}>
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{uploadMessage}</span>
            </div>
          )}

          {/* ── Tab Nav ────────────────────────────────────────────────── */}
          {uploadState === 'done' && (
            <>
              <div className="flex items-center gap-2 sm:gap-3">
                {TABS.map((tab, idx) => (
                  <React.Fragment key={tab.id}>
                    <button
                      onClick={() => { if (idx < activeTab) { setActiveTab(idx); setError(''); } }}
                      disabled={idx >= activeTab}
                      className="flex items-center gap-2 disabled:cursor-default"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                        idx < activeTab
                          ? 'bg-blue-600 text-white'
                          : idx === activeTab
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {idx < activeTab ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (idx + 1)}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block transition-colors ${
                        idx === activeTab ? 'text-slate-900' : idx < activeTab ? 'text-slate-500' : 'text-slate-300'
                      }`}>{tab.label}</span>
                    </button>
                    {idx < TABS.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${idx < activeTab ? 'bg-blue-600' : 'bg-slate-100'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* ── Tab 0: Your Info ──────────────────────────────────── */}
              {activeTab === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Your Information</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Full Name *</span>
                      <input type="text" required value={form.tenant_information.full_name} onChange={(e) => update('tenant_information', 'full_name', e.target.value)} placeholder="Jane Smith" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Email Address *</span>
                      <input type="email" required value={form.tenant_information.email} onChange={(e) => update('tenant_information', 'email', e.target.value)} placeholder="jane@example.com" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                      <input type="tel" value={form.tenant_information.phone} onChange={(e) => update('tenant_information', 'phone', e.target.value)} placeholder="(512) 555-0100" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                    </label>
                  </div>
                </div>
              )}

              {/* ── Tab 1: Property & Lease ───────────────────────────── */}
              {activeTab === 1 && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Rental Property</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-medium text-gray-700">Property Address *</span>
                        <input type="text" required value={form.property_information.property_address} onChange={(e) => update('property_information', 'property_address', e.target.value)} placeholder="123 Main St, Apt 4" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">City *</span>
                        <input type="text" required value={form.property_information.city} onChange={(e) => update('property_information', 'city', e.target.value)} placeholder="Austin" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">ZIP Code</span>
                        <input type="text" value={form.property_information.zip_code} onChange={(e) => update('property_information', 'zip_code', e.target.value)} placeholder="78701" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">County (for court filings)</span>
                        <input type="text" value={form.property_information.county} onChange={(e) => update('property_information', 'county', e.target.value)} placeholder="Travis" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Landlord / Property Manager</h3>
                      <button
                        type="button"
                        onClick={() => {
                          update('landlord_information', 'landlord_address', form.property_information.property_address);
                          update('landlord_information', 'landlord_city', form.property_information.city);
                          update('landlord_information', 'landlord_zip', form.property_information.zip_code);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 hover:border-blue-400 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        Same as property address
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-medium text-gray-700">Landlord Name *</span>
                        <input type="text" required value={form.landlord_information.landlord_name} onChange={(e) => update('landlord_information', 'landlord_name', e.target.value)} placeholder="ABC Property Management" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-medium text-gray-700">Landlord Address</span>
                        <input type="text" value={form.landlord_information.landlord_address} onChange={(e) => update('landlord_information', 'landlord_address', e.target.value)} placeholder="456 Oak Ave" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">City</span>
                        <input type="text" value={form.landlord_information.landlord_city} onChange={(e) => update('landlord_information', 'landlord_city', e.target.value)} placeholder="Austin" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">ZIP Code</span>
                        <input type="text" value={form.landlord_information.landlord_zip} onChange={(e) => update('landlord_information', 'landlord_zip', e.target.value)} placeholder="78702" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                        <input type="tel" value={form.landlord_information.landlord_phone} onChange={(e) => update('landlord_information', 'landlord_phone', e.target.value)} placeholder="(512) 555-0200" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Lease Dates</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Lease Start</span>
                        <input type="date" value={form.lease_information.lease_start_date} onChange={(e) => update('lease_information', 'lease_start_date', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Lease End</span>
                        <input type="date" value={form.lease_information.lease_end_date} onChange={(e) => update('lease_information', 'lease_end_date', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Lease Type</span>
                        <select value={form.lease_information.lease_type} onChange={(e) => update('lease_information', 'lease_type', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm">
                          <option value="written">Written</option>
                          <option value="oral">Oral</option>
                          <option value="month-to-month">Month-to-Month</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Move-out Date *</span>
                        <input type="date" required value={form.move_out_information.move_out_date} onChange={(e) => update('move_out_information', 'move_out_date', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* ── Tab 2: Deposit & Move-out ─────────────────────────── */}
              {activeTab === 2 && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Security Deposit</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Security Deposit Amount *</span>
                        <input type="text" required value={form.security_deposit_information.deposit_amount} onChange={(e) => update('security_deposit_information', 'deposit_amount', e.target.value)} placeholder="$1,000.00" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Pet Deposit (if any)</span>
                        <input type="text" value={form.security_deposit_information.pet_deposit_amount} onChange={(e) => update('security_deposit_information', 'pet_deposit_amount', e.target.value)} placeholder="$200.00" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Has the deposit been returned?</span>
                        <select value={depositReturned} onChange={(e) => update('security_deposit_information', 'deposit_returned', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm">
                          <option value="no">No — nothing returned</option>
                          <option value="partial">Partial — some returned</option>
                          <option value="yes">Yes — fully returned</option>
                        </select>
                      </label>
                      {(depositReturned === 'partial' || depositReturned === 'yes') && (
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Amount Returned</span>
                          <input type="text" value={form.security_deposit_information.amount_returned} onChange={(e) => update('security_deposit_information', 'amount_returned', e.target.value)} placeholder="$500.00" className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">After Move-out</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Did you provide a forwarding address?</span>
                        <select value={form.move_out_information.forwarding_address_provided} onChange={(e) => update('move_out_information', 'forwarding_address_provided', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm">
                          <option value="unknown">Not sure</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                      {form.move_out_information.forwarding_address_provided === 'yes' && (
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Date Provided (optional)</span>
                          <input type="date" value={form.move_out_information.forwarding_address_date} onChange={(e) => update('move_out_information', 'forwarding_address_date', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                        </label>
                      )}
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Did you receive an itemized list?</span>
                        <select value={form.post_move_out_communications.itemized_deductions_received} onChange={(e) => update('post_move_out_communications', 'itemized_deductions_received', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm">
                          <option value="unknown">No / not sure</option>
                          <option value="yes">Yes</option>
                          <option value="no">Explicitly not received</option>
                        </select>
                      </label>
                      {form.post_move_out_communications.itemized_deductions_received === 'yes' && (
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Date Received (optional)</span>
                          <input type="date" value={form.post_move_out_communications.date_itemized_list_received} onChange={(e) => update('post_move_out_communications', 'date_itemized_list_received', e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm" />
                        </label>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Have you contacted the landlord? (select all that apply)</p>
                      <div className="flex flex-wrap gap-2">
                        {['email', 'text', 'phone', 'certified mail', 'in person'].map((m) => (
                          <button key={m} type="button" onClick={() => toggleComm(m)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${commMethods.includes(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Tab 3: Notes & Submit ─────────────────────────────── */}
              {activeTab === 3 && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Additional Notes</h3>
                    <p className="text-sm text-slate-500">Describe any damage the landlord is claiming, unusual circumstances, or other relevant details.</p>
                    <textarea
                      value={form.additional_notes.tenant_notes}
                      onChange={(e) => update('additional_notes', 'tenant_notes', e.target.value)}
                      rows={4}
                      placeholder="e.g. Landlord claims carpet damage but it was already stained when I moved in. No response to my two emails..."
                      className="w-full rounded-md border border-gray-300 p-3 text-sm"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Acknowledgements</h3>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.acknowledgements.texas_only_confirmation} onChange={(e) => update('acknowledgements', 'texas_only_confirmation', e.target.checked)} className="mt-1 rounded border-gray-300" />
                        <span className="text-sm text-gray-700">I confirm this is for a Texas residential lease.</span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.acknowledgements.non_legal_service_acknowledged} onChange={(e) => update('acknowledgements', 'non_legal_service_acknowledged', e.target.checked)} className="mt-1 rounded border-gray-300" />
                        <span className="text-sm text-gray-700">I acknowledge this is a document preparation and informational service only, not legal advice.</span>
                      </label>
                    </div>
                  </div>
                  <div className="border-l-4 border-slate-200 bg-slate-50 p-4 rounded-xl text-xs text-slate-600">
                    <ul className="space-y-1">{DISCLAIMERS.map((line) => <li key={line}>{line}</li>)}</ul>
                  </div>
                </>
              )}

              {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <div className="flex gap-3">
                {activeTab > 0 && (
                  <button onClick={handleBack} className="flex-1 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded-xl px-6 py-3.5 font-medium transition-colors inline-flex items-center justify-center">
                    Back
                  </button>
                )}
                {activeTab < TABS.length - 1 ? (
                  <button onClick={handleNext} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-3.5 font-bold transition-colors inline-flex items-center justify-center">
                    Continue
                  </button>
                ) : (
                  <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 py-3.5 font-bold transition-colors inline-flex items-center justify-center disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Analyze My Case →'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

export default IntakePage;
