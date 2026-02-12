// server/scripts/runCaseAnalysis.cjs
//
// CLI harness for running CaseAnalysisService on a fixture or intake JSON.
//
// Usage:
//   node server/scripts/runCaseAnalysis.cjs <path-to-case-json>
//
// Example:
//   node server/scripts/runCaseAnalysis.cjs server/test-fixtures/cases/missed-deadline-no-itemization.json

const fs = require("fs");
const path = require("path");

const {
  buildCaseAnalysisReport,
  validateReport
} = require("../src/lib/CaseAnalysisService");

// ─────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────
const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node server/scripts/runCaseAnalysis.cjs <path-to-case-json>");
  console.error("");
  console.error("Examples:");
  console.error("  node server/scripts/runCaseAnalysis.cjs server/test-fixtures/cases/missed-deadline-no-itemization.json");
  console.error("  node server/scripts/runCaseAnalysis.cjs fixtures/my-case.json");
  process.exit(1);
}

// ─────────────────────────────────────────────
// Load fixture
// ─────────────────────────────────────────────
const absolutePath = path.resolve(inputPath);
if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(absolutePath, "utf8");
let fixture;
try {
  fixture = JSON.parse(raw);
} catch (err) {
  console.error(`Invalid JSON: ${err.message}`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// Normalize fixture to expected intake shape
// ─────────────────────────────────────────────
// Fixtures may use simplified field names. This normalizer
// maps them to the canonical intake schema used by CaseAnalysisService.

function normalizeFixtureToIntake(fixture) {
  // If fixture already has the canonical structure, use it directly
  if (fixture.security_deposit_information) {
    return fixture;
  }

  // Support multiple fixture formats:
  // Format A: deposit_information, move_out_information, property_information
  // Format B: deposit, tenancy, property, tenant
  const deposit = fixture.deposit_information || fixture.deposit || {};
  const forwarding = fixture.forwarding_address_information || {};
  const moveOut = fixture.move_out_information || fixture.tenancy || {};
  const property = fixture.property_information || fixture.property || {};
  const lease = fixture.lease_information || fixture.lease || {};
  const correspondence = fixture.correspondence_information || fixture.correspondence || {};
  const tenant = fixture.tenant || {};

  // Parse deposit_returned: fixture uses boolean/number, intake uses "yes"/"no"/"partial"
  let depositReturned = "no";
  const depositAmount = parseFloat(String(deposit.deposit_amount || deposit.amount || 0));
  const returnedAmount = parseFloat(String(deposit.returned_amount || 0));
  if (returnedAmount > 0) {
    if (returnedAmount >= depositAmount) {
      depositReturned = "yes";
    } else {
      depositReturned = "partial";
    }
  }

  // Get forwarding address info from tenant or forwarding object
  const forwardingProvided = tenant.forwarding_address_provided ?? forwarding.provided ?? false;
  const forwardingDate = tenant.forwarding_address_date || forwarding.provided_date || null;

  return {
    case_id: fixture.case_id || null,
    jurisdiction: fixture.jurisdiction || "TX",

    tenant_information: {
      full_name: tenant.name || fixture.tenant_name || "Test Tenant",
      email: tenant.email || fixture.tenant_email || "test@example.com",
      phone: tenant.phone || fixture.tenant_phone || null
    },

    property_information: {
      property_address: property.address || "",
      city: property.city || "",
      zip_code: property.zip_code || "",
      county: property.county || ""
    },

    lease_information: {
      lease_start_date: lease.start_date || null,
      lease_end_date: lease.end_date || null,
      lease_type: lease.type || "written"
    },

    move_out_information: {
      move_out_date: moveOut.move_out_date || moveOut.surrender_date || null,
      forwarding_address_provided: forwardingProvided ? "yes" : "no",
      forwarding_address_date: forwardingDate
    },

    security_deposit_information: {
      deposit_amount: String(deposit.deposit_amount || deposit.amount || ""),
      deposit_paid_date: deposit.paid_date || null,
      deposit_returned: depositReturned,
      amount_returned: String(deposit.returned_amount || "")
    },

    post_move_out_communications: {
      itemized_deductions_received: deposit.itemized_deductions_provided ? "yes" : "no",
      date_itemized_list_received: deposit.itemized_date || null,
      communication_methods_used: correspondence.methods || []
    },

    additional_notes: {
      tenant_notes: fixture.notes || ""
    },

    acknowledgements: {
      texas_only_confirmation: true,
      non_legal_service_acknowledged: true
    }
  };
}

// ─────────────────────────────────────────────
// Build case data object
// ─────────────────────────────────────────────
const intake = normalizeFixtureToIntake(fixture);
const leaseText = fixture.lease_information?.lease_text
  || fixture.lease?.text
  || fixture.lease_text
  || "";

const caseData = {
  intake,
  leaseText
};

// ─────────────────────────────────────────────
// Run analysis
// ─────────────────────────────────────────────
try {
  console.log("=== CASE DATA INPUT ===");
  console.log(JSON.stringify(caseData, null, 2));
  console.log("");

  const report = buildCaseAnalysisReport(caseData);

  console.log("=== CASE ANALYSIS REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log("");

  // Validate
  const validation = validateReport(report);
  if (!validation.valid) {
    console.warn("⚠️ Report validation warnings:", validation.errors);
  } else {
    console.log("✅ Report structure valid");
  }

  // Summary
  if (!report.leverage_points || report.leverage_points.length === 0) {
    console.warn("⚠️ WARNING: No leverage points detected");
  } else {
    console.log(`✅ ${report.leverage_points.length} leverage point(s) detected`);
    report.leverage_points.forEach((lp, i) => {
      console.log(`   ${i + 1}. [${lp.severity || "?"}] ${lp.title || lp.issue_id}`);
    });
  }

  if (report.lease_clause_citations && report.lease_clause_citations.length > 0) {
    console.log(`✅ ${report.lease_clause_citations.length} lease clause(s) indexed`);
  }

  console.log("");
  console.log("Timeline:", report.timeline);
  console.log("Compliance:", report.compliance_checklist);

} catch (err) {
  console.error("❌ Analysis failed:");
  console.error(err);
  process.exit(1);
}
