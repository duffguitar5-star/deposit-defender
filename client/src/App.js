import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { DISCLAIMERS } from './disclaimers';
import heroImage from './assets/hero-deposit.png';

const formatValue = (value) => (value ? value : 'Not provided');
const formatArray = (value) =>
  Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Not provided';

const navLinks = (
  <>
    <a href="/blog" className="nav-link">Blog</a>
    <a href="/faq" className="nav-link">FAQ</a>
    <a href="/how-it-works" className="nav-link">How It Works</a>
  </>
);

function HeroSection({ variant = 'home', showCta = true }) {
  const navigate = useNavigate();
  const isCompact = variant === 'compact';

  return (
    <section className={`hero${isCompact ? ' hero-compact' : ''}`}>
      <div className="hero-content">
        <p className="accent-chip">Texas renters only</p>
        <h2 className="hero-title">
          Worried you're getting screwed on your security deposit?
        </h2>
        <p className="hero-subtitle">
          We organize the facts, timelines, and documents into a clear,
          professional summary you can use right away.
        </p>
        {showCta ? (
          <button
            onClick={() => navigate('/intake')}
            className="cta-primary"
          >
            Start Your Defense
          </button>
        ) : null}
      </div>
      <div className="hero-image" style={{ backgroundImage: `url(${heroImage})` }}></div>
    </section>
  );
}

function AppLayout({ heroVariant = 'compact', showHeroCta = false, showHero = false, children }) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <div className="flex items-center justify-between mb-4">
            <h1 className="brand-large cursor-pointer" onClick={() => navigate('/')}>DepositDefender</h1>
          </div>
          <nav className="flex gap-6 text-sm">
            {navLinks}
          </nav>
        </div>
      </header>

      {showHero ? (
        <div className="container">
          <HeroSection variant={heroVariant} showCta={showHeroCta} />
        </div>
      ) : null}

      {children}
    </div>
  );
}

// Home Page Component
function Home() {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <AppLayout heroVariant="home" showHeroCta showHero>
      <main className="container pb-20">
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
    </AppLayout>
  );
}

// Step 1: Lease Upload Page
function LeaseUploadPage() {
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [leaseFile, setLeaseFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleUpload = async () => {
    if (!leaseFile) {
      setError('Please select a lease file.');
      return;
    }

    const maxFileSize = 10 * 1024 * 1024;
    if (leaseFile.size > maxFileSize) {
      setError('File size exceeds 10MB. Please upload a smaller file.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('lease', leaseFile);

      const response = await fetch(`${apiBaseUrl}/api/cases/lease-extract`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to process lease.');
        setIsUploading(false);
        return;
      }

      // Store extracted data in localStorage for next steps
      const extractedData = {
        ...(data.extractedData || {}),
        leaseText: data.preview || '',
      };
      localStorage.setItem('depositDefender_extractedData', JSON.stringify(extractedData));

      navigate('/intake/info');
    } catch (err) {
      setError('Unable to upload lease. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        <section className="text-center py-12 mb-8">
          <div className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
            Step 1 of 3
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Upload Your Lease
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            We'll extract the key information from your lease automatically.
          </p>
        </section>

        <section className="max-w-xl mx-auto">
          <div className="card">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="lease-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setLeaseFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="lease-upload" className="cursor-pointer">
                  <div className="text-4xl mb-4">📄</div>
                  <p className="text-slate-700 font-medium mb-2">
                    {leaseFile ? leaseFile.name : 'Click to select your lease'}
                  </p>
                  <p className="text-sm text-slate-500">PDF or image (max 10MB)</p>
                </label>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!leaseFile || isUploading}
                className="cta-primary w-full disabled:opacity-50"
              >
                {isUploading ? 'Processing...' : 'Upload & Continue'}
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    localStorage.setItem('depositDefender_extractedData', JSON.stringify({}));
                    navigate('/intake/info');
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Skip — I'll enter information manually
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}

// Step 2: Basic Info Page (Name & Email)
function BasicInfoPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    // Check if we have extracted data
    const stored = localStorage.getItem('depositDefender_extractedData');
    if (!stored) {
      navigate('/intake');
    }
  }, [navigate]);

  const handleContinue = () => {
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    // Update stored data with name and email
    const stored = JSON.parse(localStorage.getItem('depositDefender_extractedData') || '{}');
    stored.tenant_name = fullName.trim();
    stored.tenant_email = email.trim();
    localStorage.setItem('depositDefender_extractedData', JSON.stringify(stored));

    navigate('/intake/verify');
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        <section className="text-center py-12 mb-8">
          <div className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
            Step 2 of 3
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Enter Your Information
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            We need your name and email to prepare your document.
          </p>
        </section>

        <section className="max-w-xl mx-auto">
          <div className="card">
            <div className="space-y-6">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Full Name</span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-lg p-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Email Address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm text-lg p-3"
                />
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleContinue}
                className="cta-primary w-full"
              >
                Continue
              </button>

              <button
                onClick={() => navigate('/intake')}
                className="btn-outline w-full"
              >
                Back
              </button>
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}

// Step 3: Verification Page (All extracted data)
function VerificationPage() {
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    tenant_information: { full_name: '', email: '', phone: '' },
    landlord_information: { landlord_name: '', landlord_address: '', landlord_city: '', landlord_state: 'TX', landlord_zip: '', landlord_phone: '' },
    property_information: { property_address: '', city: '', zip_code: '', county: '' },
    lease_information: { lease_start_date: '', lease_end_date: '', lease_type: 'written' },
    move_out_information: { move_out_date: '', forwarding_address_provided: 'unknown', forwarding_address_date: '' },
    security_deposit_information: { deposit_amount: '', deposit_paid_date: '', deposit_returned: 'no', amount_returned: '' },
    post_move_out_communications: { itemized_deductions_received: 'unknown', date_itemized_list_received: '', communication_methods_used: [] },
    additional_notes: { tenant_notes: '' },
    acknowledgements: { texas_only_confirmation: false, non_legal_service_acknowledged: false },
    jurisdiction: 'TX',
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const stored = localStorage.getItem('depositDefender_extractedData');
    if (!stored) {
      navigate('/intake');
      return;
    }

    const extracted = JSON.parse(stored);

    // Map extracted data to form - validate extractions before using
    const isValidAddress = (addr) => addr && addr.length > 5 && /^\d+\s+[A-Za-z]/.test(addr) && !/sq\s*ft|bedr|bath/i.test(addr);
    const isValidName = (name) => name && name.length >= 3 && !/^(property|lease|tenant|agreement|the|this)$/i.test(name.trim());
    const isValidDate = (date) => date && /^\d{4}-\d{2}-\d{2}$/.test(date);

    setForm(prev => ({
      ...prev,
      tenant_information: {
        ...prev.tenant_information,
        full_name: extracted.tenant_name || '',
        email: extracted.tenant_email || '',
      },
      landlord_information: {
        ...prev.landlord_information,
        landlord_name: isValidName(extracted.landlord_name) ? extracted.landlord_name : '',
        landlord_address: isValidAddress(extracted.landlord_address) ? extracted.landlord_address : '',
        landlord_city: extracted.landlord_city || '',
        landlord_state: extracted.landlord_state || 'TX',
        landlord_zip: extracted.landlord_zip || '',
        landlord_phone: extracted.landlord_phone || '',
      },
      property_information: {
        ...prev.property_information,
        property_address: isValidAddress(extracted.property_address) ? extracted.property_address : '',
        city: extracted.city || '',
        zip_code: extracted.zip_code || '',
        county: extracted.county || '',
      },
      lease_information: {
        ...prev.lease_information,
        lease_start_date: isValidDate(extracted.lease_start_date) ? extracted.lease_start_date : '',
        lease_end_date: isValidDate(extracted.lease_end_date) ? extracted.lease_end_date : '',
      },
      security_deposit_information: {
        ...prev.security_deposit_information,
        deposit_amount: extracted.deposit_amount || '',
      },
    }));
  }, [navigate]);

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.tenant_information.full_name || !form.tenant_information.email) {
      setError('Name and email are required.');
      return;
    }
    if (!form.acknowledgements.texas_only_confirmation || !form.acknowledgements.non_legal_service_acknowledged) {
      setError('Please confirm the acknowledgements.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to submit.');
        setIsSubmitting(false);
        return;
      }

      // Clear stored data
      localStorage.removeItem('depositDefender_extractedData');

      // Navigate to review page
      if (data.caseId) {
        navigate(`/review/${data.caseId}`);
      }
    } catch (err) {
      setError('Unable to submit. Please try again.');
      setIsSubmitting(false);
    }
  };

  const updateField = (section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        <section className="text-center py-8 mb-4">
          <div className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
            Step 3 of 3
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Verify Your Information
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Review and edit the information extracted from your lease.
          </p>
        </section>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Tenant Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Tenant Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Full Name *</span>
                <input type="text" required value={form.tenant_information.full_name}
                  onChange={(e) => updateField('tenant_information', 'full_name', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Email *</span>
                <input type="email" required value={form.tenant_information.email}
                  onChange={(e) => updateField('tenant_information', 'email', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                <input type="tel" value={form.tenant_information.phone}
                  onChange={(e) => updateField('tenant_information', 'phone', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
            </div>
          </div>

          {/* Property Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Property Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Property Address *</span>
                <input type="text" required value={form.property_information.property_address}
                  onChange={(e) => updateField('property_information', 'property_address', e.target.value)}
                  placeholder="Enter property address"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">City *</span>
                <input type="text" required value={form.property_information.city}
                  onChange={(e) => updateField('property_information', 'city', e.target.value)}
                  placeholder="Enter city"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ZIP Code *</span>
                <input type="text" required value={form.property_information.zip_code}
                  onChange={(e) => updateField('property_information', 'zip_code', e.target.value)}
                  placeholder="Enter ZIP"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">County *</span>
                <input type="text" required value={form.property_information.county}
                  onChange={(e) => updateField('property_information', 'county', e.target.value)}
                  placeholder="Not in lease - enter manually"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
            </div>
          </div>

          {/* Landlord Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Landlord / Property Manager</h3>
            {(!form.landlord_information.landlord_name || !form.landlord_information.landlord_address) && (
              <p className="text-sm text-amber-600 mb-4">⚠️ Landlord info not found in lease - please enter manually</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Name *</span>
                <input type="text" required value={form.landlord_information.landlord_name}
                  onChange={(e) => updateField('landlord_information', 'landlord_name', e.target.value)}
                  placeholder="Not found - enter manually"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Address *</span>
                <input type="text" required value={form.landlord_information.landlord_address}
                  onChange={(e) => updateField('landlord_information', 'landlord_address', e.target.value)}
                  placeholder="Not found - enter manually"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">City *</span>
                <input type="text" required value={form.landlord_information.landlord_city}
                  onChange={(e) => updateField('landlord_information', 'landlord_city', e.target.value)}
                  placeholder="Not found - enter manually"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ZIP Code *</span>
                <input type="text" required value={form.landlord_information.landlord_zip}
                  onChange={(e) => updateField('landlord_information', 'landlord_zip', e.target.value)}
                  placeholder="Not found - enter manually"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                <input type="tel" value={form.landlord_information.landlord_phone}
                  onChange={(e) => updateField('landlord_information', 'landlord_phone', e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-400 placeholder:italic" />
              </label>
            </div>
          </div>

          {/* Lease Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lease Information</h3>
            {(!form.lease_information.lease_start_date || !form.lease_information.lease_end_date) && (
              <p className="text-sm text-amber-600 mb-4">⚠️ Dates not found in lease - please enter manually</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Lease Start Date *</span>
                <input type="date" required value={form.lease_information.lease_start_date}
                  onChange={(e) => updateField('lease_information', 'lease_start_date', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Lease End Date *</span>
                <input type="date" required value={form.lease_information.lease_end_date}
                  onChange={(e) => updateField('lease_information', 'lease_end_date', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Lease Type</span>
                <select value={form.lease_information.lease_type}
                  onChange={(e) => updateField('lease_information', 'lease_type', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm">
                  <option value="written">Written</option>
                  <option value="oral">Oral</option>
                  <option value="month-to-month">Month-to-Month</option>
                </select>
              </label>
            </div>
          </div>

          {/* Move-Out & Deposit */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Move-Out & Security Deposit</h3>
            {!form.move_out_information.move_out_date && (
              <p className="text-sm text-amber-600 mb-4">⚠️ Move-out date not in lease - please enter manually</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Move-Out Date *</span>
                <input type="date" required value={form.move_out_information.move_out_date}
                  onChange={(e) => updateField('move_out_information', 'move_out_date', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Security Deposit Amount *</span>
                <input type="text" required value={form.security_deposit_information.deposit_amount}
                  onChange={(e) => updateField('security_deposit_information', 'deposit_amount', e.target.value)}
                  placeholder="$1,000.00"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Forwarding Address Provided?</span>
                <select value={form.move_out_information.forwarding_address_provided}
                  onChange={(e) => updateField('move_out_information', 'forwarding_address_provided', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm">
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Deposit Returned?</span>
                <select value={form.security_deposit_information.deposit_returned}
                  onChange={(e) => updateField('security_deposit_information', 'deposit_returned', e.target.value)}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="partial">Partial</option>
                </select>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Notes (optional)</h3>
            <textarea
              value={form.additional_notes.tenant_notes}
              onChange={(e) => updateField('additional_notes', 'tenant_notes', e.target.value)}
              rows={3}
              placeholder="Any additional information about your situation..."
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          {/* Acknowledgements */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Acknowledgements</h3>
            <div className="space-y-3">
              <label className="flex items-start space-x-3">
                <input type="checkbox" required
                  checked={form.acknowledgements.texas_only_confirmation}
                  onChange={(e) => updateField('acknowledgements', 'texas_only_confirmation', e.target.checked)}
                  className="mt-1 rounded border-gray-300" />
                <span className="text-sm text-gray-700">I confirm this intake is for a Texas residential lease.</span>
              </label>
              <label className="flex items-start space-x-3">
                <input type="checkbox" required
                  checked={form.acknowledgements.non_legal_service_acknowledged}
                  onChange={(e) => updateField('acknowledgements', 'non_legal_service_acknowledged', e.target.checked)}
                  className="mt-1 rounded border-gray-300" />
                <span className="text-sm text-gray-700">I acknowledge this is a document preparation and informational service only.</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => navigate('/intake/info')} className="btn-outline flex-1">
              Back
            </button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="cta-primary flex-1 disabled:opacity-50">
              {isSubmitting ? 'Submitting...' : 'Submit & Continue to Payment'}
            </button>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

// OLD Intake Page Component (keeping for reference, will be removed)
function IntakePage_OLD() {
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

      // Auto-redirect to review page after successful submission
      if (data.caseId) {
        navigate(`/review/${data.caseId}`);
        return;
      }
      setCaseId(data.caseId || '');
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

          // Landlord information
          if (extracted.landlord_name && !prev.landlord_information.landlord_name) {
            updated.landlord_information = {
              ...prev.landlord_information,
              landlord_name: extracted.landlord_name,
            };
            filledFields.add('landlord_information.landlord_name');
          }

          if (extracted.landlord_address && !prev.landlord_information.landlord_address) {
            updated.landlord_information = {
              ...updated.landlord_information,
              landlord_address: extracted.landlord_address,
            };
            filledFields.add('landlord_information.landlord_address');
          }

          if (extracted.landlord_city && !prev.landlord_information.landlord_city) {
            updated.landlord_information = {
              ...updated.landlord_information,
              landlord_city: extracted.landlord_city,
            };
            filledFields.add('landlord_information.landlord_city');
          }

          if (extracted.landlord_state && !prev.landlord_information.landlord_state) {
            updated.landlord_information = {
              ...updated.landlord_information,
              landlord_state: extracted.landlord_state,
            };
            filledFields.add('landlord_information.landlord_state');
          }

          if (extracted.landlord_zip && !prev.landlord_information.landlord_zip) {
            updated.landlord_information = {
              ...updated.landlord_information,
              landlord_zip: extracted.landlord_zip,
            };
            filledFields.add('landlord_information.landlord_zip');
          }

          if (extracted.landlord_phone && !prev.landlord_information.landlord_phone) {
            updated.landlord_information = {
              ...updated.landlord_information,
              landlord_phone: extracted.landlord_phone,
            };
            filledFields.add('landlord_information.landlord_phone');
          }

          // County
          if (extracted.county && !prev.property_information.county) {
            updated.property_information = {
              ...updated.property_information,
              county: extracted.county,
            };
            filledFields.add('property_information.county');
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
                  <span className="text-sm font-medium text-gray-700">
                    County
                    {autoFilledFields.has('property_information.county') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('property_information.county') ? 'bg-green-50 border-green-300' : ''
                    }`}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Landlord / Property Manager Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">
                    Landlord or property manager name
                    {autoFilledFields.has('landlord_information.landlord_name') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled from lease)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('landlord_information.landlord_name') ? 'bg-green-50 border-green-300' : ''
                    }`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">
                    Landlord address
                    {autoFilledFields.has('landlord_information.landlord_address') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('landlord_information.landlord_address') ? 'bg-green-50 border-green-300' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    City
                    {autoFilledFields.has('landlord_information.landlord_city') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('landlord_information.landlord_city') ? 'bg-green-50 border-green-300' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    ZIP code
                    {autoFilledFields.has('landlord_information.landlord_zip') && (
                      <span className="ml-2 text-xs text-green-600">(auto-filled)</span>
                    )}
                  </span>
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
                    className={`mt-1 w-full rounded-md border-gray-300 shadow-sm ${
                      autoFilledFields.has('landlord_information.landlord_zip') ? 'bg-green-50 border-green-300' : ''
                    }`}
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
                  href={`/review/${caseId}`}
                  className="mt-3 inline-flex btn-outline text-sm"
                >
                  Continue to Review & Payment
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
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('loading');
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
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

        if (payload.case.paymentStatus !== 'paid') {
          navigate(`/review/${caseId}`);
          return;
        }

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
  }, [apiBaseUrl, caseId, navigate]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/documents/${caseId}`);

      if (response.status === 402) {
        navigate(`/review/${caseId}`);
        return;
      }

      if (!response.ok) {
        alert('Unable to download document. Please try again.');
        setIsDownloading(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposit-defender-${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setDownloaded(true);
      setIsDownloading(false);
    } catch (error) {
      alert('Unable to download document. Please try again.');
      setIsDownloading(false);
    }
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        {status === 'loading' && (
          <div className="text-center py-20">
            <p className="text-slate-600 text-lg">Loading...</p>
          </div>
        )}

        {status === 'not_found' && (
          <div className="text-center py-20">
            <p className="text-red-600 text-lg">Case not found.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-20">
            <p className="text-red-600 text-lg">Unable to load this case.</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <section className="text-center py-12 mb-8">
              <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
                Payment Complete
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Your Document is Ready
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Your security deposit informational summary has been prepared.
              </p>
            </section>

            <section className="max-w-md mx-auto text-center">
              <div className="card bg-slate-50 p-8">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Security Deposit Summary
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  PDF document with your lease information and timeline
                </p>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="cta-primary w-full text-lg disabled:opacity-50"
                >
                  {isDownloading ? 'Preparing...' : 'Download PDF'}
                </button>

                {downloaded && (
                  <p className="text-sm text-green-700 mt-4">
                    ✓ Download started. Check your downloads folder.
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-6">
                This document is for informational purposes only. No legal advice is provided.
              </p>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  );
}

// How It Works Page Component
function HowItWorksPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
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
    </AppLayout>
  );
}

// Blog Page Component
function BlogPage() {
  return (
    <AppLayout>
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
    </AppLayout>
  );
}

// FAQ Page Component
function FAQPage() {
  return (
    <AppLayout>
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
    </AppLayout>
  );
}

// Payment Cancel Page Component
function PaymentCancelPage() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extractedCaseId = params.get('case_id');
    if (extractedCaseId) {
      setCaseId(extractedCaseId);
    }
  }, []);

  return (
    <AppLayout>
      <main className="container py-12">
        <div className="form-card text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Cancelled</h2>

          <div className="space-y-6">
            <div className="text-yellow-600 text-5xl mb-4">⚠</div>
            <p className="text-slate-600 text-lg">
              Your payment was not completed. No charges were made to your card.
            </p>

            <p className="text-slate-600">
              You can try again when you're ready, or contact support if you need assistance.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {caseId ? (
                <button
                  onClick={() => navigate(`/review/${caseId}`)}
                  className="btn-accent"
                >
                  Try Again
                </button>
              ) : null}
              <button
                onClick={() => navigate('/')}
                className="btn-outline"
              >
                Return to Home
              </button>
            </div>
          </div>

          <div className="mt-8 notice-card text-left">
            <p className="text-sm text-slate-600">
              If you experienced technical difficulties or have questions, please contact our support team.
            </p>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

// Payment Success Page Component
function PaymentSuccessPage() {
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('verifying');
  const [caseId, setCaseId] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      setStatus('error');
      return;
    }

    const verifyPayment = () => {
      fetch(`${apiBaseUrl}/api/payments/verify/${sessionId}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.status === 'ok' && data.isPaid) {
            setCaseId(data.caseId);
            setStatus('success');
            // Redirect to download page after 2 seconds
            setTimeout(() => {
              navigate(`/download/${data.caseId}`);
            }, 2000);
          } else {
            // Payment not yet confirmed, retry if under limit
            setRetryCount((prev) => {
              const newCount = prev + 1;
              if (newCount < MAX_RETRIES) {
                setTimeout(verifyPayment, RETRY_DELAY_MS);
                return newCount;
              } else {
                setStatus('pending');
                return newCount;
              }
            });
          }
        })
        .catch(() => {
          setStatus('error');
        });
    };

    verifyPayment();
  }, [apiBaseUrl, navigate]);

  return (
    <AppLayout>
      <main className="container py-12">
        <div className="form-card text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Status</h2>

          {status === 'verifying' ? (
            <div className="space-y-4">
              <p className="text-slate-600">Verifying your payment...</p>
              <div className="animate-pulse">
                <div className="h-2 bg-slate-200 rounded w-3/4 mx-auto"></div>
              </div>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-4">
              <div className="text-green-600 text-5xl mb-4">✓</div>
              <h3 className="text-2xl font-semibold text-green-700">Payment Successful!</h3>
              <p className="text-slate-600">
                Your payment has been processed. Redirecting you to your document...
              </p>
              {caseId ? (
                <a
                  href={`/download/${caseId}`}
                  className="inline-block mt-4 btn-accent"
                >
                  Go to Download Page
                </a>
              ) : null}
            </div>
          ) : null}

          {status === 'pending' ? (
            <div className="space-y-4">
              <p className="text-yellow-600 text-lg font-semibold">Payment Processing</p>
              <p className="text-slate-600">
                Your payment is still being processed. Please refresh this page in a few moments.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 btn-primary"
              >
                Refresh Page
              </button>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-4">
              <p className="text-red-600 text-lg font-semibold">Verification Error</p>
              <p className="text-slate-600">
                Unable to verify your payment. Please contact support if you were charged.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </AppLayout>
  );
}

// Review Page Component
function ReviewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('loading');
  const [caseData, setCaseData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);

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

        // If already paid, redirect to download page
        if (payload.case.paymentStatus === 'paid') {
          navigate(`/download/${caseId}`);
          return;
        }

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
  }, [apiBaseUrl, caseId, navigate]);

  const handleProceedToPayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caseId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.message || 'Unable to initiate payment. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      setPaymentError('Unable to initiate payment. Please try again.');
      setIsProcessingPayment(false);
    }
  };

  return (
    <AppLayout>
      <main className="container pb-20">
        {status === 'loading' ? (
          <div className="text-center py-20">
            <p className="text-slate-600 text-lg">Loading your case...</p>
          </div>
        ) : null}

        {status === 'not_found' ? (
          <div className="text-center py-20">
            <p className="text-red-600 text-lg">Case not found. Please verify the link.</p>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="text-center py-20">
            <p className="text-red-600 text-lg">Unable to load this case right now.</p>
          </div>
        ) : null}

        {status === 'ready' && caseData ? (
          <>
            {/* Success Hero Section */}
            <section className="text-center py-12 mb-8">
              <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
                Data Received
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Your Information Has Been Submitted
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Review your details below, then proceed to payment to generate your document.
              </p>
            </section>

            {/* Case Summary Card */}
            <section className="max-w-2xl mx-auto mb-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Case Summary</h3>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Tenant name</span>
                    <span className="font-medium">{formatValue(caseData.intake.tenant_information.full_name)}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium">{formatValue(caseData.intake.tenant_information.email)}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Property address</span>
                    <span className="font-medium">{formatValue(caseData.intake.property_information.property_address)}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">City</span>
                    <span className="font-medium">{formatValue(caseData.intake.property_information.city)}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Deposit amount</span>
                    <span className="font-medium">{formatValue(caseData.intake.security_deposit_information.deposit_amount)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-500">Move-out date</span>
                    <span className="font-medium">{formatValue(caseData.intake.move_out_information.move_out_date)}</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Payment Section */}
            <section className="max-w-2xl mx-auto mb-8">
              <div className="card bg-slate-50 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Document Preparation Fee</h3>
                <p className="text-4xl font-bold text-slate-900 mb-2">$19.99</p>
                <p className="text-sm text-slate-600 mb-6">One-time payment. No subscriptions.</p>

                {paymentError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                    {paymentError}
                  </div>
                ) : null}

                <button
                  onClick={handleProceedToPayment}
                  disabled={isProcessingPayment}
                  className="cta-primary w-full text-lg disabled:opacity-60"
                >
                  {isProcessingPayment ? 'Redirecting to payment...' : 'Proceed to Payment — $19.99'}
                </button>

                <p className="text-xs text-slate-500 mt-4">
                  Secure payment powered by Stripe
                </p>
              </div>
            </section>

            {/* Disclaimers */}
            <section className="max-w-2xl mx-auto">
              <div className="notice-card">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Before You Pay</h3>
                <ul className="text-xs text-slate-600 space-y-1">
                  {DISCLAIMERS.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AppLayout>
  );
}

// Main App Component
function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intake" element={<LeaseUploadPage />} />
          <Route path="/intake/info" element={<BasicInfoPage />} />
          <Route path="/intake/verify" element={<VerificationPage />} />
          <Route path="/review/:caseId" element={<ReviewPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancel" element={<PaymentCancelPage />} />
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
