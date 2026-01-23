import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { DISCLAIMERS } from './disclaimers';
import heroImage from './assets/hero-deposit.png';

const formatValue = (value) => (value ? value : 'Not provided');
const formatArray = (value) =>
  Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Not provided';

// Home Page Component
function Home() {
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1 className="brand-large cursor-pointer" onClick={() => navigate('/')}>DepositDefender</h1>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/blog" className="nav-link">Blog</a>
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/how-it-works" className="nav-link">How It Works</a>
          </nav>
        </div>
      </header>

      <main className="container pb-20">
        <section className="hero">
          <div className="hero-content">
            <p className="accent-chip">Texas renters only</p>
            <h2 className="hero-title">
              Worried you're getting screwed on your security deposit?
            </h2>
            <p className="hero-subtitle">
              We organize the facts, timelines, and documents into a clear,
              professional summary you can use right away.
            </p>
            <button
              onClick={() => navigate('/intake')}
              className="cta-primary"
            >
              Start Your Defense
            </button>
          </div>
          <div className="hero-image" style={{ backgroundImage: `url(${heroImage})` }}></div>
        </section>

        <section className="card-grid mb-16">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900">Clarity without the chaos</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              We turn scattered lease notes into an easy-to-read record
              that keeps the focus on the facts.
            </p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900">Built for Texas renters</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Tailored to Texas residential leases with practical prompts
              that keep you on track.
            </p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900">Effective and Legal</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              We keep the language plain and neutral so you can
              decide what to do next.
            </p>
          </div>
        </section>

        <section className="text-center mb-16">
          <button
            onClick={() => setShowTerms(!showTerms)}
            className="btn-outline text-sm"
          >
            Terms and Conditions
          </button>
          {showTerms && (
            <div className="mt-6 notice-card text-left">
              <ul className="text-sm text-slate-700 space-y-1">
                {DISCLAIMERS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="container text-sm text-slate-500">
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
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());
  const [form, setForm] = useState({
    jurisdiction: 'TX',
    tenant_information: {
      full_name: '',
      email: '',
      phone: '',
    },
    landlord_information: {
      landlord_name: '',
      landlord_address: '',
      landlord_city: '',
      landlord_state: 'TX',
      landlord_zip: '',
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
    setSubmitError('');
    setSubmitErrors([]);

    // Validate dates before submission
    const startDate = form.lease_information.lease_start_date;
    const endDate = form.lease_information.lease_end_date;
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      setSubmitError('Lease start date must be before lease end date.');
      return;
    }

    setIsSubmitting(true);
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

    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (leaseFile.size > maxFileSize) {
      setLeaseStatus('error');
      setLeaseMessage('File size exceeds 10MB. Please upload a smaller file or compress your PDF.');
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

      // Auto-fill form fields from extracted data
      if (data.extractedData && Object.keys(data.extractedData).length > 0) {
        const extracted = data.extractedData;
        const filledFields = new Set();

        setForm((prev) => {
          const updated = { ...prev };

          if (extracted.tenant_name && !prev.tenant_information.full_name) {
            updated.tenant_information = {
              ...prev.tenant_information,
              full_name: extracted.tenant_name,
            };
            filledFields.add('tenant_information.full_name');
          }

          if (extracted.property_address && !prev.property_information.property_address) {
            updated.property_information = {
              ...prev.property_information,
              property_address: extracted.property_address,
            };
            filledFields.add('property_information.property_address');
          }

          if (extracted.city && !prev.property_information.city) {
            updated.property_information = {
              ...updated.property_information,
              city: extracted.city,
            };
            filledFields.add('property_information.city');
          }

          if (extracted.zip_code && !prev.property_information.zip_code) {
            updated.property_information = {
              ...updated.property_information,
              zip_code: extracted.zip_code,
            };
            filledFields.add('property_information.zip_code');
          }

          if (extracted.lease_start_date && !prev.lease_information.lease_start_date) {
            updated.lease_information = {
              ...prev.lease_information,
              lease_start_date: extracted.lease_start_date,
            };
            filledFields.add('lease_information.lease_start_date');
          }

          if (extracted.lease_end_date && !prev.lease_information.lease_end_date) {
            updated.lease_information = {
              ...updated.lease_information,
              lease_end_date: extracted.lease_end_date,
            };
            filledFields.add('lease_information.lease_end_date');
          }

          if (extracted.deposit_amount && !prev.security_deposit_information.deposit_amount) {
            updated.security_deposit_information = {
              ...prev.security_deposit_information,
              deposit_amount: extracted.deposit_amount,
            };
            filledFields.add('security_deposit_information.deposit_amount');
          }

          return updated;
        });

        setAutoFilledFields(filledFields);
      }
    } catch (error) {
      setLeaseStatus('error');
      setLeaseMessage('Unable to upload lease right now.');
    }
  };

  const formatValue = (value) => (value ? value : 'Not provided');
  const formatArray = (value) =>
    Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Not provided';
  const visibleLeaseSections = leaseSections.filter(
    (section) => section.topic === 'Security deposit'
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container flex items-center justify-between">
          <h1 className="brand">DepositDefender</h1>
          <button
            onClick={() => navigate('/')}
            className="btn-outline text-sm"
          >
            Back to Home
          </button>
        </div>
      </header>

      <main className="container py-12">
        <div className="form-card">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Texas Intake</h2>
          <p className="text-slate-600 mb-8">
            This intake is for Texas residential leases only. The information you enter is used to
            prepare a non-legal, informational document.
          </p>

          <section className="mb-10">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Choose how to begin</h3>

            {/* Upload Lease - Primary Option */}
            <div className="mb-6">
              <div className="card p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Upload your lease</h4>
                <p className="text-sm text-gray-600 mb-4">
                  PDF or image. Maximum file size: 10MB.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => {
                      setLeaseFile(event.target.files[0] || null);
                      if (event.target.files[0]) {
                        setIntakeMode('upload');
                      }
                    }}
                    className="block w-full text-sm text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={handleLeaseUpload}
                    disabled={!leaseFile}
                    className="cta-primary text-sm px-8"
                  >
                    Upload lease
                  </button>
                </div>
                {leaseStatus === 'uploading' ? (
                  <p className="text-sm text-slate-600 mt-3">Uploading...</p>
                ) : null}
                {leaseMessage ? (
                  <p
                    className={
                      leaseStatus === 'error'
                        ? 'text-sm text-red-600 mt-3'
                        : 'text-sm text-slate-700 mt-3'
                    }
                  >
                    {leaseMessage}
                  </p>
                ) : null}
                {visibleLeaseSections.length > 0 ? (
                  <div className="space-y-3 mt-4">
                    {visibleLeaseSections.map((section) => (
                      <div key={section.topic} className="bg-slate-50 rounded-lg p-4">
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
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowLeasePreview((prev) => !prev)}
                      className="btn-outline text-xs uppercase tracking-wide"
                    >
                      {showLeasePreview ? 'Hide extracted text preview' : 'Show extracted text preview'}
                    </button>
                    {showLeasePreview ? (
                      <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 p-3 rounded">{leasePreview}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Manual Entry - Secondary Option */}
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-3">or</p>
              <button
                type="button"
                onClick={() => setIntakeMode('manual')}
                className={`btn-outline text-sm px-6 py-3 ${intakeMode === 'manual' ? 'bg-slate-100 border-slate-400' : ''}`}
              >
                Enter information manually
              </button>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-8">
            {(intakeMode === 'manual' || leaseStatus === 'ready') ? (
              <>
              <section className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Tenant Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Full name
                    {autoFilledFields.has('tenant_information.full_name') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled from lease)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('tenant_information.full_name') ? 'bg-green-50' : ''
                    }`}
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
                  <span className="text-sm font-medium text-gray-700">
                    Property address
                    {autoFilledFields.has('property_information.property_address') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled from lease)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('property_information.property_address') ? 'bg-green-50' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    City
                    {autoFilledFields.has('property_information.city') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('property_information.city') ? 'bg-green-50' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    ZIP code
                    {autoFilledFields.has('property_information.zip_code') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('property_information.zip_code') ? 'bg-green-50' : ''
                    }`}
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
              <h3 className="text-xl font-semibold text-gray-900">Landlord / Property Manager Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Landlord or property manager name</span>
                  <input
                    type="text"
                    required
                    value={form.landlord_information.landlord_name}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        landlord_information: {
                          ...prev.landlord_information,
                          landlord_name: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Landlord address</span>
                  <input
                    type="text"
                    required
                    value={form.landlord_information.landlord_address}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        landlord_information: {
                          ...prev.landlord_information,
                          landlord_address: event.target.value,
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
                    value={form.landlord_information.landlord_city}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        landlord_information: {
                          ...prev.landlord_information,
                          landlord_city: event.target.value,
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
                    value={form.landlord_information.landlord_zip}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        landlord_information: {
                          ...prev.landlord_information,
                          landlord_zip: event.target.value,
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
                  <span className="text-sm font-medium text-gray-700">
                    Lease start date
                    {autoFilledFields.has('lease_information.lease_start_date') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('lease_information.lease_start_date') ? 'bg-green-50' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Lease end date
                    {autoFilledFields.has('lease_information.lease_end_date') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('lease_information.lease_end_date') ? 'bg-green-50' : ''
                    }`}
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
              {form.lease_information.lease_start_date &&
                form.lease_information.lease_end_date &&
                new Date(form.lease_information.lease_start_date) >= new Date(form.lease_information.lease_end_date) && (
                  <p className="text-sm text-red-600 mt-2">
                    Lease start date must be before lease end date.
                  </p>
                )}
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
                  <span className="text-sm font-medium text-gray-700">
                    Deposit amount
                    {autoFilledFields.has('security_deposit_information.deposit_amount') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled from lease)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('security_deposit_information.deposit_amount') ? 'bg-green-50' : ''
                    }`}
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
                  className="mt-3 inline-flex btn-outline text-sm"
                >
                  Open download page
                </a>
              </div>
            ) : null}

              </>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || Boolean(caseId) || (intakeMode !== 'manual' && leaseStatus !== 'ready')}
              className="btn-accent w-full text-lg disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : caseId ? 'Intake Submitted' : 'Submit Intake'}
            </button>
          </form>
        </div>

        <div className="mt-10 notice-card text-sm">
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
    <div className="app-shell">
      <header className="site-header">
        <div className="container flex items-center justify-between">
          <h1 className="brand">DepositDefender</h1>
        </div>
      </header>

      <main className="container py-12">
        <div className="form-card">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Download</h2>
          <p className="text-slate-600 mb-6">Case ID: {caseId}</p>

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
                <div className="card text-sm text-slate-700">
                  <h3 className="text-base font-semibold text-slate-900 mb-3">Review</h3>
                  <ul className="space-y-2">
                    <li>Tenant name: {formatValue(caseData.intake.tenant_information.full_name)}</li>
                    <li>Tenant email: {formatValue(caseData.intake.tenant_information.email)}</li>
                    <li>
                      Landlord/Manager:{' '}
                      {formatValue(caseData.intake.landlord_information?.landlord_name)}
                    </li>
                    <li>
                      Landlord address:{' '}
                      {formatValue(caseData.intake.landlord_information?.landlord_address)}
                      {caseData.intake.landlord_information?.landlord_city && (
                        <>, {caseData.intake.landlord_information.landlord_city}</>
                      )}
                      {caseData.intake.landlord_information?.landlord_state && (
                        <>, {caseData.intake.landlord_information.landlord_state}</>
                      )}
                      {caseData.intake.landlord_information?.landlord_zip && (
                        <> {caseData.intake.landlord_information.landlord_zip}</>
                      )}
                    </li>
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
                className="btn-accent"
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

        <div className="mt-8 notice-card text-sm">
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

// How It Works Page Component
function HowItWorksPage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1 className="brand-large cursor-pointer" onClick={() => navigate('/')}>DepositDefender</h1>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/blog" className="nav-link">Blog</a>
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/how-it-works" className="nav-link">How It Works</a>
          </nav>
        </div>
      </header>

      <main className="container pb-20">
        <section className="space-y-6 mb-16">
          <h2 className="section-title">How It Works</h2>
          <div className="card-grid md:grid-cols-3">
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">1. Share the facts</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Enter lease dates, deposit details, and what you received. You can upload your lease
                document and we'll extract key information automatically.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">2. Review the summary</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                We organize everything into a clean, neutral record. Check the details are correct
                and make any adjustments needed.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">3. Receive your custom guide</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Download a professional summary tailored to your situation. Use it for your records
                or as a reference when communicating with your landlord.
              </p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <button onClick={() => navigate('/intake')} className="cta-primary">
            Get Started
          </button>
        </section>
      </main>

      <footer className="footer">
        <div className="container text-sm text-slate-500">
          &copy; {new Date().getFullYear()} DepositDefender &middot; Texas Security Deposit Support
        </div>
      </footer>
    </div>
  );
}

// Blog Page Component
function BlogPage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1 className="brand-large cursor-pointer" onClick={() => navigate('/')}>DepositDefender</h1>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/blog" className="nav-link">Blog</a>
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/how-it-works" className="nav-link">How It Works</a>
          </nav>
        </div>
      </header>

      <main className="container pb-20">
        <section className="space-y-6 mb-16">
          <h2 className="section-title">Blog</h2>
          <div className="card-grid md:grid-cols-2">
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">Know your deposit timeline</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Understand what to track and how to keep clean records. Texas law gives landlords
                30 days to return your deposit or provide an itemized list of deductions. Knowing
                this timeline helps you stay informed about your rights.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">Document the basics first</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                A short checklist for deposits, photos, and communications. Take photos when you
                move in and move out. Keep copies of all written communications with your landlord.
                Save receipts for any repairs or cleaning you paid for.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 text-center mt-8">
            More articles coming soon.
          </p>
        </section>
      </main>

      <footer className="footer">
        <div className="container text-sm text-slate-500">
          &copy; {new Date().getFullYear()} DepositDefender &middot; Texas Security Deposit Support
        </div>
      </footer>
    </div>
  );
}

// FAQ Page Component
function FAQPage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1 className="brand-large cursor-pointer" onClick={() => navigate('/')}>DepositDefender</h1>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/blog" className="nav-link">Blog</a>
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/how-it-works" className="nav-link">How It Works</a>
          </nav>
        </div>
      </header>

      <main className="container pb-20">
        <section className="space-y-6 mb-16">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="card-grid md:grid-cols-1 max-w-2xl mx-auto">
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">Is this legal advice?</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                No. DepositDefender provides document preparation and informational support only.
                We help you organize facts and create clear records, but we do not provide legal
                advice, legal opinions, or legal representation. For legal advice, please consult
                a licensed attorney.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">Can I edit the summary?</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Yes, you can review and adjust all information before downloading your document.
                We auto-fill what we can from your lease upload, but you have full control to
                correct or update any field.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">Is this service only for Texas?</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Yes. Currently DepositDefender is designed specifically for Texas residential
                leases. Security deposit laws vary by state, so we focus on Texas to provide
                accurate, relevant information.
              </p>
            </div>
            <div className="card">
              <p className="text-lg font-semibold text-slate-900">How much does it cost?</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Pricing information coming soon. Our goal is to make this service accessible
                to all Texas renters who need help organizing their security deposit documentation.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container text-sm text-slate-500">
          &copy; {new Date().getFullYear()} DepositDefender &middot; Texas Security Deposit Support
        </div>
      </footer>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/download/:caseId" element={<DownloadPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/faq" element={<FAQPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
