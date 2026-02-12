/**
 * Lease Clause Indexer
 *
 * Processes extracted lease text and produces citable clause objects
 * for downstream analysis.
 *
 * IMPORTANT: This module performs deterministic INDEXING only.
 * It does NOT interpret, analyze, or draw conclusions about lease clauses.
 */

const {
  CLAUSE_TYPES,
  CLAUSE_PATTERNS,
  SENTENCE_PATTERNS,
  HEADING_INDICATORS,
} = require('./clausePatterns');

/**
 * Maximum excerpt length in words
 */
const MAX_EXCERPT_WORDS = 25;

/**
 * Context window size (characters before/after keyword match)
 */
const CONTEXT_WINDOW = 300;

/**
 * Minimum match length to consider
 */
const MIN_MATCH_LENGTH = 20;

/**
 * Index lease clauses from extracted text
 *
 * @param {string} leaseText - Raw text extracted from PDF
 * @param {Array<{page: number, offset: number}>} [pageMarkers] - Optional page boundary markers
 * @returns {Array<ClauseObject>} Array of indexed clause objects
 */
function indexLeaseClauses(leaseText, pageMarkers = null) {
  if (!leaseText || typeof leaseText !== 'string') {
    return [];
  }

  const normalizedText = normalizeText(leaseText);
  const clauses = [];

  // Process each clause type
  for (const [clauseType, patterns] of Object.entries(CLAUSE_PATTERNS)) {
    const matches = findClauseMatches(normalizedText, clauseType, patterns);

    for (const match of matches) {
      const clause = buildClauseObject(
        clauseType,
        match,
        normalizedText,
        pageMarkers
      );

      if (clause) {
        clauses.push(clause);
      }
    }
  }

  // Sort by start_offset for consistent ordering
  clauses.sort((a, b) => a.start_offset - b.start_offset);

  // Deduplicate overlapping clauses (keep highest confidence)
  return deduplicateClauses(clauses);
}

/**
 * Normalize text for consistent matching
 *
 * @param {string} text - Raw text
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse multiple spaces (but preserve paragraph breaks)
    .replace(/[^\S\n]+/g, ' ')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Find all matches for a clause type in the text
 *
 * @param {string} text - Normalized text
 * @param {string} clauseType - Type of clause to find
 * @param {object} patterns - Pattern definitions for this clause type
 * @returns {Array<MatchResult>} Array of match results
 */
function findClauseMatches(text, clauseType, patterns) {
  const matches = [];
  const textLower = text.toLowerCase();

  // First, find heading matches (high confidence)
  for (const headingPattern of patterns.headingPatterns) {
    const headingMatches = findPatternMatches(text, headingPattern);

    for (const match of headingMatches) {
      const context = extractContext(text, match.index, CONTEXT_WINDOW);
      const keywordScore = calculateKeywordScore(
        context.text,
        patterns.primaryKeywords,
        patterns.secondaryKeywords,
        patterns.exclusionKeywords
      );

      matches.push({
        type: 'heading',
        startOffset: match.index,
        endOffset: context.endOffset,
        matchedText: match.text,
        contextText: context.text,
        headingText: match.text.trim(),
        confidence: calculateConfidence('heading', keywordScore),
      });
    }
  }

  // Second, find keyword matches (variable confidence)
  const keywordMatches = findKeywordMatches(
    text,
    textLower,
    patterns.primaryKeywords,
    patterns.secondaryKeywords,
    patterns.exclusionKeywords,
    patterns.minKeywordMatches
  );

  for (const match of keywordMatches) {
    // Skip if overlaps with a heading match
    const overlapsHeading = matches.some(
      (m) =>
        m.type === 'heading' &&
        rangesOverlap(
          m.startOffset,
          m.endOffset,
          match.startOffset,
          match.endOffset
        )
    );

    if (!overlapsHeading) {
      matches.push({
        type: 'keyword',
        startOffset: match.startOffset,
        endOffset: match.endOffset,
        matchedText: match.matchedKeywords.join(', '),
        contextText: match.contextText,
        headingText: detectNearbyHeading(text, match.startOffset),
        confidence: calculateConfidence('keyword', match.keywordScore),
      });
    }
  }

  return matches;
}

/**
 * Find all matches of a regex pattern in text
 *
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Pattern to match
 * @returns {Array<{text: string, index: number}>} Matches
 */
function findPatternMatches(text, pattern) {
  const matches = [];
  const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));

  let match;
  while ((match = globalPattern.exec(text)) !== null) {
    matches.push({
      text: match[0],
      index: match.index,
    });
  }

  return matches;
}

/**
 * Find keyword matches with context
 *
 * @param {string} text - Original text
 * @param {string} textLower - Lowercase text
 * @param {string[]} primaryKeywords - Primary keywords
 * @param {string[]} secondaryKeywords - Secondary keywords
 * @param {string[]} exclusionKeywords - Exclusion keywords
 * @param {number} minMatches - Minimum primary keyword matches
 * @returns {Array<KeywordMatch>} Keyword matches
 */
function findKeywordMatches(
  text,
  textLower,
  primaryKeywords,
  secondaryKeywords,
  exclusionKeywords,
  minMatches
) {
  const matches = [];
  const processedRanges = [];

  // Find all primary keyword occurrences
  for (const keyword of primaryKeywords) {
    const keywordLower = keyword.toLowerCase();
    let searchIndex = 0;

    while (true) {
      const foundIndex = textLower.indexOf(keywordLower, searchIndex);
      if (foundIndex === -1) break;

      // Check if this range was already processed
      const alreadyProcessed = processedRanges.some(
        (range) =>
          foundIndex >= range.start - CONTEXT_WINDOW &&
          foundIndex <= range.end + CONTEXT_WINDOW
      );

      if (!alreadyProcessed) {
        const context = extractContext(text, foundIndex, CONTEXT_WINDOW);
        const contextLower = context.text.toLowerCase();

        // Count keyword matches in context
        const matchedPrimary = primaryKeywords.filter((kw) =>
          contextLower.includes(kw.toLowerCase())
        );
        const matchedSecondary = secondaryKeywords.filter((kw) =>
          contextLower.includes(kw.toLowerCase())
        );
        const hasExclusion = exclusionKeywords.some((kw) =>
          contextLower.includes(kw.toLowerCase())
        );

        // Check if meets minimum threshold
        if (matchedPrimary.length >= minMatches && !hasExclusion) {
          const keywordScore = calculateKeywordScore(
            context.text,
            primaryKeywords,
            secondaryKeywords,
            exclusionKeywords
          );

          matches.push({
            startOffset: context.startOffset,
            endOffset: context.endOffset,
            matchedKeywords: [...matchedPrimary, ...matchedSecondary],
            contextText: context.text,
            keywordScore,
          });

          processedRanges.push({
            start: context.startOffset,
            end: context.endOffset,
          });
        }
      }

      searchIndex = foundIndex + 1;
    }
  }

  return matches;
}

/**
 * Extract context around a position
 *
 * @param {string} text - Full text
 * @param {number} position - Center position
 * @param {number} windowSize - Characters on each side
 * @returns {{text: string, startOffset: number, endOffset: number}}
 */
function extractContext(text, position, windowSize) {
  // Find sentence/paragraph boundaries
  let startOffset = Math.max(0, position - windowSize);
  let endOffset = Math.min(text.length, position + windowSize);

  // Adjust start to sentence/paragraph boundary
  const textBefore = text.substring(startOffset, position);
  const sentenceStart = Math.max(
    textBefore.lastIndexOf('. '),
    textBefore.lastIndexOf('.\n'),
    textBefore.lastIndexOf('\n\n')
  );
  if (sentenceStart > 0) {
    startOffset = startOffset + sentenceStart + 1;
  }

  // Adjust end to sentence/paragraph boundary
  const textAfter = text.substring(position, endOffset);
  const sentenceEndMatch = textAfter.match(/[.!?]\s/);
  if (sentenceEndMatch) {
    endOffset = position + sentenceEndMatch.index + 1;
  }

  // Trim whitespace
  let contextText = text.substring(startOffset, endOffset).trim();

  // Update offsets after trim
  const leadingTrim = text.substring(startOffset, endOffset).length - text.substring(startOffset, endOffset).trimStart().length;
  startOffset += leadingTrim;

  return {
    text: contextText,
    startOffset,
    endOffset,
  };
}

/**
 * Calculate keyword score for a text segment
 *
 * @param {string} text - Text to score
 * @param {string[]} primaryKeywords - Primary keywords (weight: 2)
 * @param {string[]} secondaryKeywords - Secondary keywords (weight: 1)
 * @param {string[]} exclusionKeywords - Exclusion keywords (weight: -3)
 * @returns {number} Score (0-1 normalized)
 */
function calculateKeywordScore(
  text,
  primaryKeywords,
  secondaryKeywords,
  exclusionKeywords
) {
  const textLower = text.toLowerCase();

  let score = 0;
  let maxPossible = primaryKeywords.length * 2 + secondaryKeywords.length;

  // Primary keywords (weight: 2)
  for (const kw of primaryKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score += 2;
    }
  }

  // Secondary keywords (weight: 1)
  for (const kw of secondaryKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score += 1;
    }
  }

  // Exclusion keywords (penalty)
  for (const kw of exclusionKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score -= 3;
    }
  }

  // Normalize to 0-1
  return Math.max(0, Math.min(1, score / maxPossible));
}

/**
 * Calculate overall confidence score
 *
 * @param {'heading' | 'keyword'} matchType - Type of match
 * @param {number} keywordScore - Keyword score (0-1)
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(matchType, keywordScore) {
  if (matchType === 'heading') {
    // Heading matches start at 0.7, boosted by keywords
    return Math.min(1, 0.7 + keywordScore * 0.3);
  } else {
    // Keyword-only matches capped at 0.7
    return Math.min(0.7, 0.3 + keywordScore * 0.5);
  }
}

/**
 * Detect if there's a heading near the given position
 *
 * @param {string} text - Full text
 * @param {number} position - Position to check
 * @returns {string|null} Detected heading or null
 */
function detectNearbyHeading(text, position) {
  // Look backwards up to 500 chars for a heading
  const lookbackStart = Math.max(0, position - 500);
  const textBefore = text.substring(lookbackStart, position);

  // Split by newlines and check each line
  const lines = textBefore.split('\n').reverse();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check against heading indicators
    for (const indicator of HEADING_INDICATORS) {
      if (indicator.test(trimmed)) {
        return trimmed;
      }
    }

    // Check for short lines that look like headings (likely section titles)
    if (trimmed.length < 50 && trimmed.length > 3) {
      // Title case or ALL CAPS
      if (/^[A-Z][A-Z\s]+$/.test(trimmed) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return null;
}

/**
 * Build a clause object from a match
 *
 * @param {string} clauseType - Type of clause
 * @param {MatchResult} match - Match result
 * @param {string} fullText - Full lease text
 * @param {Array|null} pageMarkers - Page markers
 * @returns {ClauseObject|null} Clause object or null
 */
function buildClauseObject(clauseType, match, fullText, pageMarkers) {
  // Skip very short matches
  if (match.contextText.length < MIN_MATCH_LENGTH) {
    return null;
  }

  // Generate excerpt (max 25 words)
  const excerpt = generateExcerpt(match.contextText, MAX_EXCERPT_WORDS);

  // Determine title
  const title = determineTitle(clauseType, match);

  // Find page number
  const pageNumber = findPageNumber(match.startOffset, pageMarkers);

  return {
    clause_type: clauseType,
    title,
    excerpt,
    start_offset: match.startOffset,
    end_offset: match.endOffset,
    page_number: pageNumber,
    confidence_score: Math.round(match.confidence * 100) / 100,
  };
}

/**
 * Generate a truncated excerpt
 *
 * @param {string} text - Full context text
 * @param {number} maxWords - Maximum word count
 * @returns {string} Truncated excerpt
 */
function generateExcerpt(text, maxWords) {
  // Clean up the text
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');

  if (words.length <= maxWords) {
    return cleaned;
  }

  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Determine the best title for a clause
 *
 * @param {string} clauseType - Type of clause
 * @param {MatchResult} match - Match result
 * @returns {string} Title
 */
function determineTitle(clauseType, match) {
  // Use detected heading if available
  if (match.headingText) {
    // Clean up heading
    return match.headingText
      .replace(/^\d+\.?\s*/, '')  // Remove leading numbers
      .replace(/[:.]$/, '')       // Remove trailing punctuation
      .trim();
  }

  // Fall back to clause type as title
  return formatClauseTypeAsTitle(clauseType);
}

/**
 * Format clause type as human-readable title
 *
 * @param {string} clauseType - Clause type enum
 * @returns {string} Formatted title
 */
function formatClauseTypeAsTitle(clauseType) {
  return clauseType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Find page number for a given offset
 *
 * @param {number} offset - Character offset
 * @param {Array<{page: number, offset: number}>|null} pageMarkers - Page markers
 * @returns {number|null} Page number or null
 */
function findPageNumber(offset, pageMarkers) {
  if (!pageMarkers || !Array.isArray(pageMarkers) || pageMarkers.length === 0) {
    return null;
  }

  // Page markers should be sorted by offset
  let page = null;
  for (const marker of pageMarkers) {
    if (marker.offset <= offset) {
      page = marker.page;
    } else {
      break;
    }
  }

  return page;
}

/**
 * Check if two ranges overlap
 *
 * @param {number} start1 - First range start
 * @param {number} end1 - First range end
 * @param {number} start2 - Second range start
 * @param {number} end2 - Second range end
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * Deduplicate overlapping clauses, keeping highest confidence
 *
 * @param {Array<ClauseObject>} clauses - Sorted clauses
 * @returns {Array<ClauseObject>} Deduplicated clauses
 */
function deduplicateClauses(clauses) {
  if (clauses.length <= 1) {
    return clauses;
  }

  const result = [];
  const skipIndices = new Set();

  for (let i = 0; i < clauses.length; i++) {
    if (skipIndices.has(i)) continue;

    const current = clauses[i];
    let bestClause = current;

    // Check for overlapping clauses of the same type
    for (let j = i + 1; j < clauses.length; j++) {
      if (skipIndices.has(j)) continue;

      const other = clauses[j];

      // Only deduplicate same clause types
      if (current.clause_type !== other.clause_type) continue;

      // Check overlap
      if (
        rangesOverlap(
          current.start_offset,
          current.end_offset,
          other.start_offset,
          other.end_offset
        )
      ) {
        // Keep higher confidence
        if (other.confidence_score > bestClause.confidence_score) {
          bestClause = other;
        }
        skipIndices.add(j);
      }
    }

    result.push(bestClause);
  }

  return result;
}

/**
 * Get all supported clause types
 *
 * @returns {string[]} Array of clause type strings
 */
function getSupportedClauseTypes() {
  return Object.values(CLAUSE_TYPES);
}

module.exports = {
  indexLeaseClauses,
  getSupportedClauseTypes,
  CLAUSE_TYPES,
};
