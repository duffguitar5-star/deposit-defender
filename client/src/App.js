import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
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
        credentials: 'include', // Send session cookie
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to process lease.');
        setIsUploading(false);
        return;
      }

      // Pass extracted data via React Router state instead of localStorage
      const extractedData = {
        ...(data.data.extractedData || {}),
        leaseText: data.data.preview || '',
      };

      navigate('/intake/info', { state: { extractedData } });
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
                disabled={isUploading}
                className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Processing...' : 'Upload & Continue'}
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    navigate('/intake/info', { state: { extractedData: {} } });
                  }}
                  className="btn-outline text-sm px-6 py-3 w-full"
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
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    // Check if we have extracted data from previous step
    if (!location.state?.extractedData) {
      navigate('/intake');
    }
  }, [navigate, location]);

  const handleContinue = () => {
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    // Pass data forward with name and email added
    const updatedData = {
      ...location.state.extractedData,
      tenant_name: fullName.trim(),
      tenant_email: email.trim(),
    };

    navigate('/intake/verify', { state: { extractedData: updatedData } });
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
  const location = useLocation();
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
    // Read extracted data from location state
    if (!location.state?.extractedData) {
      navigate('/intake');
      return;
    }

    const extracted = location.state.extractedData;

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
        credentials: 'include', // Send session cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to submit.');
        setIsSubmitting(false);
        return;
      }

      // Navigate to review page
      if (data.data.caseId) {
        navigate(`/review/${data.data.caseId}`);
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

// Download Page Component
function DownloadPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('loading');
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showEmailOption, setShowEmailOption] = useState(false);
  const [email, setEmail] = useState('');
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    fetch(`${apiBaseUrl}/api/cases/${caseId}`, { credentials: 'include' })
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

        if (payload.data.case.paymentStatus !== 'paid') {
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
    setDownloadError('');
    setDownloaded(false);

    try {
      const response = await fetch(`${apiBaseUrl}/api/documents/${caseId}`, { credentials: 'include' });

      if (response.status === 402) {
        navigate(`/action-plan/${caseId}`);
        return;
      }

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          if (errorData.message) {
            setDownloadError(errorData.message);
          } else if (errorData.code === 'OCR_TIMEOUT') {
            setDownloadError('Document generation timed out. This can happen with complex files. Please try again.');
          } else if (errorData.code === 'PDF_GENERATION_FAILED') {
            setDownloadError('Unable to generate PDF. Please try again or contact support with your Case ID.');
          } else {
            setDownloadError('Unable to generate document. Please try again.');
          }
        } catch {
          setDownloadError('Unable to generate document. Please try again.');
        }
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
      setDownloadError('');
      setIsDownloading(false);
    } catch (error) {
      setDownloadError('Network error. Please check your connection and try again.');
      setIsDownloading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSent(false);
    setIsEmailing(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/documents/${caseId}/email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.status === 402) {
        navigate(`/action-plan/${caseId}`);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        // Parse specific error messages
        if (data.code === 'INVALID_EMAIL') {
          setEmailError('Please enter a valid email address.');
        } else if (data.code === 'OCR_TIMEOUT') {
          setEmailError('Document generation timed out. Please try again.');
        } else if (data.message) {
          setEmailError(data.message);
        } else {
          setEmailError('Unable to send email. Please try again.');
        }
        setIsEmailing(false);
        return;
      }

      setEmailSent(true);
      setIsEmailing(false);
      setEmail('');
    } catch (error) {
      setEmailError('Network error. Please check your connection and try again.');
      setIsEmailing(false);
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
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-4">
                Your security deposit informational summary has been prepared.
              </p>
              <div className="inline-flex items-center bg-slate-100 border border-slate-300 rounded-lg px-4 py-2">
                <span className="text-xs font-medium text-slate-600 mr-2">Case ID:</span>
                <code className="text-sm font-mono text-slate-900 select-all">{caseId}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(caseId);
                    alert('Case ID copied to clipboard');
                  }}
                  className="ml-3 text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Copy Case ID"
                >
                  Copy
                </button>
              </div>
            </section>

            <section className="max-w-md mx-auto text-center">
              <div className="card bg-slate-50 p-8">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Security Deposit Summary
                </h3>
                <p className="text-sm text-slate-600 mb-2">
                  PDF document with your lease information and timeline
                </p>
                <p className="text-xs text-slate-500 mb-6 font-mono">
                  deposit-defender-{caseId.slice(0, 8)}.pdf
                </p>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="cta-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating your document...
                    </span>
                  ) : (
                    downloadError ? 'Retry Download' : 'Download PDF'
                  )}
                </button>

                {isDownloading && (
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    This may take 30-60 seconds for complex documents...
                  </p>
                )}

                {downloaded && !downloadError && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-4">
                    <p className="text-sm text-green-700 flex items-center justify-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Download started. Check your downloads folder.
                    </p>
                  </div>
                )}

                {downloadError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                    <p className="text-sm text-red-800 mb-2">
                      <strong>Error:</strong> {downloadError}
                    </p>
                    <button
                      onClick={handleDownload}
                      className="text-sm text-red-700 hover:text-red-900 underline font-medium"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-slate-300">
                  <button
                    onClick={() => setShowEmailOption(!showEmailOption)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {showEmailOption ? '− Cancel' : '+ Email me a copy'}
                  </button>

                  {showEmailOption && (
                    <form onSubmit={handleEmailSubmit} className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2 text-left">
                        Email address (not stored):
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        className="w-full rounded-md border-gray-300 shadow-sm mb-3"
                      />
                      <button
                        type="submit"
                        disabled={isEmailing}
                        className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEmailing ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending email...
                          </span>
                        ) : (
                          'Send PDF via Email'
                        )}
                      </button>

                      {isEmailing && (
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          Generating and sending your document...
                        </p>
                      )}

                      {emailError && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
                          <p className="text-sm text-red-800">
                            <strong>Error:</strong> {emailError}
                          </p>
                        </div>
                      )}

                      {emailSent && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3">
                          <p className="text-sm text-green-700 flex items-center justify-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            PDF sent! Check your inbox.
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2 text-left">
                        Your email address is used only to deliver this document and is not stored in our system.
                      </p>
                    </form>
                  )}
                </div>
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

// Action Plan Overview Page Component (post-payment default view)
function ActionPlanOverviewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [status, setStatus] = useState('loading');
  const [report, setReport] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [expandedObservations, setExpandedObservations] = useState({ 0: true });
  const [expandedSteps, setExpandedSteps] = useState({});
  const [expandedSubSections, setExpandedSubSections] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [visibleSections, setVisibleSections] = useState({ observations: false, actionPlan: false, review: false });

  const observationsRef = useRef(null);
  const actionPlanRef = useRef(null);
  const reviewRef = useRef(null);

  const showSection = (section) => {
    setVisibleSections(prev => ({ ...prev, [section]: !prev[section] }));
    const refMap = { observations: observationsRef, actionPlan: actionPlanRef, review: reviewRef };
    // If expanding, scroll after a tick so the DOM renders
    if (!visibleSections[section]) {
      setTimeout(() => {
        refMap[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
    // Auto-expand first observation when opening Key Leverage
    if (section === 'observations' && !visibleSections.observations) {
      setExpandedObservations(prev => ({ ...prev, 0: true }));
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    // Verify payment and fetch analysis report
    Promise.all([
      fetch(`${apiBaseUrl}/api/cases/${caseId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${apiBaseUrl}/api/documents/${caseId}/json`, { credentials: 'include' }).then(r => r.json())
    ])
      .then(([caseData, reportData]) => {
        if (!isMounted) return;

        if (caseData?.data?.case?.paymentStatus !== 'paid') {
          navigate(`/review/${caseId}`);
          return;
        }

        setCaseData(caseData.data.case);

        if (reportData.status === 'ok' && reportData.data.report) {
          setReport(reportData.data.report);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (isMounted) setStatus('error');
      });

    return () => { isMounted = false; };
  }, [apiBaseUrl, caseId, navigate]);

  // Track scroll position for sticky back button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleObservation = (idx) => {
    setExpandedObservations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleStep = (stepNumber) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const toggleSubSection = (stepNumber, section) => {
    const key = `${stepNumber}-${section}`;
    setExpandedSubSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isSubSectionExpanded = (stepNumber, section) => {
    return expandedSubSections[`${stepNumber}-${section}`] || false;
  };

  // Find linked leverage point from applicability_note
  const findLinkedLeveragePoint = (step) => {
    if (!step.applicability_note || !report?.leverage_points) return null;
    // Parse "Relevant to: issue_id" format
    const match = step.applicability_note.match(/Relevant to:\s*(.+)/i);
    if (!match) return null;
    const issueId = match[1].trim().replace(/\s+/g, '_').toLowerCase();
    return report.leverage_points.find(lp =>
      lp.point_id?.toLowerCase() === issueId ||
      lp.issue_id?.toLowerCase() === issueId
    );
  };

  // Find relevant statutes for a step (from linked leverage point or category matching)
  const findRelevantStatutes = (step) => {
    if (!report?.statutory_references) return [];
    const linkedLp = findLinkedLeveragePoint(step);
    if (linkedLp?.statute_citations?.length) {
      return report.statutory_references.filter(sr =>
        linkedLp.statute_citations.some(sc =>
          sr.citation?.includes(sc.citation?.split('§')[1]?.trim()) ||
          sr.citation === sc.citation
        )
      );
    }
    // Fallback: return first few statutes as general reference
    return report.statutory_references.slice(0, 2);
  };

  // Find relevant lease clauses for a step
  const findRelevantLeaseClauses = (step) => {
    if (!report?.lease_clause_citations?.length) return 'none_found';
    const linkedLp = findLinkedLeveragePoint(step);
    if (linkedLp?.lease_citations && linkedLp.lease_citations !== 'none_found') {
      return Array.isArray(linkedLp.lease_citations) ? linkedLp.lease_citations : [];
    }
    // Fallback: match by category/topic
    const categoryTopicMap = {
      documentation: ['security_deposit', 'move_out'],
      communication: ['notice', 'security_deposit'],
      review: ['cleaning', 'damages', 'security_deposit'],
      next_steps: ['security_deposit']
    };
    const topics = categoryTopicMap[step.category] || ['security_deposit'];
    const matches = report.lease_clause_citations.filter(lc =>
      topics.includes(lc.topic)
    );
    return matches.length > 0 ? matches : 'none_found';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/documents/${caseId}`, {
        headers: { 'Accept': 'application/pdf' },
      });
      if (!response.ok) {
        alert('Unable to download report. Please try again.');
        setIsDownloading(false);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposit-defender-report-${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      // Delay cleanup so browser can initiate download
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 200);
      setIsDownloading(false);
    } catch (error) {
      console.error('PDF download error:', error);
      alert('Unable to download report. Please try again.');
      setIsDownloading(false);
    }
  };

  const toggleCheckItem = (stepNumber, itemIndex) => {
    const key = `${stepNumber}-${itemIndex}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isItemChecked = (stepNumber, itemIndex) => {
    return checkedItems[`${stepNumber}-${itemIndex}`] || false;
  };

  const truncateToOneSentence = (text) => {
    if (!text) return '';
    const match = text.match(/^[^.!?]*[.!?]/);
    return match ? match[0] : text;
  };

  const getKeyDatesForDisplay = () => {
    if (!report?.timeline) return [];
    const t = report.timeline;
    const dates = [];

    // Schema format: computed_deadlines array
    if (Array.isArray(t.computed_deadlines) && t.computed_deadlines.length > 0) {
      for (const d of t.computed_deadlines) {
        dates.push({ label: d.label, date: d.date, isPast: d.has_passed, daysRemaining: d.days_remaining });
      }
    }

    // Always include move-out date if available
    const moveOut = t.key_dates?.move_out_date || t.move_out_date;
    if (moveOut) {
      dates.unshift({ label: 'Move-out date', date: moveOut, isPast: true, daysRemaining: null });
    }

    // Flat format fallback: synthesize 30-day deadline
    if (dates.length <= 1 && moveOut && t.days_since_move_out != null) {
      const moveOutDate = new Date(moveOut);
      if (!isNaN(moveOutDate.getTime())) {
        const deadlineDate = new Date(moveOutDate);
        deadlineDate.setDate(deadlineDate.getDate() + 30);
        dates.push({
          label: '30-day deadline',
          date: deadlineDate.toISOString().slice(0, 10),
          isPast: t.past_30_days === true,
          daysRemaining: 30 - t.days_since_move_out,
        });
      }
    }

    return dates;
  };

  // Category labels for procedural steps
  const categoryLabels = {
    documentation: 'Documentation',
    communication: 'Communication',
    legal_consultation: 'Legal Consultation',
    court_information: 'Court Information',
    review: 'Review',
    planning: 'Planning',
    next_steps: 'Next Steps',
  };

  const recordKeepingTips = {
    documentation: 'Save digital copies of everything. Keep originals in one folder.',
    communication: 'Send via certified mail. Screenshot emails and texts.',
    legal_consultation: 'Bring your organized documents to any consultation.',
    court_information: 'Courts may require originals\u2014keep both paper and digital copies.',
    review: 'Save digital copies of everything. Keep originals in one folder.',
    planning: 'Save digital copies of everything. Keep originals in one folder.',
    next_steps: 'Bring your organized documents to any consultation.',
  };

  return (
    <AppLayout>
      <main className="container py-8 pb-20">
        {status === 'loading' && (
          <div className="text-center py-20">
            <p className="text-slate-600 text-lg">Loading your action plan...</p>
            <div className="animate-pulse mt-4">
              <div className="h-2 bg-slate-200 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="form-card text-center">
            <p className="text-red-600 text-lg font-semibold">Unable to load your action plan</p>
            <p className="text-slate-600 mt-2">Please try again or contact support.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'ready' && report && (
          <>
            {/* Header Section */}
            <section className="text-center mb-8">
              <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-4 py-1 rounded-full mb-4">
                Analysis Complete
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Your Action Plan
              </h2>
              <p className="text-slate-600 max-w-xl mx-auto">
                Based on your situation, here are the key observations and next steps to consider.
              </p>
            </section>

            {/* Pathway Selector */}
            <section className="mb-10">
              <p className="text-sm font-medium text-slate-500 text-center mb-4">Choose how you want to proceed</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => showSection('observations')}
                  className={`text-left border rounded-xl p-4 transition-all hover:shadow-md active:scale-[0.98] min-h-[100px] ${
                    visibleSections.observations ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="font-semibold text-slate-900">Key Leverage</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">See the strongest facts and law that support getting your deposit back.</p>
                </button>

                <button
                  onClick={() => showSection('actionPlan')}
                  className={`text-left border rounded-xl p-4 transition-all hover:shadow-md active:scale-[0.98] min-h-[100px] ${
                    visibleSections.actionPlan ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="font-semibold text-slate-900">Action Plan</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Step-by-step actions you can take, with dates and checklists.</p>
                </button>

                <button
                  onClick={() => showSection('review')}
                  className={`text-left border rounded-xl p-4 transition-all hover:shadow-md active:scale-[0.98] min-h-[100px] ${
                    visibleSections.review ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-semibold text-slate-900">Review Your Case</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Review timelines, compliance status, and case facts.</p>
                </button>
              </div>
            </section>

            {/* Section 1: Key Observations */}
            <div ref={observationsRef}>
            {visibleSections.observations && report.leverage_points?.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Key Observations</h3>
                <div className="space-y-3">
                  {report.leverage_points.map((lp, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-xl overflow-hidden ${
                        idx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        onClick={() => toggleObservation(idx)}
                        className="w-full px-4 py-4 flex items-start gap-3 text-left hover:bg-opacity-80 transition-colors min-h-[56px]"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {lp.rank || idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-900">{lp.title}</p>
                            {lp.severity && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                lp.severity === 'high' ? 'bg-red-100 text-red-700'
                                : lp.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                              }`}>
                                {lp.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{lp.observation}</p>
                        </div>
                        <div className="flex-shrink-0 text-slate-400 mt-1">
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedObservations[idx] ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {expandedObservations[idx] && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                          <div className="pl-0 sm:pl-11 space-y-3 mt-3">
                            {/* Full observation */}
                            <p className="text-sm text-slate-700 leading-relaxed">{lp.observation}</p>

                            {/* Why this matters */}
                            {lp.why_this_matters && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-amber-800 mb-1">Why this matters:</p>
                                <p className="text-sm text-amber-900 leading-relaxed">{lp.why_this_matters}</p>
                              </div>
                            )}

                            {/* Supporting facts */}
                            {lp.supporting_facts?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Supporting facts:</p>
                                <ul className="space-y-1">
                                  {lp.supporting_facts.map((sf, sfIdx) => (
                                    <li key={sfIdx} className="text-xs text-slate-600 flex items-start gap-1.5">
                                      <span className="text-slate-400 mt-0.5">•</span>
                                      <span>{sf.fact || sf}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Statute citations */}
                            {lp.statute_citations?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Relevant statutes:</p>
                                <ul className="space-y-1">
                                  {lp.statute_citations.map((sc, scIdx) => (
                                    <li key={scIdx} className="text-xs text-slate-600">
                                      <span className="font-medium">{sc.citation || sc}</span>
                                      {sc.title && <span className="text-slate-400"> — {sc.title}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Lease citations */}
                            {lp.lease_citations && lp.lease_citations !== 'none_found' && Array.isArray(lp.lease_citations) && lp.lease_citations.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Lease references:</p>
                                <ul className="space-y-1.5">
                                  {lp.lease_citations.map((lc, lcIdx) => (
                                    <li key={lcIdx} className="text-xs border-l-2 border-slate-200 pl-2">
                                      <span className="font-medium text-slate-600 capitalize">{(lc.topic || 'clause').replace(/_/g, ' ')}</span>
                                      {lc.excerpt && (
                                        <p className="text-slate-500 mt-0.5 italic">
                                          "{lc.excerpt.slice(0, 150)}{lc.excerpt.length > 150 ? '...' : ''}"
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            </div>

            {/* Section 2: Action Plan */}
            <div ref={actionPlanRef}>
            {visibleSections.actionPlan && report.procedural_steps?.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">
                  Your Action Plan
                </h3>
                <div className="space-y-3">
                  {report.procedural_steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      {/* Step Header - Always Visible */}
                      <button
                        onClick={() => toggleStep(step.step_number)}
                        className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[56px]"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-semibold text-sm">
                          {step.step_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{step.title}</p>
                          <span className="text-xs text-slate-500 uppercase tracking-wide">
                            {categoryLabels[step.category] || step.category}
                          </span>
                        </div>
                        <div className="flex-shrink-0 text-slate-400">
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedSteps[step.step_number] ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Step Details - Expandable */}
                      {expandedSteps[step.step_number] && (
                        <div className="px-4 pb-5 pt-0 border-t border-slate-100">
                          <div className="pl-0 sm:pl-11">
                            {/* Lead-in sentence */}
                            <p className="text-sm font-medium text-slate-700 leading-relaxed mt-3 mb-4">
                              {truncateToOneSentence(step.description)}
                            </p>

                            {/* === PRIMARY TIER === */}
                            <div className="space-y-4 mb-4">
                              {/* Interactive Checklist */}
                              {step.checklist?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg p-4">
                                  <p className="text-sm font-medium text-slate-700 mb-3">What to include:</p>
                                  <ul className="space-y-2">
                                    {step.checklist.map((item, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2 cursor-pointer select-none"
                                        onClick={() => toggleCheckItem(step.step_number, idx)}
                                        role="checkbox"
                                        aria-checked={isItemChecked(step.step_number, idx)}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (e.key === ' ' || e.key === 'Enter') {
                                            e.preventDefault();
                                            toggleCheckItem(step.step_number, idx);
                                          }
                                        }}
                                      >
                                        <div className={`flex-shrink-0 w-5 h-5 border-2 rounded mt-0.5 flex items-center justify-center transition-colors ${
                                          isItemChecked(step.step_number, idx)
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-slate-300'
                                        }`}>
                                          {isItemChecked(step.step_number, idx) && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                        <span className={`text-sm transition-colors ${
                                          isItemChecked(step.step_number, idx) ? 'text-slate-400 line-through' : 'text-slate-600'
                                        }`}>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Key Dates */}
                              {(() => {
                                const keyDates = getKeyDatesForDisplay();
                                if (keyDates.length === 0) return null;
                                return (
                                  <div className="bg-blue-50 rounded-lg p-4">
                                    <p className="text-sm font-medium text-slate-700 mb-3">Key dates:</p>
                                    <div className="space-y-2">
                                      {keyDates.map((d, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-slate-700">{d.label}:</span>
                                          <span className="font-medium text-slate-900">
                                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                                              month: 'short', day: 'numeric', year: 'numeric'
                                            })}
                                          </span>
                                          {d.isPast && d.daysRemaining != null && d.daysRemaining < 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                              {Math.abs(d.daysRemaining)} days ago
                                            </span>
                                          )}
                                          {!d.isPast && d.daysRemaining != null && d.daysRemaining > 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                              {d.daysRemaining} days left
                                            </span>
                                          )}
                                          {d.daysRemaining === 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                              Today
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* === SECONDARY TIER === */}
                            <div className="border-t border-slate-100 pt-3 space-y-2">
                              {/* Record-keeping tip */}
                              {recordKeepingTips[step.category] && (
                                <div className="flex items-start gap-2 text-xs text-slate-500 italic">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{recordKeepingTips[step.category]}</span>
                                </div>
                              )}

                              {/* Why this matters - compact */}
                              {(() => {
                                const linkedLp = findLinkedLeveragePoint(step);
                                if (linkedLp?.why_this_matters) {
                                  return (
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                      <span className="font-medium text-slate-600">Why this matters:</span>{' '}
                                      {linkedLp.why_this_matters}
                                    </p>
                                  );
                                }
                                return null;
                              })()}

                              {/* Resources */}
                              {step.resources?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 mb-1">Helpful resources:</p>
                                  <ul className="space-y-0.5">
                                    {step.resources.map((resource, idx) => (
                                      <li key={idx}>
                                        <a
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline"
                                        >
                                          {resource.title}
                                        </a>
                                        {resource.description && (
                                          <span className="text-xs text-slate-400"> - {resource.description}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Collapsible Statute Citations */}
                              {(() => {
                                const statutes = findRelevantStatutes(step);
                                if (statutes.length === 0) return null;
                                const isOpen = isSubSectionExpanded(step.step_number, 'statutes');
                                return (
                                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => toggleSubSection(step.step_number, 'statutes')}
                                      className="w-full px-3 py-2 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px]"
                                      style={{ WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <span className="text-xs font-medium text-slate-500">
                                        Texas Law References ({statutes.length})
                                      </span>
                                      <svg
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {isOpen && (
                                      <div className="px-3 py-2 space-y-2 bg-white">
                                        {statutes.map((statute, idx) => (
                                          <div key={idx} className="text-xs">
                                            <p className="font-medium text-slate-700">{statute.citation}</p>
                                            {statute.title && (
                                              <p className="text-slate-500">{statute.title}</p>
                                            )}
                                            {statute.summary && (
                                              <p className="text-slate-400 mt-0.5">{statute.summary}</p>
                                            )}
                                            {statute.url && (
                                              <a
                                                href={statute.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                                              >
                                                View full text
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Collapsible Lease Clause Excerpts */}
                              {(() => {
                                const clauses = findRelevantLeaseClauses(step);
                                const isOpen = isSubSectionExpanded(step.step_number, 'lease');
                                const hasNone = clauses === 'none_found' || (Array.isArray(clauses) && clauses.length === 0);

                                return (
                                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => toggleSubSection(step.step_number, 'lease')}
                                      className="w-full px-3 py-2 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px]"
                                      style={{ WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <span className="text-xs font-medium text-slate-500">
                                        Lease Clause References {!hasNone && `(${clauses.length})`}
                                      </span>
                                      <svg
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {isOpen && (
                                      <div className="px-3 py-2 bg-white">
                                        {hasNone ? (
                                          <p className="text-xs text-slate-400 italic">
                                            No specific lease clauses were identified for this step.
                                          </p>
                                        ) : (
                                          <div className="space-y-2">
                                            {clauses.map((clause, idx) => (
                                              <div key={idx} className="text-xs border-l-2 border-slate-200 pl-2">
                                                <p className="font-medium text-slate-600 capitalize">
                                                  {(clause.topic || 'Lease Clause').replace(/_/g, ' ')}
                                                </p>
                                                {clause.source && (
                                                  <p className="text-slate-400">{clause.source}</p>
                                                )}
                                                <p className="text-slate-500 mt-0.5 leading-relaxed bg-slate-50 p-1.5 rounded italic">
                                                  "{clause.excerpt?.slice(0, 200)}{clause.excerpt?.length > 200 ? '...' : ''}"
                                                </p>
                                                {clause.is_conflict && (
                                                  <p className="text-amber-600 mt-0.5 font-medium">
                                                    Note: This clause may conflict with Texas law requirements.
                                                  </p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Collapse button */}
                              <div className="pt-2">
                                <button
                                  onClick={() => toggleStep(step.step_number)}
                                  className="text-xs text-slate-400 hover:text-slate-600 active:text-slate-800 flex items-center gap-1 py-2 min-h-[44px]"
                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                  Collapse details
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            </div>

            {/* Section 3: Review Your Case */}
            <div ref={reviewRef}>
            {visibleSections.review && (caseData?.intake || report?.timeline || report?.compliance_checklist) && (
              <section className="border-t border-slate-200 pt-8 mt-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Review Your Case</h3>
                <div className="space-y-4">

                  {/* Timeline Summary */}
                  {report?.timeline && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Timeline</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {report.timeline.move_out_date && (
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-slate-500 mb-1">Move-out Date</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {new Date(report.timeline.move_out_date + 'T00:00:00').toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </p>
                          </div>
                        )}
                        {report.timeline.days_since_move_out != null && (
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-slate-500 mb-1">Days Since Move-out</p>
                            <p className={`text-sm font-semibold ${
                              report.timeline.days_since_move_out > 30 ? 'text-red-600' : 'text-slate-900'
                            }`}>
                              {report.timeline.days_since_move_out} days
                            </p>
                          </div>
                        )}
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-slate-500 mb-1">30-Day Deadline</p>
                          {report.timeline.past_30_days ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compliance Checklist */}
                  {report?.compliance_checklist && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Compliance Checklist</p>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            report.compliance_checklist.deposit_returned ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {report.compliance_checklist.deposit_returned ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">Security deposit returned</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            report.compliance_checklist.itemization_provided ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {report.compliance_checklist.itemization_provided ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">Itemized deductions provided</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            report.compliance_checklist.refund_within_30_days ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {report.compliance_checklist.refund_within_30_days ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">Refund within 30-day window</span>
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* Intake Facts */}
                  {caseData?.intake && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Case Facts</p>
                        <ul className="space-y-2 text-sm text-slate-700">
                          <li className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Tenant</span>
                            <span className="font-medium">{formatValue(caseData.intake.tenant_information?.full_name)}</span>
                          </li>
                          <li className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Property</span>
                            <span className="font-medium">{formatValue(caseData.intake.property_information?.property_address)}</span>
                          </li>
                          <li className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Move-out date</span>
                            <span className="font-medium">{formatValue(caseData.intake.move_out_information?.move_out_date)}</span>
                          </li>
                          <li className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Deposit amount</span>
                            <span className="font-medium">{formatValue(caseData.intake.security_deposit_information?.deposit_amount)}</span>
                          </li>
                          <li className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Deposit returned</span>
                            <span className="font-medium">{formatValue(caseData.intake.security_deposit_information?.deposit_returned)}</span>
                          </li>
                          {caseData.intake.security_deposit_information?.amount_returned && (
                            <li className="flex justify-between border-b border-slate-100 pb-2">
                              <span className="text-slate-500">Amount returned</span>
                              <span className="font-medium">{formatValue(caseData.intake.security_deposit_information.amount_returned)}</span>
                            </li>
                          )}
                          <li className="flex justify-between">
                            <span className="text-slate-500">Itemized deductions received</span>
                            <span className="font-medium">{formatValue(caseData.intake.post_move_out_communications?.itemized_deductions_received)}</span>
                          </li>
                        </ul>
                      </div>

                      {/* Detected Issues */}
                      {report?.leverage_points?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Detected Issues</p>
                          <ul className="space-y-2">
                            {report.leverage_points.map((lp, idx) => (
                              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                  lp.severity === 'high' ? 'bg-red-500' : lp.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                                }`}></span>
                                <span>{lp.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Statute Citations */}
                      {report?.statutory_references?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Statute Citations</p>
                          <ul className="space-y-1">
                            {report.statutory_references.map((sr, idx) => (
                              <li key={idx} className="text-xs text-slate-600">
                                <span className="font-medium">{sr.citation}</span>
                                {sr.topic && <span className="text-slate-400"> — {sr.topic}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Lease Excerpts */}
                      {report?.lease_clause_citations?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Lease Excerpts</p>
                          <ul className="space-y-2">
                            {report.lease_clause_citations.map((lc, idx) => (
                              <li key={idx} className="text-xs border-l-2 border-slate-200 pl-2">
                                <span className="font-medium text-slate-600 capitalize">{(lc.topic || 'clause').replace(/_/g, ' ')}</span>
                                <p className="text-slate-500 mt-0.5 leading-relaxed italic">
                                  "{lc.excerpt?.slice(0, 200)}{lc.excerpt?.length > 200 ? '...' : ''}"
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </section>
            )}
            </div>

            {/* Download PDF */}
            <section className="pt-8 mt-8">
              <div className="max-w-md mx-auto">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="btn-primary w-full text-center min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isDownloading ? 'Preparing...' : 'Download PDF Report'}
                </button>
              </div>
            </section>

            {/* Disclaimer */}
            <section className="mt-10">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  {report.disclaimers?.primary || 'This report is provided for informational purposes only. It does not constitute legal advice. For legal advice specific to your situation, consult a licensed Texas attorney.'}
                </p>
              </div>
            </section>
          </>
        )}

        {/* Floating Back to Action Plan button - iOS safe area aware */}
        {showBackToTop && status === 'ready' && (
          <button
            onClick={scrollToTop}
            className="fixed right-4 bg-slate-900 text-white px-4 rounded-full shadow-lg hover:bg-slate-800 active:bg-slate-700 transition-all flex items-center justify-center gap-2 text-sm font-medium z-50 min-h-[48px] min-w-[48px]"
            style={{
              bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="hidden sm:inline">Back to Action Plan</span>
          </button>
        )}
      </main>
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
          if (data.status === 'ok' && data.data.isPaid) {
            navigate(`/action-plan/${data.data.caseId}`);
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
                Your payment has been processed. Redirecting you to your action plan...
              </p>
              {caseId ? (
                <a
                  href={`/action-plan/${caseId}`}
                  className="inline-block mt-4 btn-accent"
                >
                  Go to Action Plan
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

    fetch(`${apiBaseUrl}/api/cases/${caseId}`, { credentials: 'include' })
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

        // Paid users go straight to the action plan
        if (payload.data.case.paymentStatus === 'paid') {
          navigate(`/action-plan/${caseId}`);
          return;
        }

        setCaseData(payload.data.case || null);
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
      window.location.href = data.data.url;
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
            {/* Hero Section */}
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
          <Route path="/action-plan/:caseId" element={<ActionPlanOverviewPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/faq" element={<FAQPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
