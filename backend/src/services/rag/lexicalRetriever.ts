import { RAGChunk, RetrievalCandidate, EvidenceState } from './types';

export interface LexicalRetrievalWeights {
  bm25Weight: number;      // default: 0.65
  phraseWeight: number;    // default: 0.15
  conceptWeight: number;   // default: 0.10
  metadataWeight: number;  // default: 0.10
}

export class BM25LexicalRetriever {
  private k1: number = 1.2;
  private b: number = 0.75;
  private weights: LexicalRetrievalWeights;

  constructor(weights?: Partial<LexicalRetrievalWeights>) {
    this.weights = {
      bm25Weight: weights?.bm25Weight ?? 0.65,
      phraseWeight: weights?.phraseWeight ?? 0.15,
      conceptWeight: weights?.conceptWeight ?? 0.10,
      metadataWeight: weights?.metadataWeight ?? 0.10,
    };
  }

  /**
   * Performs Fast Lexical Retrieval strictly scoped to the authorized classId.
   * Combines BM25 (0.65) + Phrase Overlap (0.15) + Concept Overlap (0.10) + Metadata Boost (0.10).
   */
  public search(
    query: string,
    chunks: RAGChunk[],
    classId: string,
    topK: number = 20
  ): RetrievalCandidate[] {
    // 1. Filter strictly by classId BEFORE retrieval (Class Isolation)
    const classChunks = chunks.filter(
      (c) => c.metadata.classId.toUpperCase() === classId.toUpperCase()
    );

    if (classChunks.length === 0) return [];

    const normalizedQuery = this.normalizeQuery(query);
    const queryTokens = this.tokenize(normalizedQuery);
    if (queryTokens.length === 0) return [];

    const N = classChunks.length;
    let totalLength = 0;
    const docTokenized: string[][] = [];
    const docFreq = new Map<string, number>();

    for (let i = 0; i < N; i++) {
      const docText = `${classChunks[i].text} ${classChunks[i].metadata.title || ''} ${classChunks[i].metadata.sectionTitle || ''}`;
      const tokens = this.tokenize(this.normalizeQuery(docText));
      docTokenized.push(tokens);
      totalLength += tokens.length;

      const uniqueInDoc = new Set(tokens);
      for (const t of uniqueInDoc) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }

    const avgdl = totalLength / N || 1;
    const scored: Array<{ chunk: RAGChunk; score: number; evidenceState: EvidenceState }> = [];

    // Query n-grams for phrase matching
    const queryPhrases = this.extractPhrases(normalizedQuery);
    // Key concept terms from query
    const queryConcepts = this.extractKeyConcepts(normalizedQuery);

    for (let i = 0; i < N; i++) {
      const chunk = classChunks[i];
      const tokens = docTokenized[i];
      const docLen = tokens.length;

      // ─── A. BM25 Score ───────────────────────────────────────────────────
      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      let rawBm25 = 0;
      for (const q of queryTokens) {
        const tf = tfMap.get(q) || 0;
        if (tf === 0) continue;

        const df = docFreq.get(q) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const num = tf * (this.k1 + 1);
        const denom = tf + this.k1 * (1 - this.b + this.b * (docLen / avgdl));
        rawBm25 += idf * (num / denom);
      }

      // ─── B. Phrase Overlap Score (0.0 to 1.0) ──────────────────────────────
      const chunkTextLower = this.normalizeQuery(chunk.text);
      let phraseMatches = 0;
      for (const phrase of queryPhrases) {
        if (chunkTextLower.includes(phrase)) {
          phraseMatches++;
        }
      }
      const phraseScore = queryPhrases.length > 0 ? (phraseMatches / queryPhrases.length) * 10 : 0;

      // ─── C. Concept / Entity Overlap Score (0.0 to 1.0) ────────────────────
      let conceptMatches = 0;
      for (const concept of queryConcepts) {
        if (chunkTextLower.includes(concept) || tokens.includes(concept)) {
          conceptMatches++;
        }
      }
      const conceptScore = queryConcepts.length > 0 ? (conceptMatches / queryConcepts.length) * 10 : 0;

      // ─── D. Metadata Boosting (Title, Section, Unit) ──────────────────────
      let metadataScore = 0;
      const metadataText = this.normalizeQuery(
        `${chunk.metadata.title || ''} ${chunk.metadata.sectionTitle || ''} ${chunk.metadata.unit || ''} ${(chunk.metadata as any).topic || ''}`
      );
      for (const q of queryTokens) {
        if (metadataText.includes(q)) {
          metadataScore += 2.0;
        }
      }
      for (const phrase of queryPhrases) {
        if (metadataText.includes(phrase)) {
          metadataScore += 4.0;
        }
      }

      // Exact Formula Boost (e.g. F = ma)
      if (this.containsExactFormula(query, chunk.text)) {
        metadataScore += 5.0;
      }

      // ─── E. Weighted Final Score ──────────────────────────────────────────
      // finalScore = bm25Score * 0.65 + phraseScore * 0.15 + conceptOverlap * 0.10 + metadataBoost * 0.10
      const finalScore =
        rawBm25 * this.weights.bm25Weight +
        phraseScore * this.weights.phraseWeight +
        conceptScore * this.weights.conceptWeight +
        metadataScore * this.weights.metadataWeight;

      if (finalScore > 0.1) {
        scored.push({
          chunk,
          score: finalScore,
          evidenceState: finalScore >= 2.5 ? 'STRONG_EVIDENCE' : 'WEAK_EVIDENCE',
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item, idx) => ({
      chunk: item.chunk,
      lexicalScore: item.score,
      lexicalRank: idx + 1,
    }));
  }

  /**
   * Normalizes tokens including ordinals, common educational plurals, and multilingual aliases.
   */
  public normalizeQuery(text: string): string {
    let normalized = text.toLowerCase();

    // 1. Ordinal Normalization
    normalized = normalized
      .replace(/\b1st\b/g, 'first')
      .replace(/\b2nd\b/g, 'second')
      .replace(/\b3rd\b/g, 'third')
      .replace(/\b4th\b/g, 'fourth')
      .replace(/\b5th\b/g, 'fifth');

    // 2. Multilingual & Tanglish Concept Aliases
    normalized = normalized
      .replace(/\birandaam thalaimurai\b/g, 'second generation')
      .replace(/\bmudhal thalaimurai\b/g, 'first generation')
      .replace(/\bmutal thalaimurai\b/g, 'first generation')
      .replace(/\bmoondraam thalaimurai\b/g, 'third generation')
      .replace(/\bdusri pidhi\b/g, 'second generation')
      .replace(/\bpehli pidhi\b/g, 'first generation')
      .replace(/\bpathi sollu\b/g, 'explain')
      .replace(/\bpathi\b/g, 'about')
      .replace(/\bepdi\b/g, 'how')
      .replace(/\badhoda\b/g, 'its')
      .replace(/\benna\b/g, 'what')
      .replace(/\bcompare pannu\b/g, 'compare')
      .replace(/\bவெற்றிடக் குழாய்கள்\b/g, 'vacuum tubes')
      .replace(/\bவெற்றிடக்குழாய்\b/g, 'vacuum tube')
      .replace(/\bடிரான்சிஸ்டர்\b/g, 'transistor');

    // 3. Educational Plural / Suffix Normalization
    normalized = normalized
      .replace(/\bcomputers\b/g, 'computer')
      .replace(/\btransistors\b/g, 'transistor')
      .replace(/\badvantages\b/g, 'advantage')
      .replace(/\blimitations\b/g, 'limitation')
      .replace(/\bcircuits\b/g, 'circuit')
      .replace(/\btubes\b/g, 'tube')
      .replace(/\bforces\b/g, 'force')
      .replace(/\blaws\b/g, 'law');

    return normalized;
  }

  private extractPhrases(text: string): string[] {
    const words = text
      .replace(/[^\w\u0B80-\u0BFF\u0900-\u097F\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
    return phrases;
  }

  private extractKeyConcepts(text: string): string[] {
    return text
      .replace(/[^\w\u0B80-\u0BFF\u0900-\u097F\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u0B80-\u0BFF\u0900-\u097F=+\-*/^.]+/g, ' ')
      .split(/\s+/)
      .map((t) => t.length > 3 ? t.replace(/(?:ing|ed|es|s)$/, '') : t)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
  }

  private containsExactFormula(query: string, text: string): boolean {
    const formulas = ['f=ma', 'f = ma', 'v=u+at', 'e=mc^2', 'ax^2+bx+c', 'f_net'];
    const qLower = query.toLowerCase().replace(/\s+/g, '');
    const tLower = text.toLowerCase().replace(/\s+/g, '');
    return formulas.some((f) => qLower.includes(f.replace(/\s+/g, '')) && tLower.includes(f.replace(/\s+/g, '')));
  }
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'do',
]);

