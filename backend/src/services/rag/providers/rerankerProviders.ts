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
 * High multilingual accuracy (100+ languages) with low memory footprint (~1.2GB VRAM).
 * Uses true CrossEncoder neural inference on http://127.0.0.1:8000/v1/rerank.
 */
export class QwenRerankerProvider implements IRerankerProvider {
  public readonly name = 'qwen';
  public readonly model: string;
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' | 'error' = 'online';

  constructor(endpoint?: string, model?: string) {
    this.endpoint = endpoint || config.rag?.localRerankerUrl || 'http://127.0.0.1:8000/v1/rerank';
    this.model = model || config.rag?.localRerankerModel || 'Qwen/Qwen3-Reranker-0.6B';
  }

  public async rerank(
    query: string,
    candidates: Array<{ chunkId: string; text: string; initialScore?: number }>
  ): Promise<ScoredEvidence[]> {
    if (candidates.length === 0) return [];

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: this.model,
          query,
          documents: candidates.map((c) => c.text),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.lastStatus = 'error';
        throw new Error(`Qwen Reranker HTTP ${res.status}: ${errText}`);
      }

      const data: any = await res.json();
      if (!data?.results || !Array.isArray(data.results)) {
        this.lastStatus = 'error';
        throw new Error(`Invalid response format from Qwen reranker: ${JSON.stringify(data)}`);
      }

      this.lastStatus = 'online';
      return data.results.map((r: any) => ({
        chunkId: candidates[r.index]?.chunkId || String(r.index),
        score: typeof r.relevance_score === 'number' ? r.relevance_score : 0,
      }));
    } catch (err: any) {
      this.lastStatus = 'error';
      throw new Error(`[QWEN_RERANKER_FAILED] Endpoint=${this.endpoint} Model=${this.model}: ${err.message}`);
    }
  }
}
