export interface ValidationResult {
  isValid: boolean;
  originalInput: string;
  trimmedInput: string;
  finalUrl: string;
  meetingCode?: string;
  isModified: boolean;
  error?: string;
  debugInfo?: {
    hostname: string;
    pathname: string;
    searchParams: string;
    hasProtocolAdded: boolean;
  };
}

/**
 * Robust, Non-Destructive Google Meet URL normalizer and validator.
 * - Trims whitespace
 * - Ensures https:// prefix if omitted
 * - Matches meet.google.com/xxx-yyyy-zzz or lookup codes
 * - PRESERVES all original query parameters (e.g., ?authuser=1, ?pli=1, ?hs=179)
 * - Never blindly reconstructs or corrupts user URL
 */
export function validateMeetUrl(rawInput: string): ValidationResult {
  const originalInput = rawInput || '';

  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      originalInput,
      trimmedInput: '',
      finalUrl: '',
      isModified: false,
      error: 'Invalid Google Meet link. Please paste the complete meeting URL.',
    };
  }

  const trimmedInput = rawInput.trim();
  if (trimmedInput.length === 0) {
    return {
      isValid: false,
      originalInput,
      trimmedInput: '',
      finalUrl: '',
      isModified: false,
      error: 'Invalid Google Meet link. Please paste the complete meeting URL.',
    };
  }

  let cleaned = trimmedInput;
  let hasProtocolAdded = false;

  // If user pasted without protocol: e.g. "meet.google.com/abc-defg-hij?authuser=1" or "abc-defg-hij"
  if (!/^https?:\/\//i.test(cleaned)) {
    if (cleaned.toLowerCase().startsWith('meet.google.com/')) {
      cleaned = 'https://' + cleaned;
      hasProtocolAdded = true;
    } else if (/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}(?:\?.*)?$/i.test(cleaned)) {
      cleaned = `https://meet.google.com/${cleaned}`;
      hasProtocolAdded = true;
    } else {
      cleaned = 'https://' + cleaned;
      hasProtocolAdded = true;
    }
  }

  try {
    const urlObj = new URL(cleaned);

    // Hostname check
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname !== 'meet.google.com') {
      return {
        isValid: false,
        originalInput,
        trimmedInput,
        finalUrl: cleaned,
        isModified: originalInput !== cleaned,
        error: `Invalid domain "${hostname}". ClassPulse requires a valid Google Meet link (e.g., https://meet.google.com/abc-defg-hij).`,
      };
    }

    // Path check: format /xxx-yyyy-zzz
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) {
      return {
        isValid: false,
        originalInput,
        trimmedInput,
        finalUrl: cleaned,
        isModified: originalInput !== cleaned,
        error: 'Invalid Google Meet link. Missing meeting code (e.g. https://meet.google.com/abc-defg-hij).',
      };
    }

    const rawMeetingCode = pathParts[0];
    const meetingCode = rawMeetingCode.toLowerCase();
    
    // Standard Google Meet code is 3 letters - 4 letters - 3 letters
    const codePattern = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
    const fallbackPattern = /^[a-z0-9]{3,4}-[a-z0-9]{3,4}-[a-z0-9]{3,4}$/i;

    if (!codePattern.test(meetingCode) && !fallbackPattern.test(meetingCode)) {
      return {
        isValid: false,
        originalInput,
        trimmedInput,
        finalUrl: cleaned,
        isModified: originalInput !== cleaned,
        error: `Invalid Google Meet code format "${rawMeetingCode}". Google Meet links should follow the format "abc-defg-hij" (3-4-3 letters).`,
      };
    }

    // CRITICAL: Preserve the exact validated URL including all search params and hashes
    // Do NOT strip query params or reconstruct without them!
    const finalUrl = cleaned;

    return {
      isValid: true,
      originalInput,
      trimmedInput,
      finalUrl,
      meetingCode,
      isModified: originalInput !== finalUrl,
      debugInfo: {
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        searchParams: urlObj.search,
        hasProtocolAdded,
      },
    };
  } catch (err) {
    return {
      isValid: false,
      originalInput,
      trimmedInput,
      finalUrl: cleaned,
      isModified: originalInput !== cleaned,
      error: 'Invalid Google Meet link. Please paste the complete meeting URL.',
    };
  }
}
