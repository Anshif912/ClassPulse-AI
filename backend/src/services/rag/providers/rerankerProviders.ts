import { IRerankerProvider, ScoredEvidence } from './interfaces';
import { CrossEncoderReranker } from '../reranker';
import { RetrievalCandidate } from '../types';
import { config } from '../../../config';

export class LocalNeuralRerankerProvider implements IRerankerProvider {
  public readonly name = 'local-neural-reranker';
  public readonly model = 'classpulse-cross-encoder-v2';

  public async rerank(
    query: string,
    candidates: Array<{ chunkId: string; text: string; initialScore?: number }>
  ): Promise<ScoredEvidence[]> {
    const formattedCandidates: RetrievalCandidate[] = candidates.map((c, idx) => ({
      chunk: {
        text: c.text,
        metadata: {
          chunkId: c.chunkId,
          materialId: 'mat',
          classId: 'class',
          title: 'Document',
          pageStart: 1,
          pageEnd: 1,
          chunkIndex: idx,
          tokenCount: 50,
          language: 'en',
          createdAt: new Date().toISOString(),
          embeddingModel: 'text-embedding-3-large',
          embeddingDimension: 3072,
          embeddingVersion: 'v1',
          contentHash: 'hash',
        },
      },
      vectorScore: c.initialScore || 0.5,
      lexicalScore: c.initialScore || 0.5,
      rrfScore: c.initialScore || 0.5,
      rerankScore: 0,
    }));

    const result = CrossEncoderReranker.rerank(query, formattedCandidates, candidates.length);

    return result.ranked.map((c) => ({
      chunkId: c.chunk.metadata.chunkId,
      score: c.rerankScore || 0,
    }));
  }
}

/**
 * Local Qwen3-Reranker-0.6B Provider
 * High multilingual accuracy (100+ languages) with low memory footprint (~1.2GB VRAM)
 * If endpoint (http://127.0.0.1:8000/v1/rerank) is offline, falls back to LocalNeuralRerankerProvider.
 */
export class QwenRerankerProvider implements IRerankerProvider {
  public readonly name = 'qwen3-reranker';
  public readonly model = 'qwen3-reranker-0.6b';
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' = 'online';

  constructor(endpoint?: string) {
    this.endpoint = endpoint || config.rag?.localRerankerUrl || 'http://127.0.0.1:8000/v1/rerank';
  }

  public async rerank(
    query: string,
    candidates: Array<{ chunkId: string; text: string; initialScore?: number }>
  ): Promise<ScoredEvidence[]> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000),
        body: JSON.stringify({
          model: 'qwen3-reranker:0.6b',
          query,
          documents: candidates.map((c) => c.text),
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data?.results)) {
          this.lastStatus = 'online';
          return data.results.map((r: any) => ({
            chunkId: candidates[r.index]?.chunkId || String(r.index),
            score: r.relevance_score || 0,
          }));
        }
      }
    } catch {
      this.lastStatus = 'offline_fallback';
    }

    this.lastStatus = 'offline_fallback';
    const fallback = new LocalNeuralRerankerProvider();
    return fallback.rerank(query, candidates);
  }
}
