import { LanguageCode } from './types';

// Common Tanglish / Latin colloquial Tamil markers and conversational verbs
const TANGLISH_MARKERS = new Set([
  'enna', 'epdi', 'eppadi', 'irukku', 'iruku', 'panradhu', 'pandradhu',
  'oda', 'la', 'le', 'nu', 'aana', 'solunga', 'sollunga', 'sollu', 'solla',
  'purila', 'puriyala', 'kudunga', 'kekkudha', 'vachi', 'vechu', 'venum',
  'mattum', 'thaan', 'dhaan', 'avlo', 'adhu', 'idhu', 'edhu',
  'solli', 'paaru', 'paapom', 'kooda', 'romba', 'konjam', 'aprom',
  'pathi', 'patthi', 'pannu', 'pannunga', 'pannanga', 'panna',
  'yen', 'yaen', 'yena', 'edhuku', 'adhuku', 'idhuku',
  'munnadiya', 'pinnaadi', 'irundhadhu', 'irundhuchu', 'perusaa', 'periyadhaga',
  'machan', 'bro', 'thalaiva', 'dhaana', 'paathiya', 'illaya', 'illa',
]);

export class LanguageDetector {
  /**
   * Detects whether input text is English, Tamil, Hindi, or Tanglish.
   */
  public static detectLanguage(text: string): LanguageCode {
    if (!text || text.trim().length === 0) return 'en';

    const trimmed = text.trim();

    // 1. Check for Tamil script (U+0B80 to U+0BFF)
    const tamilMatches = trimmed.match(/[\u0B80-\u0BFF]/g);
    const tamilCount = tamilMatches ? tamilMatches.length : 0;

    // 2. Check for Devanagari / Hindi script (U+0900 to U+097F)
    const hindiMatches = trimmed.match(/[\u0900-\u097F]/g);
    const hindiCount = hindiMatches ? hindiMatches.length : 0;

    const totalChars = trimmed.replace(/\s+/g, '').length;

    if (tamilCount > 0 && (tamilCount >= 2 || tamilCount / totalChars > 0.15)) {
      return 'ta';
    }

    if (hindiCount > 0 && (hindiCount >= 2 || hindiCount / totalChars > 0.15)) {
      return 'hi';
    }

    // 3. Check for Tanglish markers in Latin text
    const words = trimmed.toLowerCase().split(/[^a-z0-9]+/);
    let tanglishScore = 0;
    for (const w of words) {
      if (TANGLISH_MARKERS.has(w)) {
        tanglishScore++;
      }
    }

    if (tanglishScore >= 1 || (words.length > 2 && tanglishScore / words.length >= 0.15)) {
      return 'tanglish';
    }

    return 'en';
  }
}
