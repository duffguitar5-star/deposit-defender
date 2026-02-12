const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { validateIntake } = require('../lib/intakeValidation');
const { saveCase, getCase, updateCaseLeaseData } = require('../lib/caseStore');
const {
  extractTextFromImage,
  extractTextFromPdf,
  extractTextFromPdfOcr,
} = require('../lib/leaseExtraction');
const { associateCaseWithSession, requireCaseOwnership } = require('../middleware/sessionAuth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Magic byte signatures for file type validation
const FILE_SIGNATURES = {
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  png: Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG
  jpg: Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
};

/**
 * Validate file type by checking magic bytes (file signature)
 * Prevents MIME type spoofing attacks
 */
function validateFileType(buffer, declaredMimetype) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  if (declaredMimetype === 'application/pdf') {
    return buffer.slice(0, 4).equals(FILE_SIGNATURES.pdf);
  } else if (declaredMimetype === 'image/png') {
    return buffer.slice(0, 4).equals(FILE_SIGNATURES.png);
  } else if (declaredMimetype.includes('jpeg') || declaredMimetype.includes('jpg')) {
    return buffer.slice(0, 3).equals(FILE_SIGNATURES.jpg);
  }

  return false;
}

const TOPIC_DEFINITIONS = [
  {
    key: 'security_deposit',
    label: 'Security deposit',
    keywords: [
      'security deposit',
      'securitydeposit',
      'deposit amount',
      'deposit is',
      'deposit of',
      'refundable',
      'damage deposit',
      'pet deposit',
      'deposit paid',
      'deposit will',
      'deposit shall',
      'security-deposit',
      'securitydeposit amount',
    ],
    summary:
      'The lease text references security deposits and includes language about deposits.',
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    keywords: ['cleaning', 'clean', 'cleaned', 'carpet', 'janitorial'],
    summary:
      'The lease text references cleaning and includes language about cleaning expectations.',
  },
  {
    key: 'damage',
    label: 'Damage',
    keywords: ['damage', 'damages', 'repair', 'repairs', 'wear and tear'],
    summary:
      'The lease text references damage and includes language about damage-related terms.',
  },
  {
    key: 'move_out',
    label: 'Move-out obligations',
    keywords: ['move out', 'move-out', 'moveout', 'vacate', 'surrender', 'keys', 'forwarding address'],
    summary:
      'The lease text references move-out steps and includes language about move-out expectations.',
  },
];

function extractTextFromBuffer(buffer) {
  const utf8Text = buffer.toString('utf8');
  const cleaned = utf8Text.replace(/[^ -~\n\r\t]+/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

function getLeaseExtractionErrorMessage(error, isImage, fileSize) {
  const errorMsg = error && error.message ? error.message.toLowerCase() : '';

  // Check for common error patterns
  if (errorMsg.includes('invalid pdf') || errorMsg.includes('corrupted') || errorMsg.includes('damaged')) {
    return 'The file appears to be corrupted or damaged. Please try uploading a different copy of your lease.';
  }

  if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
    return 'This PDF is password-protected. Please remove the password protection and try again.';
  }

  if (errorMsg.includes('memory') || errorMsg.includes('heap')) {
    return 'The file is too large or complex to process. Try uploading a smaller version or only the relevant pages.';
  }

  if (isImage) {
    if (errorMsg.includes('recognize') || errorMsg.includes('tesseract')) {
      return 'Unable to read text from this image. The image quality may be too low. Try uploading a clearer photo or scan.';
    }
    return 'Unable to extract text from this image. Please ensure the image is clear and the text is legible, then try again.';
  }

  // PDF-specific fallback
  if (errorMsg.includes('rendering') || errorMsg.includes('canvas')) {
    return 'Unable to render this PDF. The file format may not be supported. Try saving it in a different PDF format and uploading again.';
  }

  // Generic fallback
  return 'Unable to process this file right now. Please verify the file is a valid PDF or image, then try again.';
}

function extractStructuredData(text, sections) {
  if (!text || text.trim().length < 20) {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  const extracted = {};

  // Extract security deposit amount - prefer the value from sections if available
  if (sections && sections.length > 0) {
    const depositSection = sections.find(s => s.topic === 'Security deposit');
    if (depositSection && depositSection.excerpts && depositSection.excerpts.length > 0) {
      // Use the first excerpt which should contain the deposit amount
      const amountMatch = depositSection.excerpts[0].match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
      if (amountMatch) {
        extracted.deposit_amount = amountMatch[0].replace(/\s+/g, '');
      }
    }
  }

  // Fallback: try to extract from full text if not found in sections
  if (!extracted.deposit_amount) {
    const depositPatterns = [
      /security\s*deposit[:\s]+(?:amount[:\s]+)?(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      /deposit[:\s]+(?:amount[:\s]+)?(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    ];

    for (const pattern of depositPatterns) {
      const match = pattern.exec(normalized);
      if (match && match[1]) {
        let amount = match[1].replace(/\s+/g, '').trim();
        extracted.deposit_amount = amount;
        break;
      }
    }
  }

  // Extract property address - look for street address patterns (more flexible)
  const addressPatterns = [
    // Standard labeled patterns
    /(?:property\s*(?:address)?|premises|leased\s*premises|rental\s*property|the\s*property)[:\s]+([0-9]+[A-Za-z0-9\s#.,'/-]+?)(?:,\s*[A-Z][a-z]+|$|\n)/gi,
    /(?:located\s+at|address\s*(?:is)?|residing\s+at)[:\s]+([0-9]+[A-Za-z0-9\s#.,'/-]+?)(?:,\s*[A-Z][a-z]+|$|\n)/gi,
    // Street address with common suffixes
    /\b([0-9]+\s+[A-Za-z0-9\s#.'-]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Trail|Trl)\.?\s*(?:#?\s*\d+)?)/gi,
    // Any address starting with numbers followed by words before a comma
    /\b([0-9]+\s+[A-Za-z][A-Za-z\s]+?)\s*,\s*[A-Z][a-z]+\s*,?\s*(?:TX|Texas)/gi,
  ];

  for (const pattern of addressPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      let addr = match[1].trim();
      // Clean up common artifacts
      addr = addr.replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
      if (addr.length > 5 && addr.length < 150 && /^\d/.test(addr)) {
        extracted.property_address = addr;
        break;
      }
    }
  }

  // Extract city, state, zip - look for standard address format (more flexible)
  const cityStateZipPatterns = [
    /,\s*([A-Za-z][A-Za-z\s]{1,30}),\s*(?:TX|Texas)\s*(\d{5}(?:-\d{4})?)/gi,
    /([A-Za-z][A-Za-z\s]{1,30}),\s*(?:TX|Texas)\s*(\d{5}(?:-\d{4})?)/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*TX\s*(\d{5})/gi,
  ];

  for (const pattern of cityStateZipPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1] && match[2]) {
      const city = match[1].trim();
      // Avoid matching common non-city words
      if (city.length >= 3 && !['the', 'and', 'for', 'that', 'this'].includes(city.toLowerCase())) {
        extracted.city = city;
        extracted.zip_code = match[2].trim();
        break;
      }
    }
  }

  // Extract lease dates - look for various date formats and contexts (more flexible)
  // First, find ALL dates in the document
  const allDatesPattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
  const allWrittenDatesPattern = /\b([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})\b/g;

  const allDates = [];
  let dateMatch;
  while ((dateMatch = allDatesPattern.exec(normalized)) !== null) {
    const parsed = normalizeDate(dateMatch[1]);
    if (parsed) allDates.push({ raw: dateMatch[1], parsed, index: dateMatch.index });
  }
  while ((dateMatch = allWrittenDatesPattern.exec(text)) !== null) {
    const parsed = normalizeDate(dateMatch[1]);
    if (parsed) allDates.push({ raw: dateMatch[1], parsed, index: dateMatch.index });
  }

  console.log('Found dates in lease:', allDates.map(d => d.raw));

  // Try specific patterns first for start date
  const startDatePatterns = [
    /(?:lease|term|rental)\s*(?:period|term|begins?|commences?|start)[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:commence|begin|start)(?:s|ing)?[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:effective|starting)\s*(?:date)?[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /from[:\s]+([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})\s*(?:to|through|until|-)/gi,
    /(?:commence|begin|start|effective|from)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:lease|term)\s*(?:date|start)[:\s]+(\d{4}[\/\-]\d{2}[\/\-]\d{2})/gi,
    // More flexible: "start date" followed by date anywhere
    /start\s*date[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /begin(?:ning)?\s*date[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
  ];

  for (const pattern of startDatePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const parsedDate = normalizeDate(match[1]);
      if (parsedDate && parsedDate.length === 10) {
        extracted.lease_start_date = parsedDate;
        console.log('Matched start date:', match[1], '->', parsedDate);
        break;
      }
    }
  }

  // If no start date found, use first date in document as fallback
  if (!extracted.lease_start_date && allDates.length > 0) {
    extracted.lease_start_date = allDates[0].parsed;
    console.log('Using first date as start date:', allDates[0].raw);
  }

  const endDatePatterns = [
    /(?:to|through|until|thru|ending)[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:end|expir|terminat)[a-z]*[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:ending|expiring|expires?)\s*(?:on|date)?[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:to|through|until|ending|expires?)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:lease|term)\s*(?:end|expir)[a-z]*[:\s]+(\d{4}[\/\-]\d{2}[\/\-]\d{2})/gi,
    // More flexible
    /end\s*date[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /expir(?:ation|es?)?\s*date[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
  ];

  for (const pattern of endDatePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const parsedDate = normalizeDate(match[1]);
      if (parsedDate && parsedDate.length === 10) {
        extracted.lease_end_date = parsedDate;
        console.log('Matched end date:', match[1], '->', parsedDate);
        break;
      }
    }
  }

  // If no end date found but we have multiple dates, use second date as fallback
  if (!extracted.lease_end_date && allDates.length > 1) {
    extracted.lease_end_date = allDates[1].parsed;
    console.log('Using second date as end date:', allDates[1].raw);
  }

  // Extract tenant name - be very conservative to avoid false matches
  const tenantPatterns = [
    /(?:tenant|lessee)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:,|\(|$)/gi,
    /between[^,]{0,50}and[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\(/gi,
  ];

  for (const pattern of tenantPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const name = match[1].trim();
      // Strict validation: no common words, reasonable length
      const commonWords = ['agrees', 'shall', 'must', 'will', 'landlord', 'owner', 'manager', 'property'];
      const hasCommonWord = commonWords.some(word => name.toLowerCase().includes(word));

      if (!hasCommonWord && name.length >= 5 && name.length <= 50 && name.split(/\s+/).length >= 2) {
        extracted.tenant_name = name;
        break;
      }
    }
  }

  // Extract landlord/property manager name
  const landlordNamePatterns = [
    /(?:landlord|lessor|owner|property\s*manager)[:\s]+([A-Z][A-Za-z\s.,'&-]+?)(?:\s*,|\s*\(|\s*whose|\s*located|\s*at|\s*address|$)/gi,
    /(?:landlord|lessor|owner)[:\s]*["']?([A-Z][A-Za-z\s.,'&-]+?)["']?\s*(?:,|\(|and|whose)/gi,
    /between\s+([A-Z][A-Za-z\s.,'&-]+?)\s*(?:,|\()?\s*(?:hereinafter|as|the)?\s*["']?(?:landlord|lessor|owner)/gi,
    /([A-Z][A-Za-z\s.,'&-]+?)\s*(?:,\s*)?(?:hereinafter|referred\s+to\s+as)?\s*["']?(?:landlord|lessor|owner)["']?/gi,
  ];

  for (const pattern of landlordNamePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      let name = match[1].trim();
      // Clean up the name
      name = name.replace(/[,;:]+$/, '').trim();
      name = name.replace(/^["']+|["']+$/g, '').trim();

      // Validation
      const invalidWords = ['agrees', 'shall', 'must', 'will', 'tenant', 'lessee', 'this', 'the', 'agreement'];
      const hasInvalidWord = invalidWords.some(word => name.toLowerCase() === word || name.toLowerCase().startsWith(word + ' '));

      if (!hasInvalidWord && name.length >= 3 && name.length <= 100) {
        extracted.landlord_name = name;
        break;
      }
    }
  }

  // Extract landlord address - look for address near landlord mentions
  const landlordAddressPatterns = [
    /(?:landlord|lessor|owner|management)[^.]*?(?:address|located\s+at)[:\s]+([0-9]+\s+[A-Za-z0-9\s#.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Suite|Ste|Unit|#)[^,\n]*)/gi,
    /(?:send|mail|notice)[^.]*?(?:landlord|lessor|owner)[^.]*?(?:to|at)[:\s]+([0-9]+\s+[A-Za-z0-9\s#.'-]+)/gi,
    /(?:landlord|lessor|owner)[^.]*?([0-9]+\s+[A-Za-z0-9\s#.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)[^,\n]*)/gi,
  ];

  for (const pattern of landlordAddressPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      let addr = match[1].trim();
      addr = addr.replace(/\s+/g, ' ').replace(/[,;]$/, '').trim();
      // Don't use the same address as the property
      if (addr.length > 5 && addr.length < 150 && /^\d/.test(addr) && addr !== extracted.property_address) {
        extracted.landlord_address = addr;
        break;
      }
    }
  }

  // Extract landlord city/state/zip if we found a landlord address context
  if (extracted.landlord_address) {
    // Look for city, state, zip after landlord address mentions
    const landlordCityZipPatterns = [
      /(?:landlord|lessor|owner|management)[^.]*?,\s*([A-Za-z\s]+),\s*(?:TX|Texas)\s*(\d{5})/gi,
    ];

    for (const pattern of landlordCityZipPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(normalized);
      if (match && match[1] && match[2]) {
        extracted.landlord_city = match[1].trim();
        extracted.landlord_state = 'TX';
        extracted.landlord_zip = match[2].trim();
        break;
      }
    }
  }

  // Extract phone numbers - try to associate with landlord or tenant
  const phonePatterns = [
    /(?:landlord|lessor|owner|management)[^.]*?(?:phone|tel|telephone|contact)[:\s]*(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/gi,
    /(?:phone|tel|telephone)[:\s]*(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})[^.]*?(?:landlord|lessor|owner)/gi,
  ];

  for (const pattern of phonePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const phone = match[1].replace(/[^\d]/g, '');
      if (phone.length === 10) {
        extracted.landlord_phone = match[1].trim();
        break;
      }
    }
  }

  // Extract county if mentioned
  const countyPatterns = [
    /([A-Za-z]+)\s+county\s*,\s*(?:TX|Texas)/gi,
    /county\s+of\s+([A-Za-z]+)\s*,\s*(?:TX|Texas)/gi,
    /(?:located\s+in|situated\s+in)\s+([A-Za-z]+)\s+county/gi,
  ];

  for (const pattern of countyPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const county = match[1].trim();
      if (county.length >= 3 && county.length <= 30) {
        extracted.county = county;
        break;
      }
    }
  }

  // Extract email addresses
  const emailPattern = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gi;
  const emails = [];
  let emailMatch;
  while ((emailMatch = emailPattern.exec(normalized)) !== null) {
    if (!emails.includes(emailMatch[1].toLowerCase())) {
      emails.push(emailMatch[1].toLowerCase());
    }
  }
  // If we find emails, try to determine if any is landlord's
  if (emails.length > 0) {
    // Check if any email is near landlord mention
    for (const email of emails) {
      const landlordEmailPattern = new RegExp(`(?:landlord|lessor|owner|management)[^.]*?${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      if (landlordEmailPattern.test(normalized)) {
        extracted.landlord_email = email;
        break;
      }
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // Handle written month format: "January 1, 2024" or "Jan 1, 2024"
  const monthNames = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12',
  };

  // Try written month format: "January 1, 2024"
  const writtenMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (writtenMatch) {
    const monthStr = writtenMatch[1].toLowerCase();
    const month = monthNames[monthStr];
    if (month) {
      const day = writtenMatch[2].padStart(2, '0');
      const year = writtenMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  // Handle ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = dateStr.match(/(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Convert MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY to YYYY-MM-DD format
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [month, day, year] = parts;

    // Handle 2-digit years
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = String(century + parseInt(year));
    }

    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
  return null;
}

function extractSections(text) {
  if (!text) {
    return TOPIC_DEFINITIONS.map((topic) => ({
      topic: topic.label,
      summary: 'Nothing noted for this topic in the extracted text.',
      excerpts: [],
    }));
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  const lineSegments = text
    .split(/\r?\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const sentenceSegments = normalized
    .split(/(?<=[.?!])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const chunkSegments = [];
  for (let index = 0; index < normalized.length; index += 300) {
    chunkSegments.push(normalized.slice(index, index + 300));
  }
  let segments = lineSegments.length > 1 ? lineSegments : sentenceSegments;
  if (segments.length <= 1) {
    segments = chunkSegments;
  }
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const lowerChunks = chunkSegments.map((segment) => segment.toLowerCase());
  const normalizedLower = normalized.toLowerCase();

  const snippetFromSegment = (segment, keyword, windowSize = 140) => {
    const lower = segment.toLowerCase();
    const index = lower.indexOf(keyword);
    if (index === -1) return segment.slice(0, 260);
    const start = Math.max(0, index - windowSize);
    const end = Math.min(segment.length, index + keyword.length + windowSize);
    return segment.slice(start, end).trim();
  };

  return TOPIC_DEFINITIONS.map((topic) => {
    if (topic.key === 'security_deposit') {
      const amounts = [];
      const amountPatterns = [
        /security\s*deposit\s*amount[^$]{0,40}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
        /security\s*deposit[^$]{0,40}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      ];
      amountPatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(normalizedLower)) !== null) {
          if (match[1]) {
            amounts.push(match[1].replace(/\s+/g, ' ').trim());
          }
        }
      });
      if (amounts.length === 0) {
        lowerChunks.forEach((chunk, index) => {
          if (!chunk.includes('security deposit')) return;
          const localPattern =
            /security\s*deposit[^$]{0,80}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
          let match;
          while ((match = localPattern.exec(chunkSegments[index])) !== null) {
            if (match[1]) {
              amounts.push(match[1].replace(/\s+/g, ' ').trim());
            }
          }
        });
      }

      const uniqueAmounts = Array.from(new Set(amounts));
      const extracted = uniqueAmounts.length > 0 ? [uniqueAmounts[0]] : [];
      return {
        topic: topic.label,
        summary: extracted.length > 0
          ? 'The lease text references a security deposit amount.'
          : 'Nothing noted for this topic in the extracted text.',
        excerpts: extracted,
      };
    }

    const matches = [];
    lowerSegments.forEach((segment, index) => {
      if (matches.length >= 3) return;
      if (segment.includes('security deposit')) return;
      const matchedKeyword = topic.keywords.find((keyword) => segment.includes(keyword));
      if (matchedKeyword) {
        matches.push(snippetFromSegment(segments[index], matchedKeyword));
      }
    });

    return {
      topic: topic.label,
      summary: matches.length > 0
        ? topic.summary
        : 'Nothing noted for this topic in the extracted text.',
      excerpts: matches,
    };
  });
}
router.post('/', async (req, res) => {
  const payload = req.body;
  const { valid, errors } = validateIntake(payload);

  if (!valid) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Invalid intake data. Please review and try again.',
      errors,
    });
  }

  const caseId = uuidv4();
  await saveCase(caseId, payload);

  // Associate case with current session for access control
  associateCaseWithSession(req, caseId);

  console.log('Intake received', {
    caseId,
    receivedAt: new Date().toISOString(),
    jurisdiction: payload.jurisdiction,
    leaseType: payload.lease_information.lease_type,
    depositReturned: payload.security_deposit_information.deposit_returned,
    communicationMethodsCount:
      payload.post_move_out_communications.communication_methods_used.length,
  });

  return res.status(201).json({
    status: 'received',
    caseId,
    message:
      'Intake received for document preparation. No legal advice is provided.',
  });
});

router.get('/:caseId', requireCaseOwnership, (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  return res.json({
    status: 'ok',
    case: storedCase,
  });
});

router.post('/:caseId/lease', requireCaseOwnership, upload.single('lease'), async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Lease file is required.',
    });
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Unsupported file type. Please upload a PDF or image.',
    });
  }

  // Validate file content matches declared type (prevent MIME type spoofing)
  if (!validateFileType(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      status: 'invalid',
      message: 'File content does not match declared type. Please upload a valid PDF, PNG, or JPG file.',
    });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  let text = '';

  try {
    if (isImage) {
      text = await extractTextFromImage(req.file.buffer);
    } else {
      text = await extractTextFromPdf(req.file.buffer);
      if (!text || text.trim().length < 40) {
        text = await extractTextFromPdfOcr(req.file.buffer);
      }
      if (!text) {
        text = extractTextFromBuffer(req.file.buffer);
      }
    }
  } catch (error) {
    console.error('Lease extraction failed', {
      route: '/api/cases/:caseId/lease',
      message: error && error.message ? error.message : String(error),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
    return res.status(500).json({
      status: 'error',
      message: getLeaseExtractionErrorMessage(error, isImage, req.file.size),
    });
  }

  const sections = extractSections(text);
  const preview = text ? text.slice(0, 600).trim() : '';
  const extractedData = extractStructuredData(text, sections);

  // Store lease text for Case Analysis Report pipeline
  if (text && text.trim().length > 0) {
    await updateCaseLeaseData(req.params.caseId, text, null);
  }

  return res.json({
    status: 'ok',
    message: extractedData
      ? 'Lease text extracted. Some fields have been identified from your lease.'
      : 'Lease text extracted for informational organization.',
    sections,
    preview,
    extractedData: extractedData || {},
  });
});

router.post('/lease-extract', upload.single('lease'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Lease file is required.',
    });
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Unsupported file type. Please upload a PDF or image.',
    });
  }

  // Validate file content matches declared type (prevent MIME type spoofing)
  if (!validateFileType(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      status: 'invalid',
      message: 'File content does not match declared type. Please upload a valid PDF, PNG, or JPG file.',
    });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  let text = '';

  try {
    if (isImage) {
      text = await extractTextFromImage(req.file.buffer);
    } else {
      text = await extractTextFromPdf(req.file.buffer);
      if (!text || text.trim().length < 40) {
        text = await extractTextFromPdfOcr(req.file.buffer);
      }
      if (!text) {
        text = extractTextFromBuffer(req.file.buffer);
      }
    }
  } catch (error) {
    console.error('Lease extraction failed', {
      route: '/api/cases/lease-extract',
      message: error && error.message ? error.message : String(error),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
    return res.status(500).json({
      status: 'error',
      message: getLeaseExtractionErrorMessage(error, isImage, req.file.size),
    });
  }

  const sections = extractSections(text);
  const preview = text ? text.slice(0, 600).trim() : '';
  const extractedData = extractStructuredData(text, sections);

  return res.json({
    status: 'ok',
    message: extractedData
      ? 'Lease text extracted. Review the auto-filled fields below and make any needed corrections.'
      : 'Lease text extracted for informational organization.',
    sections,
    preview,
    extractedData: extractedData || {},
  });
});

module.exports = router;






