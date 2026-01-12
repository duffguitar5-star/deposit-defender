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
    });
    return res.status(500).json({
      status: 'error',
      message: 'Unable to process the lease file right now.',
    });
  }

  const sections = extractSections(text);
  const preview = text ? text.slice(0, 600).trim() : '';

  return res.json({
    status: 'ok',
    message: 'Lease text extracted for informational organization.',
    sections,
    preview,
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
    });
    return res.status(500).json({
      status: 'error',
      message: 'Unable to process the lease file right now.',
    });
  }

  const sections = extractSections(text);
  const preview = text ? text.slice(0, 600).trim() : '';

  return res.json({
    status: 'ok',
    message: 'Lease text extracted for informational organization.',
    sections,
    preview,
  });
});

module.exports = router;






