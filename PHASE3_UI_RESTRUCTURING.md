# PHASE 3: UI RE-ARCHITECTURE

## Current State Problems

### 1. **Monolithic App.js** (2,326 lines)
- All routes in single file
- No component reuse
- Difficult to test
- State management via prop-drilling
- Hard to navigate codebase

### 2. **Unclear Value Hierarchy**
- Leverage points buried in expandable sections
- No clear "score" or "grade" visible
- Timeline/compliance shown equally with critical leverage
- No visual hierarchy of importance

### 3. **Weak PDF Download UX**
- Blob download sometimes fails
- No loading state feedback
- No download retry mechanism
- Payment gate not clearly communicated

### 4. **Multi-Step Intake Confusion**
- 4 separate pages (Home → LeaseUpload → BasicInfo → Verification)
- State not preserved on back navigation
- Users lose context between steps
- Lease upload feels disconnected from intake

---

## Target State: 4-Layer Information Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: SUMMARY (Above the fold)                          │
│ ────────────────────────────────────────────────────────────│
│  Your Case Strength: A (95/100)                            │
│  Win Probability: 85%                                       │
│  Recovery Estimate: $1,600 (likely) - $4,600 (best)        │
│  Recommended Action: Send Demand Letter (HIGH urgency)      │
│                                                             │
│  [Download Full Report PDF] [Send Demand Letter]           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: STRATEGY (What to do next)                        │
│ ────────────────────────────────────────────────────────────│
│  📋 Your Action Plan                                        │
│  ├─ Step 1: Download demand letter template (Today)        │
│  ├─ Step 2: Send via certified mail ($8) (Within 3 days)   │
│  ├─ Step 3: Set calendar reminder (After sending)          │
│  └─ Step 4: File small claims if no response (Day 15+)     │
│                                                             │
│  ⚖️ What Happens Next                                       │
│  ├─ 75% chance: Landlord settles within 14 days ✓          │
│  ├─ 15% chance: Partial settlement (you can escalate)      │
│  └─ 10% chance: No response → small claims (85% win rate)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: DEEP DIVE (Expand to see details)                 │
│ ────────────────────────────────────────────────────────────│
│  ▼ Your Leverage Points (3 critical issues)                │
│     ├─ #1: Landlord Forfeited Right to Withhold (A)        │
│     ├─ #2: No Itemization Provided (A)                     │
│     └─ #3: Bad Faith Indicators Detected (B)               │
│                                                             │
│  ▼ Statute Cross-Reference                                 │
│     ├─ § 92.103: 30-Day Deadline (VIOLATED)                │
│     ├─ § 92.107: Forwarding Address (COMPLIED)             │
│     └─ § 92.109: Landlord Liability (ELIGIBLE)             │
│                                                             │
│  ▼ Evidence Assessment                                     │
│     ├─ Lease Agreement ✓ (Strong)                          │
│     ├─ Deposit Receipt ✓ (Strong)                          │
│     ├─ Forwarding Address ✓ (Strong)                       │
│     └─ Move-in Photos ✗ (Optional)                         │
│                                                             │
│  ▼ Timeline Analysis                                       │
│     Day 0 (Move-out) → Day 30 (Deadline) → Day 45 (Today)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: EXPORT TOOLS                                      │
│ ────────────────────────────────────────────────────────────│
│  [Download PDF Report] [Download Demand Letter Template]   │
│  [Email Report to Me] [Save for Later]                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Proposed File Structure

### Frontend Reorganization

```
client/src/
├── App.js (100 lines - routing only)
├── index.js
├── config/
│   ├── api.js (API base URL config)
│   └── stripe.js
├── pages/
│   ├── Home.js (150 lines - landing page)
│   ├── Intake.js (450 lines - unified intake with tabs)
│   ├── ActionPlan.js (600 lines - main results page)
│   ├── Payment.js (200 lines - Stripe checkout handling)
│   └── NotFound.js (50 lines)
├── components/
│   ├── layout/
│   │   ├── Header.js (80 lines)
│   │   ├── Footer.js (60 lines)
│   │   └── PageContainer.js (40 lines)
│   ├── intake/
│   │   ├── IntakeTabs.js (100 lines - tab navigation)
│   │   ├── LeaseUploadStep.js (150 lines)
│   │   ├── BasicInfoStep.js (120 lines)
│   │   ├── VerificationStep.js (250 lines - main form)
│   │   └── ProgressIndicator.js (60 lines)
│   ├── results/
│   │   ├── CaseStrengthCard.js (150 lines - Layer 1)
│   │   ├── StrategyPanel.js (200 lines - Layer 2)
│   │   ├── LeveragePointsList.js (150 lines)
│   │   ├── LeveragePointDetail.js (120 lines)
│   │   ├── TimelineVisualization.js (100 lines)
│   │   ├── EvidenceMatrix.js (100 lines)
│   │   ├── StatuteList.js (80 lines)
│   │   └── DownloadPanel.js (100 lines - Layer 4)
│   └── shared/
│       ├── Button.js (40 lines)
│       ├── Card.js (30 lines)
│       ├── Badge.js (30 lines)
│       ├── LoadingSpinner.js (20 lines)
│       └── ErrorBoundary.js (existing)
├── hooks/
│   ├── useCase.js (fetch case data)
│   ├── useReport.js (fetch report JSON)
│   └── usePdfDownload.js (handle PDF download with retry)
├── utils/
│   ├── formatters.js (date, currency, percentage)
│   └── constants.js (severity colors, grade colors)
├── styles/
│   ├── global.css
│   ├── variables.css (colors, spacing, breakpoints)
│   └── components/ (CSS modules if needed)
└── disclaimers.js (existing)
```

**Reduction:**
- BEFORE: 2,326 lines in App.js
- AFTER: ~100 lines App.js + ~2,500 lines spread across 30 small, focused components

---

## Layer-by-Layer UI Design

### LAYER 1: Case Strength Summary Card

**Location:** Top of ActionPlan page, always visible

**Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ YOUR CASE STRENGTH                                          │
│                                                             │
│         ┌─────────┐                                         │
│         │    A    │  95 / 100                               │
│         └─────────┘                                         │
│      Leverage Grade    Leverage Score                       │
│                                                             │
│  Win Probability:  ████████████████░░ 85%                   │
│  Recovery Range:   $1,600 - $4,600                          │
│  Position:         ✓ STRONG STATUTORY LEVERAGE              │
│                                                             │
│  ⚡ RECOMMENDED ACTION: Send Demand Letter (HIGH URGENCY)   │
│                                                             │
│  [Download Full Report] [See Action Plan ↓]                │
└─────────────────────────────────────────────────────────────┘
```

**Component: `CaseStrengthCard.js`**
```jsx
function CaseStrengthCard({ caseStrength, recoveryEstimate, strategy }) {
  return (
    <div className="case-strength-card">
      <h2>Your Case Strength</h2>

      <div className="grade-display">
        <div className={`grade-badge grade-${caseStrength.leverage_grade}`}>
          {caseStrength.leverage_grade}
        </div>
        <div className="score">
          <span className="score-value">{caseStrength.leverage_score}</span>
          <span className="score-max"> / 100</span>
        </div>
      </div>

      <div className="metrics">
        <MetricBar
          label="Win Probability"
          value={caseStrength.win_probability}
          color="green"
        />
        <MetricRow
          label="Recovery Range"
          value={`${recoveryEstimate.likely_case} - ${recoveryEstimate.best_case}`}
        />
        <MetricRow
          label="Position"
          value={caseStrength.strategic_position}
          icon="✓"
        />
      </div>

      <div className="recommendation">
        <Badge urgency={strategy.urgency}>
          {strategy.urgency} URGENCY
        </Badge>
        <h3>Recommended: {formatAction(strategy.recommended_action)}</h3>
      </div>

      <div className="actions">
        <Button primary onClick={handleDownloadPdf}>
          Download Full Report
        </Button>
        <Button secondary onClick={() => scrollToSection('strategy')}>
          See Action Plan ↓
        </Button>
      </div>
    </div>
  );
}
```

---

### LAYER 2: Strategy Panel

**Location:** Below Layer 1, prominent placement

**Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ YOUR ACTION PLAN                                            │
│                                                             │
│  Step 1  Download demand letter template                   │
│  ●━━━    Deadline: Today                                    │
│          Cost: Free                                         │
│          [Download Template]                                │
│                                                             │
│  Step 2  Send via USPS certified mail                      │
│  ○━━━    Deadline: Within 3 days                            │
│          Cost: $8                                           │
│          Include return receipt requested                  │
│                                                             │
│  Step 3  Set calendar reminder                             │
│  ○━━━    Deadline: After sending                            │
│          Cost: Free                                         │
│          Reminder: 14 days after mail receipt              │
│                                                             │
│  Step 4  File small claims if no response                  │
│  ○━━━    Deadline: Day 15 onwards                           │
│          Cost: $50-150 (recoverable if you win)            │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  WHAT HAPPENS NEXT                                          │
│                                                             │
│  75%  Landlord settles within 14 days ✓                    │
│       └─> You receive full deposit + penalty               │
│                                                             │
│  15%  Landlord offers partial settlement                   │
│       └─> You decide: accept or escalate to court          │
│                                                             │
│  10%  No response from landlord                            │
│       └─> File small claims (85% win probability)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Component: `StrategyPanel.js`**
```jsx
function StrategyPanel({ strategy, scenarios }) {
  return (
    <section id="strategy" className="strategy-panel">
      <h2>Your Action Plan</h2>

      <div className="action-steps">
        {strategy.next_steps.map((step, idx) => (
          <ActionStep
            key={idx}
            step={step.step}
            action={step.action}
            deadline={step.deadline}
            cost={step.cost}
            completed={false}
          />
        ))}
      </div>

      <Divider />

      <h3>What Happens Next</h3>
      <div className="scenarios">
        {scenarios.map(scenario => (
          <ScenarioCard
            key={scenario.scenario_id}
            title={scenario.title}
            probability={scenario.probability}
            outcome={scenario.outcome}
            timeline={scenario.timeline}
          />
        ))}
      </div>

      <InfoBox type="info">
        <strong>Success Probability: {strategy.success_probability}</strong>
        <br />
        {strategy.rationale}
      </InfoBox>
    </section>
  );
}
```

---

### LAYER 3: Deep Dive (Expandable Sections)

**Design Pattern:** Accordion/collapse sections

```
┌─────────────────────────────────────────────────────────────┐
│ DETAILED ANALYSIS                                           │
│                                                             │
│  ▶ Your Leverage Points (3)                    [Expand All]│
│  ▶ Statute Cross-Reference (4 statutes)                    │
│  ▶ Evidence Assessment (6 items)                           │
│  ▶ Timeline Visualization                                  │
│  ▶ Damage Claim Defenses (if applicable)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

// When expanded:
┌─────────────────────────────────────────────────────────────┐
│  ▼ Your Leverage Points (3)                    [Collapse]   │
│                                                             │
│    #1  Landlord Forfeited Right to Withhold   [Grade: A]   │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│    Leverage Score: 95/100 | Win Contribution: 60%          │
│                                                             │
│    WHY THIS MATTERS:                                        │
│    Under Texas Property Code § 92.103, landlords must      │
│    return deposits within 30 days. Your landlord missed    │
│    this deadline by 15 days, forfeiting their right to     │
│    withhold any portion of your deposit under § 92.109.    │
│                                                             │
│    SUPPORTING FACTS:                                        │
│    • Move-out date: January 5, 2026 (source: tenant)       │
│    • Forwarding address provided: January 6, 2026 ✓        │
│    • Days elapsed: 45 days                                 │
│    • Deadline: February 4, 2026                            │
│    • Status: VIOLATED by 11 days                           │
│                                                             │
│    STATUTES:                                               │
│    • § 92.103 (30-day refund deadline)                     │
│    • § 92.109 (landlord liability for violations)          │
│                                                             │
│    [Show Full Detail]                                      │
│                                                             │
│    #2  No Itemization Provided                 [Grade: A]  │
│    ...                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Component: `LeveragePointsList.js` + `LeveragePointDetail.js`**
```jsx
function LeveragePointsList({ leveragePoints }) {
  const [expandedAll, setExpandedAll] = useState(false);

  return (
    <div className="leverage-points-section">
      <div className="section-header">
        <h3>Your Leverage Points ({leveragePoints.length})</h3>
        <Button onClick={() => setExpandedAll(!expandedAll)}>
          {expandedAll ? 'Collapse All' : 'Expand All'}
        </Button>
      </div>

      {leveragePoints.map((point, idx) => (
        <LeveragePointDetail
          key={point.issue_id}
          rank={idx + 1}
          point={point}
          defaultExpanded={idx === 0 || expandedAll}
        />
      ))}
    </div>
  );
}

function LeveragePointDetail({ rank, point, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="leverage-point-card">
      <div className="point-header" onClick={() => setExpanded(!expanded)}>
        <span className="rank">#{rank}</span>
        <h4>{point.title}</h4>
        <Badge grade={point.leverage_grade}>{point.leverage_grade}</Badge>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
      </div>

      {expanded && (
        <div className="point-details">
          <div className="metrics">
            <Metric label="Leverage Score" value={`${point.leverage_score}/100`} />
            <Metric label="Win Contribution" value={`${point.win_contribution}%`} />
          </div>

          <Section title="Why This Matters">
            <p>{point.why_this_matters}</p>
          </Section>

          <Section title="Supporting Facts">
            <FactsList facts={point.supporting_facts} />
          </Section>

          <Section title="Statutes">
            <StatuteBadgeList citations={point.statute_citations} />
          </Section>

          {point.lease_citations !== 'none_found' && (
            <Section title="Lease References">
              <LeaseClauseList clauses={point.lease_citations} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### LAYER 4: Download Panel

**Location:** Bottom of page, sticky footer optional

```
┌─────────────────────────────────────────────────────────────┐
│ EXPORT YOUR REPORT                                          │
│                                                             │
│  [Download PDF Report]        Full analysis in PDF format  │
│  [Download Demand Letter]     Ready-to-send template       │
│  [Email Report to Me]         Send to your email           │
│  [Save Analysis (JSON)]       Developer/records format     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Component: `DownloadPanel.js`** with retry logic:
```jsx
function DownloadPanel({ caseId }) {
  const { downloadPdf, loading, error, retry } = usePdfDownload(caseId);

  return (
    <div className="download-panel">
      <h3>Export Your Report</h3>

      <div className="download-options">
        <DownloadButton
          icon="pdf"
          label="Download PDF Report"
          description="Full analysis in PDF format"
          onClick={downloadPdf}
          loading={loading}
          error={error}
        />

        {error && (
          <ErrorMessage>
            PDF download failed. <Button onClick={retry}>Retry</Button>
          </ErrorMessage>
        )}

        <DownloadButton
          icon="letter"
          label="Download Demand Letter"
          description="Ready-to-send template"
          onClick={() => downloadDemandLetter(caseId)}
        />

        <DownloadButton
          icon="email"
          label="Email Report to Me"
          description="Send to your email"
          onClick={() => showEmailDialog()}
        />
      </div>
    </div>
  );
}
```

---

## Unified Intake Flow

### Current: 4 Separate Pages
```
Home → LeaseUpload → BasicInfo → Verification → Payment → ActionPlan
```

**Problems:**
- Context switching confusion
- State management complex
- Back navigation loses data
- Users don't understand progress

### Proposed: Tabbed Single-Page Intake

```
┌─────────────────────────────────────────────────────────────┐
│ DEPOSIT DEFENDER - Case Intake                             │
│                                                             │
│  [1. Upload Lease]  [2. Your Info]  [3. Case Details]      │
│   ─────────────     ─────────────   ─────────────          │
│      ACTIVE            TODO            TODO                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ STEP 1: Upload Lease (Optional)                    │   │
│  │                                                     │   │
│  │ Upload your lease for deeper analysis (optional)   │   │
│  │                                                     │   │
│  │  [Drag & drop PDF or image]                        │   │
│  │                                                     │   │
│  │  [ Skip this step ]      [ Next: Your Info → ]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Progress: ███░░░░░░░ 33%                                   │
└─────────────────────────────────────────────────────────────┘
```

**Component: `pages/Intake.js`**
```jsx
function IntakePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    leaseFile: null,
    basicInfo: {},
    caseDetails: {}
  });

  const steps = [
    { id: 1, label: 'Upload Lease', component: LeaseUploadStep, optional: true },
    { id: 2, label: 'Your Info', component: BasicInfoStep },
    { id: 3, label: 'Case Details', component: VerificationStep }
  ];

  return (
    <div className="intake-page">
      <h1>Deposit Defender - Case Intake</h1>

      <IntakeTabs
        steps={steps}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
      />

      <div className="step-content">
        {currentStep === 1 && (
          <LeaseUploadStep
            data={formData.leaseFile}
            onUpdate={(file) => updateForm('leaseFile', file)}
            onNext={() => setCurrentStep(2)}
            onSkip={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <BasicInfoStep
            data={formData.basicInfo}
            onUpdate={(info) => updateForm('basicInfo', info)}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <VerificationStep
            data={formData.caseDetails}
            leaseData={formData.leaseFile}
            basicInfo={formData.basicInfo}
            onUpdate={(details) => updateForm('caseDetails', details)}
            onSubmit={handleSubmitIntake}
            onBack={() => setCurrentStep(2)}
          />
        )}
      </div>

      <ProgressBar current={currentStep} total={steps.length} />
    </div>
  );
}
```

**Benefits:**
- All state in one component (easier management)
- Back/forward navigation preserves data
- Clear progress indicator
- Fewer route transitions = fewer bugs

---

## Mobile-First Design

### Responsive Breakpoints

```css
/* variables.css */
:root {
  --breakpoint-mobile: 375px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1440px;
}
```

### Mobile Layout Adjustments

**CaseStrengthCard (Mobile):**
```
┌──────────────────────────┐
│ YOUR CASE STRENGTH       │
│                          │
│       ┌───────┐          │
│       │   A   │          │
│       └───────┘          │
│      95 / 100            │
│                          │
│  Win Rate: 85%           │
│  Recovery: $1,600-$4,600 │
│                          │
│  ⚡ SEND DEMAND LETTER   │
│  (HIGH URGENCY)          │
│                          │
│  [Download PDF]          │
│  [Action Plan ↓]         │
└──────────────────────────┘
```

**Stack vertically on mobile:**
```css
@media (max-width: 768px) {
  .case-strength-card {
    flex-direction: column;
  }

  .metrics {
    grid-template-columns: 1fr; /* Stack metrics */
  }

  .action-steps {
    padding: 1rem; /* Reduce padding */
  }

  .leverage-point-card {
    margin-bottom: 1rem; /* More space between */
  }
}
```

---

## Download Flow Improvements

### Current Problem
```javascript
// Often fails with no retry
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `case-analysis-report-${caseId}.pdf`;
a.click();
```

### Improved: `hooks/usePdfDownload.js`

```javascript
import { useState } from 'react';

function usePdfDownload(caseId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const downloadPdf = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${caseId}`, {
        method: 'GET',
        credentials: 'include' // Include session cookie
      });

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error('Payment required. Please complete payment first.');
        }
        if (response.status === 404) {
          throw new Error('Report not found. Please try generating it again.');
        }
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Track download progress
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total) {
          setProgress((loaded / total) * 100);
        }
      }

      const blob = new Blob(chunks, { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposit-defender-report-${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      setProgress(100);
      setLoading(false);

    } catch (err) {
      console.error('PDF download error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const retry = () => {
    setError(null);
    downloadPdf();
  };

  return { downloadPdf, loading, error, progress, retry };
}

export default usePdfDownload;
```

**Usage:**
```jsx
const { downloadPdf, loading, error, progress, retry } = usePdfDownload(caseId);

return (
  <div>
    <button onClick={downloadPdf} disabled={loading}>
      {loading ? `Downloading... ${Math.round(progress)}%` : 'Download PDF'}
    </button>
    {error && (
      <div className="error">
        {error} <button onClick={retry}>Retry</button>
      </div>
    )}
  </div>
);
```

---

## Navigation Simplification

### Current Routes (Complex)
```
/ (Home)
/intake (LeaseUpload)
/intake/info (BasicInfo)
/intake/verify (Verification)
/action-plan/:caseId (Results)
/payment/process/:caseId (Payment loading)
/payment/success (Payment callback)
/how-it-works
/blog
/faq
```

### Proposed Routes (Simplified)
```
/ (Home)
/intake (Unified intake with tabs)
/report/:caseId (Results page - renamed from action-plan)
/payment/:caseId (Payment handling - combines process + success)
/about (Combines how-it-works, faq, etc.)
```

**Route File: `App.js`**
```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Intake from './pages/Intake';
import Report from './pages/Report';
import Payment from './pages/Payment';
import About from './pages/About';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/intake" element={<Intake />} />
        <Route path="/report/:caseId" element={<Report />} />
        <Route path="/payment/:caseId" element={<Payment />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

## Summary: UI Transformation

### Before
- 2,326-line monolithic App.js
- Unclear value hierarchy (leverage buried)
- 4-step intake flow (confusing)
- Fragile PDF downloads
- No mobile optimization

### After
- ~30 focused components (<150 lines each)
- 4-layer information architecture (Summary → Strategy → Deep Dive → Export)
- Tabbed single-page intake (smoother UX)
- Robust download with progress + retry
- Mobile-first responsive design

### Implementation Complexity
- **Refactor effort:** 3-5 days (break up App.js, create components)
- **New components:** 2-3 days (CaseStrengthCard, StrategyPanel, etc.)
- **Download improvements:** 1 day (usePdfDownload hook)
- **Testing:** 2-3 days

**Total:** ~10-14 days for complete UI overhaul

