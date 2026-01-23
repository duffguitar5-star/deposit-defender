const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { validateIntake } = require('../lib/intakeValidation');
const { saveCase, getCase } = require('../lib/caseStore');
const {
  extractTextFromImage,
  extractTextFromPdf,
  extractTextFromPdfOcr,
} = require('../lib/leaseExtraction');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

  // Extract property address - look for street address patterns
  const addressPatterns = [
    /(?:property\s+address|premises|unit|apartment|residence)[:\s]+([0-9]+\s+[A-Za-z0-9\s#.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy)[^,.\n]*)/gi,
    /(?:located\s+at|address)[:\s]+([0-9]+\s+[A-Za-z0-9\s#.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy)[^,.\n]*)/gi,
    /\b([0-9]+\s+[A-Za-z0-9\s#.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy))\s*,\s*[A-Z][a-z]+\s*,\s*TX/gi,
  ];

  for (const pattern of addressPatterns) {
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      let addr = match[1].trim();
      // Clean up common artifacts
      addr = addr.replace(/\s+/g, ' ').replace(/[,;]$/, '').trim();
      if (addr.length > 5 && addr.length < 150 && /^\d/.test(addr)) {
        extracted.property_address = addr;
        break;
      }
    }
  }

  // Extract city, state, zip - look for standard address format
  const cityStateZipPatterns = [
    /,\s*([A-Za-z\s]+),\s*TX\s*(\d{5})/gi,
    /([A-Za-z\s]+),\s*Texas\s*(\d{5})/gi,
  ];

  for (const pattern of cityStateZipPatterns) {
    const match = pattern.exec(normalized);
    if (match && match[1] && match[2]) {
      extracted.city = match[1].trim();
      extracted.zip_code = match[2].trim();
      break;
    }
  }

  // Extract lease dates - look for various date formats and contexts
  const datePatterns = [
    /(?:lease|term|rental)\s+(?:period|term)[:\s]+(?:from\s+)?([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    /(?:commence|begin|start)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    /(?:effective|starting)\s+(?:date)?[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    /from[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})\s+(?:to|through)/gi,
  ];

  for (const pattern of datePatterns) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const parsedDate = normalizeDate(match[1]);
      if (parsedDate && parsedDate.length === 10) { // Valid YYYY-MM-DD format
        extracted.lease_start_date = parsedDate;
        break;
      }
    }
  }

  const endDatePatterns = [
    /(?:to|through|until|thru)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    /(?:end|expir|terminat)[a-z]*[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    /(?:ending|expiring)\s+(?:on|date)?[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
  ];

  for (const pattern of endDatePatterns) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(normalized);
    if (match && match[1]) {
      const parsedDate = normalizeDate(match[1]);
      if (parsedDate && parsedDate.length === 10) { // Valid YYYY-MM-DD format
        extracted.lease_end_date = parsedDate;
        break;
      }
    }
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

  return Object.keys(extracted).length > 0 ? extracted : null;
}

function normalizeDate(dateStr) {
  // Convert MM/DD/YYYY or MM-DD-YYYY to YYYY-MM-DD format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let [month, day, year] = parts;

    // Handle 2-digit years
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = century + parseInt(year);
    }

    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
  return dateStr;
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
router.post('/', (req, res) => {
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
  saveCase(caseId, payload);
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

router.get('/:caseId', (req, res) => {
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

router.post('/:caseId/lease', upload.single('lease'), async (req, res) => {
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






