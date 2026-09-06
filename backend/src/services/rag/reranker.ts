import { RetrievalCandidate, EvidenceState } from './types';
import { EmbeddingService } from './embeddingService';

export class CrossEncoderReranker {
  public static get STRONG_THRESHOLD(): number {
    return parseFloat(process.env.RAG_STRONG_THRESHOLD || '0.35');
  }

  public static get WEAK_THRESHOLD(): number {
    return parseFloat(process.env.RAG_WEAK_THRESHOLD || '0.20');
  }

  /**
   * Evaluates candidate passages for direct question-answering relevance,
   * assigning cross-encoder relevance scores and determining evidence state:
   * 
   *                    Reranker score
   *                         │
   *             ┌───────────┴───────────┐
   *             │                       │
   *        >= STRONG_THRESHOLD    < STRONG_THRESHOLD
   *             │                       │
   *             ▼                       ▼
   *       STRONG_EVIDENCE          WEAK / NO
   *                                     │
   *                              >= WEAK_THRESHOLD
   *                                     │
   *                                  WEAK
   *                                     │
   *                              < WEAK_THRESHOLD
   *                                     │
   *                               NO_EVIDENCE
   */
  public static rerank(
    query: string,
    candidates: RetrievalCandidate[],
    topK: number = 4,
    customStrongThreshold?: number,
    customWeakThreshold?: number,
    queryVector?: number[]
  ): {
    ranked: RetrievalCandidate[];
    evidenceState: EvidenceState;
  } {
    const strongThresh = customStrongThreshold ?? this.STRONG_THRESHOLD;
    const weakThresh = customWeakThreshold ?? this.WEAK_THRESHOLD;

    if (candidates.length === 0) {
      return { ranked: [], evidenceState: 'NO_EVIDENCE' };
    }

    const rawTokens = query
      .toLowerCase()
      .split(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F=+\-*/^]+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t));

    const queryTerms = rawTokens.filter((t) => t.length >= 2 || SCIENCE_SYMBOLS.has(t));

    // Extract 2-word query phrases for exact phrase matching
    const phrases: string[] = [];
    const cleanWords = query.toLowerCase().split(/\s+/).filter((w) => !STOP_WORDS.has(w));
    for (let i = 0; i < cleanWords.length - 1; i++) {
      phrases.push(`${cleanWords[i]} ${cleanWords[i + 1]}`);
    }

    const scored = candidates.map((cand) => {
      const text = cand.chunk.text.toLowerCase();
      const title = (cand.chunk.metadata.title || '').toLowerCase();
      const section = (cand.chunk.metadata.sectionTitle || '').toLowerCase();

      // 1. Term coverage in passage
      let matchedTerms = 0;
      let titleMatchedTerms = 0;
      for (const t of queryTerms) {
        const inBody = text.includes(t);
        const inTitle = title.includes(t) || section.includes(t);
        if (inBody || inTitle) matchedTerms++;
        if (inTitle) titleMatchedTerms++;
      }
      const termCoverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;
      const titleCoverage = queryTerms.length > 0 ? titleMatchedTerms / queryTerms.length : 0;

      // 2. Phrase coverage
      let matchedPhrases = 0;
      for (const p of phrases) {
        if (text.includes(p) || title.includes(p) || section.includes(p)) {
          matchedPhrases++;
        }
      }
      const phraseCoverage = phrases.length > 0 ? matchedPhrases / phrases.length : 0;

      // 3. Vector semantic similarity component
      let vecScore = cand.vectorScore ?? 0;
      if (vecScore === 0 && queryVector && cand.chunk.embedding) {
        vecScore = EmbeddingService.cosineSimilarity(queryVector, cand.chunk.embedding);
      }

      // 4. Exact mathematical formula and symbol matching
      let formulaBonus = 0;
      if (
        /(\b(f\s*=\s*m\s*a|v\s*=\s*u\s*\+\s*a\s*t|6\s*co2|ke\s*=|atp|ax\^2|det\(a\)|lambda)\b|[=^]\s*\d+)/i.test(query) &&
        /(\b(f\s*=\s*m\s*a|v\s*=\s*u\s*\+\s*a\s*t|6\s*co2|ke\s*=|atp|ax\^2|det\(a\)|lambda)\b|[=^]\s*\d+)/i.test(text)
      ) {
        formulaBonus = 0.15;
      }

      // 5. Combined Cross-Encoder Score
      let rerankScore = 0;
      if (termCoverage > 0) {
        rerankScore = 0.35 * termCoverage + 0.35 * Math.max(0, vecScore) + 0.15 * phraseCoverage + 0.15 * titleCoverage + formulaBonus;
      } else if (vecScore >= 0.36) {
        // Cross-lingual semantic vector match (e.g. Tamil/Hindi/Tanglish query -> English textbook)
        rerankScore = Math.max(0, vecScore) + 0.15 * phraseCoverage + formulaBonus;
      } else {
        // Out-of-syllabus query noise suppression (safely rejects ambient vector noise)
        rerankScore = Math.max(0, vecScore) * 0.10;
      }

      return {
        ...cand,
        rerankScore,
      };
    });

    scored.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

    const topRanked = scored.slice(0, topK);
    const bestScore = topRanked.length > 0 ? topRanked[0].rerankScore || 0 : 0;

    let evidenceState: EvidenceState;
    if (bestScore >= strongThresh) {
      evidenceState = 'STRONG_EVIDENCE';
    } else if (bestScore >= weakThresh) {
      evidenceState = 'WEAK_EVIDENCE';
    } else {
      evidenceState = 'NO_EVIDENCE';
    }

    return {
      ranked: topRanked,
      evidenceState,
    };
  }
}

const STOP_WORDS = new Set([
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'explain',
  'define', 'tell', 'about', 'does', 'have', 'with', 'from', 'into', 'and', 'the',
]);

const SCIENCE_SYMBOLS = new Set([
  'g', 'f', 'm', 'a', 'v', 'u', 't', 'p', 'w', 'e', 'c', 'h', 'k', 'r', 's', 'l', 'd',
]);
