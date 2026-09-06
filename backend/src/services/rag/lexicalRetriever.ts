import { RAGChunk, RetrievalCandidate } from './types';

export class BM25LexicalRetriever {
  private k1: number = 1.2;
  private b: number = 0.75;

  /**
   * Performs BM25 lexical retrieval strictly scoped to the authorized classId.
   */
  public search(
    query: string,
    chunks: RAGChunk[],
    classId: string,
    topK: number = 20
  ): RetrievalCandidate[] {
    // 1. Filter strictly by classId BEFORE retrieval
    const classChunks = chunks.filter(
      (c) => c.metadata.classId.toUpperCase() === classId.toUpperCase()
    );

    if (classChunks.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = classChunks.length;
    let totalLength = 0;
    const docTokenized: string[][] = [];
    const docFreq = new Map<string, number>();

    for (let i = 0; i < N; i++) {
      const tokens = this.tokenize(classChunks[i].text + ' ' + (classChunks[i].metadata.title || ''));
      docTokenized.push(tokens);
      totalLength += tokens.length;

      const uniqueInDoc = new Set(tokens);
      for (const t of uniqueInDoc) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }

    const avgdl = totalLength / N || 1;

    const scored: Array<{ chunk: RAGChunk; score: number }> = [];

    for (let i = 0; i < N; i++) {
      const tokens = docTokenized[i];
      const docLen = tokens.length;
      let score = 0;

      // Calculate term frequencies in this document
      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      for (const q of queryTokens) {
        const tf = tfMap.get(q) || 0;
        if (tf === 0) continue;

        const df = docFreq.get(q) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const num = tf * (this.k1 + 1);
        const denom = tf + this.k1 * (1 - this.b + this.b * (docLen / avgdl));

        score += idf * (num / denom);
      }

      // Exact formula boost (e.g. F=ma)
      if (this.containsExactFormula(query, classChunks[i].text)) {
        score += 3.5;
      }

      if (score > 0) {
        scored.push({ chunk: classChunks[i], score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item, idx) => ({
      chunk: item.chunk,
      lexicalScore: item.score,
      lexicalRank: idx + 1,
    }));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u0B80-\u0BFF\u0900-\u097F=+\-*/^.]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
  }

  private containsExactFormula(query: string, text: string): boolean {
    const formulas = ['f=ma', 'f = ma', 'v=u+at', 'e=mc^2', 'ax^2+bx+c'];
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
