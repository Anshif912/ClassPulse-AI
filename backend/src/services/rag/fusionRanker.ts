import { RetrievalCandidate, RAGChunk } from './types';
import { EmbeddingService } from './embeddingService';

export class FusionRanker {
  public static get RRF_K(): number {
    return parseInt(process.env.RAG_RRF_K || '60', 10);
  }

  public static get MMR_LAMBDA(): number {
    return parseFloat(process.env.RAG_MMR_LAMBDA || '0.85');
  }

  /**
   * Merges lexical and vector candidates using Reciprocal Rank Fusion (RRF):
   * 
   * RRF(d) = Σᵢ 1 / (k + rankᵢ(d))
   * 
   * For dual-retriever setup with k = 60:
   * RRF(d) = 1 / (60 + rank_BM25(d)) + 1 / (60 + rank_Vector(d))
   * 
   * If a candidate appears in only one retriever, it receives only that retriever's contribution.
   */
  public static rrfFusion(
    lexicalCandidates: RetrievalCandidate[],
    vectorCandidates: RetrievalCandidate[],
    customK?: number
  ): RetrievalCandidate[] {
    const kVal = customK ?? this.RRF_K;
    const candidateMap = new Map<string, RetrievalCandidate>();

    // 1. Process Lexical Candidates
    for (const cand of lexicalCandidates) {
      const id = cand.chunk.metadata.chunkId;
      const rank = cand.lexicalRank || 100;
      const rrfScore = 1.0 / (kVal + rank);

      candidateMap.set(id, {
        chunk: cand.chunk,
        lexicalScore: cand.lexicalScore,
        lexicalRank: rank,
        rrfScore,
      });
    }

    // 2. Process Vector Candidates
    for (const cand of vectorCandidates) {
      const id = cand.chunk.metadata.chunkId;
      const rank = cand.vectorRank || 100;
      const rrfAddition = 1.0 / (kVal + rank);

      const existing = candidateMap.get(id);
      if (existing) {
        existing.vectorScore = cand.vectorScore;
        existing.vectorRank = rank;
        existing.rrfScore = (existing.rrfScore || 0) + rrfAddition;
      } else {
        candidateMap.set(id, {
          chunk: cand.chunk,
          vectorScore: cand.vectorScore,
          vectorRank: rank,
          rrfScore: rrfAddition,
        });
      }
    }

    const merged = Array.from(candidateMap.values());
    merged.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));
    return merged;
  }

  /**
   * Preliminary relevance filtering on the candidate pool (20-40 chunks).
   * Drops candidates with negligible combined rank scores before MMR.
   */
  public static preliminaryFilter(
    candidates: RetrievalCandidate[],
    maxCandidates: number = 20
  ): RetrievalCandidate[] {
    if (candidates.length <= maxCandidates) return candidates;
    return candidates.slice(0, maxCandidates);
  }

  /**
   * Maximal Marginal Relevance (MMR) for candidate diversity.
   * Balances relevance to query with diversity against already selected passages.
   * 
   * Score = λ * Sim(q, d) - (1 - λ) * max(Sim(d, d_selected))
   */
  public static mmrDiversity(
    candidates: RetrievalCandidate[],
    queryVector: number[],
    limit: number = 8,
    customLambda?: number
  ): RetrievalCandidate[] {
    if (candidates.length <= limit) return candidates;

    const lambda = customLambda ?? this.MMR_LAMBDA;
    const selected: RetrievalCandidate[] = [];
    const remaining = [...candidates];

    // Pick top candidate first
    selected.push(remaining.shift()!);

    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = -1;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candVector = candidate.chunk.embedding;

        // Similarity to query
        const querySim = candVector
          ? EmbeddingService.cosineSimilarity(queryVector, candVector)
          : candidate.rrfScore || 0;

        // Max similarity to already selected chunks
        let maxSelectedSim = 0;
        if (candVector) {
          for (const sel of selected) {
            if (sel.chunk.embedding) {
              const sim = EmbeddingService.cosineSimilarity(candVector, sel.chunk.embedding);
              if (sim > maxSelectedSim) maxSelectedSim = sim;
            }
          }
        }

        const mmrScore = lambda * querySim - (1 - lambda) * maxSelectedSim;

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        selected.push(remaining.splice(bestIdx, 1)[0]);
      } else {
        break;
      }
    }

    return selected;
  }
}
