const path = require('path');

const schema = require(path.join(
  __dirname,
  '..',
  '..',
  '..',
  'ai',
  'TX-SAFE INTAKE SCHEMA.json'
));

const ALLOWED_LEASE_TYPES = ['written', 'oral', 'unknown'];
const ALLOWED_YES_NO_UNKNOWN = ['yes', 'no', 'unknown'];
const ALLOWED_DEPOSIT_RETURNED = ['yes', 'no', 'partial'];
const ALLOWED_COMM_METHODS = ['email', 'mail', 'text', 'phone', 'certified mail', 'in person', 'other'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function validateEnum(errors, path, value, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    addError(errors, path, `Expected one of: ${allowed.join(', ')}`);
  }
}

function validateString(errors, path, value) {
  if (typeof value !== 'string') {
    addError(errors, path, 'Expected a string value');
  }
}

function validateEmail(errors, path, value) {
  if (typeof value !== 'string') {
    addError(errors, path, 'Expected a string value');
    return;
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    addError(errors, path, 'Invalid email format');
    return;
  }

  // Additional sanity checks
  if (value.length > 254) {
    addError(errors, path, 'Email address too long');
  }
}

function validateDate(errors, path, value, label = 'Date') {
  if (typeof value !== 'string' || !value) {
    addError(errors, path, `${label} is required`);
    return null;
  }

  // Check format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    addError(errors, path, `${label} must be in YYYY-MM-DD format`);
    return null;
  }

  // Validate it's a real date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    addError(errors, path, `Invalid ${label}`);
    return null;
  }

  // Sanity check year range
  const year = date.getFullYear();
  if (year < 2000 || year > 2030) {
    addError(errors, path, `${label} year seems incorrect (${year})`);
    return null;
  }

  return date;
}

function validateAmount(errors, path, value, label = 'Amount') {
  if (!value) return; // Optional

  // Remove common formatting characters
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) {
    addError(errors, path, `${label} must be a valid number`);
    return;
  }

  if (num < 0) {
    addError(errors, path, `${label} cannot be negative`);
  }

  if (num > 1000000) {
    addError(errors, path, `${label} seems unusually high`);
  }
}

function validateOptionalString(errors, path, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  validateString(errors, path, value);
}

function validateArrayOfEnums(errors, path, value, allowed) {
  if (!Array.isArray(value)) {
    addError(errors, path, 'Expected an array');
    return;
  }
  const invalid = value.filter((item) => !allowed.includes(item));
  if (invalid.length > 0) {
    addError(
      errors,
      path,
      `Only these values are allowed: ${allowed.join(', ')}`
    );
  }
}

function validateIntake(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return { valid: false, errors: [{ path: 'root', message: 'Invalid data' }] };
  }

  if (payload.jurisdiction !== schema.jurisdiction) {
    addError(errors, 'jurisdiction', 'Texas-only service');
  }

  const acknowledgements = payload.acknowledgements;
  if (!isPlainObject(acknowledgements)) {
    addError(errors, 'acknowledgements', 'Required');
  } else {
    if (acknowledgements.texas_only_confirmation !== true) {
      addError(errors, 'acknowledgements.texas_only_confirmation', 'Required');
    }
    if (acknowledgements.non_legal_service_acknowledged !== true) {
      addError(errors, 'acknowledgements.non_legal_service_acknowledged', 'Required');
    }
  }

  const tenantInformation = payload.tenant_information;
  if (!isPlainObject(tenantInformation)) {
    addError(errors, 'tenant_information', 'Required');
  } else {
    validateString(errors, 'tenant_information.full_name', tenantInformation.full_name);
    validateEmail(errors, 'tenant_information.email', tenantInformation.email);
    validateOptionalString(errors, 'tenant_information.phone', tenantInformation.phone);
  }

  const propertyInformation = payload.property_information;
  if (!isPlainObject(propertyInformation)) {
    addError(errors, 'property_information', 'Required');
  } else {
    validateString(errors, 'property_information.property_address', propertyInformation.property_address);
    validateString(errors, 'property_information.city', propertyInformation.city);
    validateString(errors, 'property_information.zip_code', propertyInformation.zip_code);
    validateString(errors, 'property_information.county', propertyInformation.county);
  }

  const leaseInformation = payload.lease_information;
  if (!isPlainObject(leaseInformation)) {
    addError(errors, 'lease_information', 'Required');
  } else {
    // Lease dates are optional in the form — only validate format/range if provided
    const leaseStart = leaseInformation.lease_start_date
      ? validateDate(errors, 'lease_information.lease_start_date', leaseInformation.lease_start_date, 'Lease start date')
      : null;
    const leaseEnd = leaseInformation.lease_end_date
      ? validateDate(errors, 'lease_information.lease_end_date', leaseInformation.lease_end_date, 'Lease end date')
      : null;
    validateEnum(errors, 'lease_information.lease_type', leaseInformation.lease_type, ALLOWED_LEASE_TYPES);

    // Cross-field validation: lease end must be after lease start (only when both are provided)
    if (leaseStart && leaseEnd && leaseEnd <= leaseStart) {
      addError(errors, 'lease_information.lease_end_date', 'Lease end date must be after lease start date');
    }
  }

  const moveOutInformation = payload.move_out_information;
  if (!isPlainObject(moveOutInformation)) {
    addError(errors, 'move_out_information', 'Required');
  } else {
    const moveOutDate = validateDate(errors, 'move_out_information.move_out_date', moveOutInformation.move_out_date, 'Move-out date');
    validateEnum(
      errors,
      'move_out_information.forwarding_address_provided',
      moveOutInformation.forwarding_address_provided,
      ALLOWED_YES_NO_UNKNOWN
    );

    // Validate forwarding address date if provided
    if (moveOutInformation.forwarding_address_date) {
      validateDate(errors, 'move_out_information.forwarding_address_date', moveOutInformation.forwarding_address_date, 'Forwarding address date');
    }
  }

  const securityDepositInformation = payload.security_deposit_information;
  if (!isPlainObject(securityDepositInformation)) {
    addError(errors, 'security_deposit_information', 'Required');
  } else {
    validateAmount(errors, 'security_deposit_information.deposit_amount', securityDepositInformation.deposit_amount, 'Deposit amount');

    if (securityDepositInformation.deposit_paid_date) {
      validateDate(errors, 'security_deposit_information.deposit_paid_date', securityDepositInformation.deposit_paid_date, 'Deposit paid date');
    }

    validateEnum(
      errors,
      'security_deposit_information.deposit_returned',
      securityDepositInformation.deposit_returned,
      ALLOWED_DEPOSIT_RETURNED
    );

    if (securityDepositInformation.amount_returned) {
      validateAmount(errors, 'security_deposit_information.amount_returned', securityDepositInformation.amount_returned, 'Amount returned');
    }
  }

  const communications = payload.post_move_out_communications;
  if (!isPlainObject(communications)) {
    addError(errors, 'post_move_out_communications', 'Required');
  } else {
    validateEnum(
      errors,
      'post_move_out_communications.itemized_deductions_received',
      communications.itemized_deductions_received,
      ALLOWED_YES_NO_UNKNOWN
    );

    if (communications.date_itemized_list_received) {
      validateDate(errors, 'post_move_out_communications.date_itemized_list_received', communications.date_itemized_list_received, 'Date itemized list received');
    }

    validateArrayOfEnums(
      errors,
      'post_move_out_communications.communication_methods_used',
      communications.communication_methods_used,
      ALLOWED_COMM_METHODS
    );
  }

  const notes = payload.additional_notes;
  if (!isPlainObject(notes)) {
    addError(errors, 'additional_notes', 'Required');
  } else {
    validateOptionalString(errors, 'additional_notes.tenant_notes', notes.tenant_notes);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateIntake,
};
