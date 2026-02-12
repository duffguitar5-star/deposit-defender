/**
 * Clause Patterns for Lease Text Indexing
 *
 * This module defines keyword sets and heading patterns for each clause type.
 * Used by leaseClauseIndexer.js for deterministic clause extraction.
 *
 * IMPORTANT: This is indexing only. No legal interpretation or analysis.
 */

/**
 * Clause type enumeration
 */
const CLAUSE_TYPES = {
  SECURITY_DEPOSIT: 'security_deposit',
  DEDUCTIONS: 'deductions',
  CLEANING: 'cleaning',
  REPAIRS: 'repairs',
  NORMAL_WEAR_AND_TEAR: 'normal_wear_and_tear',
  MOVE_OUT: 'move_out',
  SURRENDER: 'surrender',
  NOTICE: 'notice',
  FORWARDING_ADDRESS: 'forwarding_address',
  DAMAGES: 'damages',
  CARPET_PAINTING: 'carpet_painting',
  FEES_OR_CHARGES: 'fees_or_charges',
};

/**
 * Pattern definitions for each clause type.
 *
 * Structure:
 * - headingPatterns: Regex patterns that match section headers (high confidence)
 * - primaryKeywords: Keywords that strongly indicate this clause type
 * - secondaryKeywords: Supporting keywords that increase confidence when combined
 * - exclusionKeywords: Keywords that suggest a different clause type (reduce confidence)
 * - minKeywordMatches: Minimum primary keywords needed for a match
 */
const CLAUSE_PATTERNS = {
  [CLAUSE_TYPES.SECURITY_DEPOSIT]: {
    headingPatterns: [
      /\b(?:security\s+deposit|deposit\s+agreement|deposit\s+terms)\b/i,
      /^\s*(?:\d+\.?\s*)?security\s+deposit\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*security\s+deposit/im,
    ],
    primaryKeywords: [
      'security deposit',
      'deposit amount',
      'refundable deposit',
      'deposit shall',
      'deposit will',
      'return of deposit',
      'deposit refund',
    ],
    secondaryKeywords: [
      'deposit',
      'refund',
      'return',
      'thirty days',
      '30 days',
      'landlord shall',
    ],
    exclusionKeywords: ['pet deposit', 'application deposit', 'key deposit'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.DEDUCTIONS]: {
    headingPatterns: [
      /\b(?:deductions?|itemized\s+(?:list|deductions?))\b/i,
      /^\s*(?:\d+\.?\s*)?deductions?\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*deductions?/im,
    ],
    primaryKeywords: [
      'deduct',
      'deduction',
      'deducted from',
      'itemized list',
      'itemized statement',
      'itemization',
      'withheld for',
      'retain for',
    ],
    secondaryKeywords: [
      'amount owed',
      'unpaid rent',
      'charges',
      'costs incurred',
      'subtract',
    ],
    exclusionKeywords: ['tax deduction'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.CLEANING]: {
    headingPatterns: [
      /\b(?:cleaning|cleanliness|clean\s+condition)\b/i,
      /^\s*(?:\d+\.?\s*)?cleaning\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*cleaning/im,
    ],
    primaryKeywords: [
      'cleaning fee',
      'professional cleaning',
      'professionally cleaned',
      'cleaning cost',
      'cleaning charge',
      'steam clean',
      'carpet cleaning',
      'move-out cleaning',
      'clean condition',
      'broom clean',
      'broom-clean',
    ],
    secondaryKeywords: [
      'clean',
      'cleaned',
      'cleanliness',
      'sanitary',
      'spotless',
      'vacuumed',
    ],
    exclusionKeywords: [],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.REPAIRS]: {
    headingPatterns: [
      /\b(?:repairs?|maintenance|tenant\s+repairs?)\b/i,
      /^\s*(?:\d+\.?\s*)?(?:repairs?|maintenance)\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*(?:repairs?|maintenance)/im,
    ],
    primaryKeywords: [
      'repair cost',
      'repair charge',
      'cost of repair',
      'tenant shall repair',
      'responsible for repairs',
      'repair obligation',
      'maintenance and repair',
      'fix at tenant',
    ],
    secondaryKeywords: [
      'repair',
      'repairs',
      'fix',
      'restore',
      'maintenance',
      'broken',
      'damaged',
    ],
    exclusionKeywords: ['landlord shall repair', 'landlord repair'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.NORMAL_WEAR_AND_TEAR]: {
    headingPatterns: [
      /\b(?:normal\s+wear|wear\s+and\s+tear|ordinary\s+wear)\b/i,
      /^\s*(?:\d+\.?\s*)?(?:normal\s+)?wear\s+and\s+tear\s*[:.]?\s*$/im,
    ],
    primaryKeywords: [
      'normal wear and tear',
      'ordinary wear and tear',
      'reasonable wear',
      'normal use',
      'ordinary use',
      'wear and tear excepted',
      'excepting normal wear',
      'excluding normal wear',
    ],
    secondaryKeywords: [
      'wear',
      'tear',
      'deterioration',
      'aging',
      'expected use',
    ],
    exclusionKeywords: [],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.MOVE_OUT]: {
    headingPatterns: [
      /\b(?:move[- ]?out|vacating|end\s+of\s+(?:lease|tenancy)|termination\s+of\s+(?:lease|tenancy))\b/i,
      /^\s*(?:\d+\.?\s*)?move[- ]?out\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*(?:move[- ]?out|vacating)/im,
    ],
    primaryKeywords: [
      'move-out',
      'move out',
      'moving out',
      'vacate the premises',
      'vacating the',
      'upon vacating',
      'at move-out',
      'end of lease',
      'end of tenancy',
      'termination of tenancy',
      'lease termination',
    ],
    secondaryKeywords: [
      'vacate',
      'leave',
      'departure',
      'final',
      'last day',
      'expiration',
    ],
    exclusionKeywords: ['move-in', 'move in'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.SURRENDER]: {
    headingPatterns: [
      /\b(?:surrender|return\s+of\s+(?:premises|property|keys?))\b/i,
      /^\s*(?:\d+\.?\s*)?surrender\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*surrender/im,
    ],
    primaryKeywords: [
      'surrender of premises',
      'surrender the premises',
      'surrender of property',
      'return all keys',
      'return keys',
      'keys returned',
      'tenant shall surrender',
      'upon surrender',
      'condition upon surrender',
    ],
    secondaryKeywords: [
      'surrender',
      'relinquish',
      'hand over',
      'return possession',
      'keys',
      'access devices',
      'garage opener',
    ],
    exclusionKeywords: [],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.NOTICE]: {
    headingPatterns: [
      /\b(?:notice|notification|written\s+notice)\b/i,
      /^\s*(?:\d+\.?\s*)?notice\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*notice/im,
    ],
    primaryKeywords: [
      'written notice',
      'notice to vacate',
      'notice period',
      'days notice',
      'day notice',
      'advance notice',
      'prior notice',
      'notice shall be',
      'notice must be',
      'provide notice',
      'give notice',
    ],
    secondaryKeywords: [
      'notice',
      'notify',
      'notification',
      'inform',
      'writing',
    ],
    exclusionKeywords: [],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.FORWARDING_ADDRESS]: {
    headingPatterns: [
      /\b(?:forwarding\s+address|new\s+address|address\s+for\s+(?:refund|deposit))\b/i,
      /^\s*(?:\d+\.?\s*)?forwarding\s+address\s*[:.]?\s*$/im,
    ],
    primaryKeywords: [
      'forwarding address',
      'new address',
      'forward address',
      'address for refund',
      'address for deposit',
      'provide address',
      'tenant shall provide',
      'mailing address',
      'written address',
    ],
    secondaryKeywords: [
      'address',
      'forward',
      'mail',
      'send to',
      'contact information',
    ],
    exclusionKeywords: ['property address', 'premises address'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.DAMAGES]: {
    headingPatterns: [
      /\b(?:damages?|damage\s+to\s+(?:premises|property)|property\s+damage)\b/i,
      /^\s*(?:\d+\.?\s*)?damages?\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*damages?/im,
    ],
    primaryKeywords: [
      'damage to premises',
      'damage to property',
      'property damage',
      'damages caused',
      'tenant damage',
      'damage beyond',
      'damage exceeding',
      'liable for damage',
      'responsible for damage',
      'cost of damage',
    ],
    secondaryKeywords: [
      'damage',
      'damages',
      'broken',
      'destroyed',
      'harm',
      'injury to property',
    ],
    exclusionKeywords: ['security deposit damage', 'liquidated damages'],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.CARPET_PAINTING]: {
    headingPatterns: [
      /\b(?:carpet|flooring|paint(?:ing)?|walls?|floor\s+covering)\b/i,
      /^\s*(?:\d+\.?\s*)?(?:carpet|paint(?:ing)?|flooring)\s*[:.]?\s*$/im,
    ],
    primaryKeywords: [
      'carpet replacement',
      'carpet cleaning',
      'carpet damage',
      'carpet stain',
      'replace carpet',
      'painting',
      'repaint',
      'paint walls',
      'wall damage',
      'flooring',
      'floor covering',
      'hardwood floor',
      'tile floor',
    ],
    secondaryKeywords: [
      'carpet',
      'paint',
      'walls',
      'floor',
      'stain',
      'holes',
      'nail holes',
    ],
    exclusionKeywords: [],
    minKeywordMatches: 1,
  },

  [CLAUSE_TYPES.FEES_OR_CHARGES]: {
    headingPatterns: [
      /\b(?:fees?|charges?|additional\s+(?:fees?|charges?)|late\s+fee)\b/i,
      /^\s*(?:\d+\.?\s*)?(?:fees?|charges?)\s*[:.]?\s*$/im,
      /^\s*(?:section|article|paragraph)\s+\d+[.:]\s*(?:fees?|charges?)/im,
    ],
    primaryKeywords: [
      'fee',
      'fees',
      'charge',
      'charges',
      'late fee',
      'administrative fee',
      'processing fee',
      'service charge',
      'additional charge',
      'penalty',
      'fine',
    ],
    secondaryKeywords: [
      'cost',
      'payment',
      'amount due',
      'owed',
    ],
    exclusionKeywords: ['no fee', 'fee waived', 'without charge'],
    minKeywordMatches: 1,
  },
};

/**
 * Sentence boundary patterns for excerpt extraction
 */
const SENTENCE_PATTERNS = {
  // Match sentence endings
  sentenceEnd: /[.!?](?:\s|$)/g,
  // Match paragraph breaks
  paragraphBreak: /\n\s*\n/g,
  // Match section/numbered list items
  listItem: /^\s*(?:\d+\.|\([a-z]\)|\([0-9]+\)|[a-z]\.|•|[-–—])\s*/im,
};

/**
 * Heading detection patterns (for confidence scoring)
 */
const HEADING_INDICATORS = [
  // Numbered sections
  /^\s*(?:section|article|paragraph)\s+\d+/i,
  /^\s*\d+\.\s+[A-Z]/,
  /^\s*\([a-z0-9]+\)\s+[A-Z]/,
  // ALL CAPS headings
  /^[A-Z][A-Z\s]{3,}$/,
  // Title case followed by colon
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*:/,
  // Bold/underline indicators (from OCR artifacts)
  /^_{2,}.*_{2,}$/,
  /^\*{2,}.*\*{2,}$/,
];

/**
 * Common lease section delimiters
 */
const SECTION_DELIMITERS = [
  /\n\s*(?:section|article|paragraph)\s+\d+[.:]/gi,
  /\n\s*\d+\.\s+[A-Z][A-Z\s]+/g,
  /\n\s*[A-Z][A-Z\s]{5,}(?:\n|:)/g,
];

module.exports = {
  CLAUSE_TYPES,
  CLAUSE_PATTERNS,
  SENTENCE_PATTERNS,
  HEADING_INDICATORS,
  SECTION_DELIMITERS,
};
