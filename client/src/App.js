import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { DISCLAIMERS } from './disclaimers';

const formatValue = (value) => (value ? value : 'Not provided');
const formatArray = (value) =>
  Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Not provided';

// Home Page Component
function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 text-slate-900">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="absolute top-48 left-8 h-64 w-64 rounded-full bg-amber-100/70 blur-3xl" />
      </div>

      <header className="relative">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">DepositDefender</p>
            <h1 className="font-editorial text-2xl sm:text-3xl text-slate-900">
              Texas Security Deposit Support
            </h1>
          </div>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <a className="hover:text-slate-700" href="#blog">Blog</a>
            <a className="hover:text-slate-700" href="#faq">FAQ</a>
          </nav>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 pb-24">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="space-y-8">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">
              Texas-only document preparation
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl leading-tight text-slate-900">
              A calm, structured way to tell your deposit story.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              We help Texas renters organize facts, timelines, and records into a
              clear, professional summary. The goal is clarity and readiness,
              not pressure or legal strategy.
            </p>
            <button
              onClick={() => navigate('/intake')}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 hover:bg-slate-800"
            >
              Start Your Dispute
            </button>
          </div>

          <div className="space-y-8 text-sm text-slate-600">
            <div className="border-l border-slate-200 pl-6">
              <p className="font-semibold text-slate-900">What this service does</p>
              <p className="mt-3 leading-relaxed">
                Organizes the details you provide and formats them into
                an informational packet designed for clarity and record keeping.
              </p>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="font-semibold text-slate-900">What this service does not do</p>
              <p className="mt-3 leading-relaxed">
                We do not offer legal advice, legal opinions, or legal representation.
                We do not contact landlords or recommend legal actions.
              </p>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="font-semibold text-slate-900">Built for Texas</p>
              <p className="mt-3 leading-relaxed">
                This service is limited to Texas residential leases only.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20 space-y-6">
          <h3 className="font-editorial text-2xl text-slate-900">A thoughtful, simple flow</h3>
          <div className="grid gap-6 md:grid-cols-3 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">1. Share the facts</p>
              <p className="mt-2 leading-relaxed">
                You enter lease dates, deposit details, and communications.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">2. Review the summary</p>
              <p className="mt-2 leading-relaxed">
                We organize the information in a clear, neutral format.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">3. Download</p>
              <p className="mt-2 leading-relaxed">
                Receive an informational PDF for your records.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-white/80 p-6">
          <p className="text-sm font-semibold text-slate-900 mb-3">Important Notice</p>
          <ul className="text-sm text-slate-600 space-y-1">
            {DISCLAIMERS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="relative border-t border-slate-200 bg-white/70">
        <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-slate-500">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">DepositDefender</p>
              <p className="mt-2">Texas document preparation for security deposit records.</p>
            </div>
            <ul className="space-y-1 md:text-right">
              {DISCLAIMERS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Intake Page Component
function IntakePage() {
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitErrors, setSubmitErrors] = useState([]);
  const [caseId, setCaseId] = useState('');
  const [leaseFile, setLeaseFile] = useState(null);
  const [leaseStatus, setLeaseStatus] = useState('');
  const [leaseMessage, setLeaseMessage] = useState('');
  const [leaseSections, setLeaseSections] = useState([]);
  const [leasePreview, setLeasePreview] = useState('');
  const [showLeasePreview, setShowLeasePreview] = useState(false);
  const [intakeMode, setIntakeMode] = useState('manual');
  const [form, setForm] = useState({
    jurisdiction: 'TX',
    tenant_information: {
      full_name: '',
      email: '',
      phone: '',
    },
    property_information: {
      property_address: '',
      city: '',
      zip_code: '',
      county: '',
    },
    lease_information: {
      lease_start_date: '',
      lease_end_date: '',
      lease_type: 'written',
    },
    move_out_information: {
      move_out_date: '',
      forwarding_address_provided: 'unknown',
      forwarding_address_date: '',
    },
    security_deposit_information: {
      deposit_amount: '',
      deposit_paid_date: '',
      deposit_returned: 'no',
      amount_returned: '',
    },
    post_move_out_communications: {
      itemized_deductions_received: 'unknown',
      date_itemized_list_received: '',
      communication_methods_used: [],
    },
    additional_notes: {
      tenant_notes: '',
    },
    acknowledgements: {
      texas_only_confirmation: false,
      non_legal_service_acknowledged: false,
    },
  });

  const toggleCommunicationMethod = (method) => {
    setForm((prev) => {
      const current = prev.post_move_out_communications.communication_methods_used;
      const exists = current.includes(method);
      const next = exists
        ? current.filter((item) => item !== method)
        : [...current, method];
      return {
        ...prev,
        post_move_out_communications: {
          ...prev.post_move_out_communications,
          communication_methods_used: next,
        },
      };
    });
  };

  const normalizeYesNoUnknown = (value) =>
    ['yes', 'no', 'unknown'].includes(value) ? value : 'unknown';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitErrors([]);
    setCaseId('');

    try {
      const payload = {
        ...form,
        move_out_information: {
          ...form.move_out_information,
          forwarding_address_provided: normalizeYesNoUnknown(
            form.move_out_information.forwarding_address_provided
          ),
        },
        post_move_out_communications: {
          ...form.post_move_out_communications,
          itemized_deductions_received: normalizeYesNoUnknown(
            form.post_move_out_communications.itemized_deductions_received
          ),
        },
      };

      const response = await fetch(`${apiBaseUrl}/api/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.message || 'Unable to submit intake right now.');
        setSubmitErrors(Array.isArray(data.errors) ? data.errors : []);
        return;
      }

      setCaseId(data.caseId || '');
      setLeaseFile(null);
      setLeaseStatus('');
      setLeaseMessage('');
      setLeaseSections([]);
      setIntakeMode('manual');
    } catch (error) {
      setSubmitError('Unable to submit intake right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaseUpload = async () => {
    if (!leaseFile) {
      setLeaseStatus('error');
      setLeaseMessage('Please select a lease file before uploading.');
      return;
    }

    setLeaseStatus('uploading');
    setLeaseMessage('');
    setLeaseSections([]);
    setLeasePreview('');
    setShowLeasePreview(false);

    try {
      const formData = new FormData();
      formData.append('lease', leaseFile);

      const endpoint = caseId
        ? `${apiBaseUrl}/api/cases/${caseId}/lease`
        : `${apiBaseUrl}/api/cases/lease-extract`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setLeaseStatus('error');
        setLeaseMessage(data.message || 'Unable to upload lease right now.');
        return;
      }

      setLeaseStatus('ready');
      setLeaseMessage(data.message || '');
      setLeaseSections(Array.isArray(data.sections) ? data.sections : []);
      setLeasePreview(data.preview || '');
    } catch (error) {
      setLeaseStatus('error');
      setLeaseMessage('Unable to upload lease right now.');
    }
  };

  const formatValue = (value) => (value ? value : 'Not provided');
  const formatArray = (value) =>
    Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Not provided';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">DepositDefender</h1>
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            Back to Home
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Texas Intake</h2>
          <p className="text-gray-600 mb-8">
            This intake is for Texas residential leases only. The information you enter is used to
            prepare a non-legal, informational document.
          </p>

          <section className="mb-10">
            <h3 className="text-lg font-semibold text-gray-900">Choose how to begin</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIntakeMode('manual')}
                className={
                  intakeMode === 'manual'
                    ? 'rounded-lg border border-slate-900 bg-slate-900 px-4 py-4 text-left text-white'
                    : 'rounded-lg border border-slate-200 bg-white px-4 py-4 text-left text-slate-700'
                }
              >
                <p className="text-sm font-semibold">Enter information manually</p>
                <p className="mt-2 text-sm text-slate-200/90">
                  Type your lease and deposit details by hand.
                </p>
                {intakeMode === 'manual' ? (
                  <p className="mt-2 text-xs uppercase tracking-wide">Selected</p>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setIntakeMode('upload')}
                className={
                  intakeMode === 'upload'
                    ? 'rounded-lg border border-slate-900 bg-slate-900 px-4 py-4 text-left text-white'
                    : 'rounded-lg border border-slate-200 bg-white px-4 py-4 text-left text-slate-700'
                }
              >
                <p className="text-sm font-semibold">Upload lease to auto-fill information</p>
                <p className="mt-2 text-sm text-slate-200/90">
                  We extract text and suggest values you can edit.
                </p>
                {intakeMode === 'upload' ? (
                  <p className="mt-2 text-xs uppercase tracking-wide">Selected</p>
                ) : null}
              </button>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-8">
            {intakeMode === 'upload' ? (
              <section className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Lease upload (optional)</h3>
                <p className="text-sm text-gray-600">
                  Upload a PDF or image to receive suggested values. You can always switch back to
                  manual entry.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setLeaseFile(event.target.files[0] || null)}
                    className="block w-full text-sm text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={handleLeaseUpload}
                    className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Upload lease
                  </button>
                </div>
                {leaseStatus === 'uploading' ? (
                  <p className="text-sm text-slate-600">Uploading...</p>
                ) : null}
                {leaseMessage ? (
                  <p
                    className={
                      leaseStatus === 'error'
                        ? 'text-sm text-red-600'
                        : 'text-sm text-slate-700'
                    }
                  >
                    {leaseMessage}
                  </p>
                ) : null}
                {leaseSections.length > 0 ? (
                  <div className="space-y-3">
                    {leaseSections.map((section) => (
                      <div key={section.topic} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{section.topic}</p>
                        <p className="mt-2 text-sm text-slate-700">{section.summary}</p>
                        {section.excerpts && section.excerpts.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-sm text-slate-600">
                            {section.excerpts.map((excerpt, index) => (
                              <li key={`${section.topic}-${index}`} className="border-l border-slate-300 pl-3">
                                {excerpt}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {leasePreview ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowLeasePreview((prev) => !prev)}
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {showLeasePreview ? 'Hide extracted text preview' : 'Show extracted text preview'}
                    </button>
                    {showLeasePreview ? (
                      <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{leasePreview}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Tenant Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Full name</span>
                  <input
                    type="text"
                    required
                    value={form.tenant_information.full_name}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tenant_information: {
                          ...prev.tenant_information,
                          full_name: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Email</span>
                  <input
                    type="email"
                    required
                    value={form.tenant_information.email}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tenant_information: {
                          ...prev.tenant_information,
                          email: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                  <input
                    type="tel"
                    value={form.tenant_information.phone}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tenant_information: {
                          ...prev.tenant_information,
                          phone: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Property Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Property address</span>
                  <input
                    type="text"
                    required
                    value={form.property_information.property_address}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        property_information: {
                          ...prev.property_information,
                          property_address: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">City</span>
                  <input
                    type="text"
                    required
                    value={form.property_information.city}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        property_information: {
                          ...prev.property_information,
                          city: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">ZIP code</span>
                  <input
                    type="text"
                    required
                    value={form.property_information.zip_code}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        property_information: {
                          ...prev.property_information,
                          zip_code: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">County</span>
                  <input
                    type="text"
                    required
                    value={form.property_information.county}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        property_information: {
                          ...prev.property_information,
                          county: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Lease Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Lease start date</span>
                  <input
                    type="date"
                    required
                    value={form.lease_information.lease_start_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lease_information: {
                          ...prev.lease_information,
                          lease_start_date: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Lease end date</span>
                  <input
                    type="date"
                    required
                    value={form.lease_information.lease_end_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lease_information: {
                          ...prev.lease_information,
                          lease_end_date: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Lease type</span>
                  <select
                    value={form.lease_information.lease_type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lease_information: {
                          ...prev.lease_information,
                          lease_type: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="written">Written</option>
                    <option value="oral">Oral</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Move-Out Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Move-out date</span>
                  <input
                    type="date"
                    required
                    value={form.move_out_information.move_out_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        move_out_information: {
                          ...prev.move_out_information,
                          move_out_date: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Forwarding address provided?
                  </span>
                  <select
                    value={form.move_out_information.forwarding_address_provided}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        move_out_information: {
                          ...prev.move_out_information,
                          forwarding_address_provided: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Forwarding address date (optional)
                  </span>
                  <input
                    type="date"
                    value={form.move_out_information.forwarding_address_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        move_out_information: {
                          ...prev.move_out_information,
                          forwarding_address_date: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Security Deposit</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Deposit amount</span>
                  <input
                    type="text"
                    required
                    value={form.security_deposit_information.deposit_amount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        security_deposit_information: {
                          ...prev.security_deposit_information,
                          deposit_amount: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Deposit paid date (optional)</span>
                  <input
                    type="date"
                    value={form.security_deposit_information.deposit_paid_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        security_deposit_information: {
                          ...prev.security_deposit_information,
                          deposit_paid_date: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Deposit returned?</span>
                  <select
                    value={form.security_deposit_information.deposit_returned}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        security_deposit_information: {
                          ...prev.security_deposit_information,
                          deposit_returned: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="no">No</option>
                    <option value="partial">Partial</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Amount returned (optional)</span>
                  <input
                    type="text"
                    value={form.security_deposit_information.amount_returned}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        security_deposit_information: {
                          ...prev.security_deposit_information,
                          amount_returned: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Post Move-Out Communication</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Itemized deductions received?
                  </span>
                  <select
                    value={form.post_move_out_communications.itemized_deductions_received}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        post_move_out_communications: {
                          ...prev.post_move_out_communications,
                          itemized_deductions_received: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Date itemized list received (optional)
                  </span>
                  <input
                    type="date"
                    value={form.post_move_out_communications.date_itemized_list_received}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        post_move_out_communications: {
                          ...prev.post_move_out_communications,
                          date_itemized_list_received: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Communication methods used</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {['email', 'mail', 'text', 'other'].map((method) => (
                    <label key={method} className="flex items-center space-x-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.post_move_out_communications.communication_methods_used.includes(method)}
                        onChange={() => toggleCommunicationMethod(method)}
                        className="rounded border-gray-300"
                      />
                      <span className="capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Additional Notes</h3>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tenant notes (optional)</span>
                <textarea
                  value={form.additional_notes.tenant_notes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      additional_notes: {
                        ...prev.additional_notes,
                        tenant_notes: event.target.value,
                      },
                    }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Acknowledgements</h3>
              <label className="flex items-start space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  required
                  checked={form.acknowledgements.texas_only_confirmation}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      acknowledgements: {
                        ...prev.acknowledgements,
                        texas_only_confirmation: event.target.checked,
                      },
                    }))
                  }
                  className="mt-1 rounded border-gray-300"
                />
                <span>I confirm this intake is for a Texas residential lease.</span>
              </label>
              <label className="flex items-start space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  required
                  checked={form.acknowledgements.non_legal_service_acknowledged}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      acknowledgements: {
                        ...prev.acknowledgements,
                        non_legal_service_acknowledged: event.target.checked,
                      },
                    }))
                  }
                  className="mt-1 rounded border-gray-300"
                />
                <span>I acknowledge this is a document preparation and informational service only.</span>
              </label>
            </section>

            {submitError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {submitError}
                {submitErrors.length > 0 ? (
                  <ul className="mt-2 list-disc list-inside">
                    {submitErrors.map((error) => (
                      <li key={`${error.path}-${error.message}`}>
                        {error.path}: {error.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {caseId ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <p>Intake received. Case ID: {caseId}</p>
                <a
                  href={`/download/${caseId}`}
                  className="mt-2 inline-block text-blue-700 underline"
                >
                  Open download page
                </a>
              </div>
            ) : null}


            <button
              type="submit"
              disabled={isSubmitting || Boolean(caseId)}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : caseId ? 'Intake Submitted' : 'Submit Intake'}
            </button>
          </form>
        </div>

        <div className="mt-10 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-gray-700">
          <ul className="space-y-1">
            {DISCLAIMERS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

// Download Page Component
function DownloadPage() {
  const { caseId } = useParams();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('loading');
  const [downloaded, setDownloaded] = useState(false);
  const [caseData, setCaseData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    fetch(`${apiBaseUrl}/api/cases/${caseId}`)
      .then((response) => {
        if (!isMounted) return;
        if (!response.ok) {
          setStatus('not_found');
          return;
        }
        return response.json();
      })
      .then((payload) => {
        if (!isMounted || !payload || payload.status !== 'ok') return;
        setCaseData(payload.case || null);
        setStatus('ready');
      })
      .catch(() => {
        if (isMounted) {
          setStatus('error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, caseId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">DepositDefender</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Download</h2>
          <p className="text-gray-600 mb-6">Case ID: {caseId}</p>

          {status === 'loading' ? (
            <p className="text-gray-600">Checking your case...</p>
          ) : null}

          {status === 'not_found' ? (
            <p className="text-red-600">Case not found. Please verify the link.</p>
          ) : null}

          {status === 'error' ? (
            <p className="text-red-600">Unable to load this case right now.</p>
          ) : null}

          {status === 'ready' ? (
            <div className="space-y-3">
              {caseData ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <h3 className="text-base font-semibold text-slate-900 mb-3">Review</h3>
                  <ul className="space-y-2">
                    <li>Tenant name: {formatValue(caseData.intake.tenant_information.full_name)}</li>
                    <li>Tenant email: {formatValue(caseData.intake.tenant_information.email)}</li>
                    <li>
                      Property address:{' '}
                      {formatValue(caseData.intake.property_information.property_address)}
                    </li>
                    <li>City: {formatValue(caseData.intake.property_information.city)}</li>
                    <li>ZIP code: {formatValue(caseData.intake.property_information.zip_code)}</li>
                    <li>County: {formatValue(caseData.intake.property_information.county)}</li>
                    <li>
                      Lease start date:{' '}
                      {formatValue(caseData.intake.lease_information.lease_start_date)}
                    </li>
                    <li>
                      Lease end date:{' '}
                      {formatValue(caseData.intake.lease_information.lease_end_date)}
                    </li>
                    <li>
                      Lease type:{' '}
                      {formatValue(caseData.intake.lease_information.lease_type)}
                    </li>
                    <li>
                      Move-out date:{' '}
                      {formatValue(caseData.intake.move_out_information.move_out_date)}
                    </li>
                    <li>
                      Forwarding address provided:{' '}
                      {formatValue(
                        caseData.intake.move_out_information.forwarding_address_provided
                      )}
                    </li>
                    <li>
                      Forwarding address date:{' '}
                      {formatValue(caseData.intake.move_out_information.forwarding_address_date)}
                    </li>
                    <li>
                      Deposit amount:{' '}
                      {formatValue(
                        caseData.intake.security_deposit_information.deposit_amount
                      )}
                    </li>
                    <li>
                      Deposit paid date:{' '}
                      {formatValue(
                        caseData.intake.security_deposit_information.deposit_paid_date
                      )}
                    </li>
                    <li>
                      Deposit returned:{' '}
                      {formatValue(
                        caseData.intake.security_deposit_information.deposit_returned
                      )}
                    </li>
                    <li>
                      Amount returned:{' '}
                      {formatValue(
                        caseData.intake.security_deposit_information.amount_returned
                      )}
                    </li>
                    <li>
                      Itemized deductions received:{' '}
                      {formatValue(
                        caseData.intake.post_move_out_communications.itemized_deductions_received
                      )}
                    </li>
                    <li>
                      Date itemized list received:{' '}
                      {formatValue(
                        caseData.intake.post_move_out_communications.date_itemized_list_received
                      )}
                    </li>
                    <li>
                      Communication methods:{' '}
                      {formatArray(
                        caseData.intake.post_move_out_communications.communication_methods_used
                      )}
                    </li>
                  </ul>
                </div>
              ) : null}
              <a
                href={`${apiBaseUrl}/api/documents/${caseId}`}
                onClick={() => setDownloaded(true)}
                className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700"
              >
                Download informational PDF
              </a>
              {downloaded ? (
                <p className="text-sm text-green-700">
                  Download started. Check your downloads folder.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-gray-700">
          <ul className="space-y-1">
            {DISCLAIMERS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/download/:caseId" element={<DownloadPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
