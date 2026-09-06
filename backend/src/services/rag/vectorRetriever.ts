import { RAGChunk, RetrievalCandidate } from './types';
import { EmbeddingService } from './embeddingService';

export class VectorRetriever {
  /**
   * Performs dense vector retrieval strictly scoped to the authorized classId.
   */
  public search(
    queryVector: number[],
    chunks: RAGChunk[],
    classId: string,
    topK: number = 20
  ): RetrievalCandidate[] {
    // 1. Strict pre-filtering by authorized classId
    const classChunks = chunks.filter(
      (c) => c.metadata.classId.toUpperCase() === classId.toUpperCase() && c.embedding
    );

    if (classChunks.length === 0) return [];

    const scored: Array<{ chunk: RAGChunk; score: number }> = [];

    for (const chunk of classChunks) {
      if (!chunk.embedding) continue;
      const score = EmbeddingService.cosineSimilarity(queryVector, chunk.embedding);
      scored.push({ chunk, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item, idx) => ({
      chunk: item.chunk,
      vectorScore: item.score,
      vectorRank: idx + 1,
    }));
  }
}
