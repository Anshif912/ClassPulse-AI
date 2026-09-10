import { IEmbeddingProvider } from './interfaces';
import { config } from '../../../config';
import { EmbeddingService } from '../embeddingService';

export class DeterministicEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'deterministic_fallback';
  public readonly model = 'deterministic-3072-v1';
  public readonly dimension = 3072;

  public async embedText(text: string): Promise<number[]> {
    return EmbeddingService.generateDeterministicTestOnlyVector(text);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => EmbeddingService.generateDeterministicTestOnlyVector(t));
  }
}

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'openai';
  public readonly model = 'text-embedding-3-large';
  public readonly dimension = 3072;

  public async embedText(text: string): Promise<number[]> {
    if (!config.openai.apiKey || !config.openai.apiKey.startsWith('sk-')) {
      return EmbeddingService.generateDeterministicTestOnlyVector(text);
    }
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
        dimensions: this.dimension,
      }),
    });
    const data: any = await res.json();
    const vec = data.data[0].embedding;
    return EmbeddingService.normalize(vec);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    return results;
  }
}

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'gemini';
  public readonly model = 'text-embedding-004';
  public readonly dimension = 768;

  public async embedText(text: string): Promise<number[]> {
    if (!config.gemini.apiKey) {
      return EmbeddingService.normalize(EmbeddingService.generateDeterministicTestOnlyVector(text).slice(0, 768));
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${config.gemini.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
        }),
      });
      const data: any = await res.json();
      if (data?.embedding?.values) {
        return EmbeddingService.normalize(data.embedding.values);
      }
    } catch {
      // Fallback
    }
    return EmbeddingService.normalize(EmbeddingService.generateDeterministicTestOnlyVector(text).slice(0, 768));
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    return results;
  }
}

/**
 * Local Qwen3-Embedding-0.6B Provider
 * High multilingual accuracy (100+ languages) with 1024-dimensional normalized embeddings.
 * Connects to local neural service endpoint: http://127.0.0.1:8000/v1/embeddings
 */
export interface BatchProgressInfo {
  material?: string;
  batchNumber: number;
  totalBatches: number;
  batchSize: number;
  successfulChunks: number;
  failedChunks: number;
  retryCount: number;
  isRetry?: boolean;
}

export class QwenEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'qwen';
  public readonly model: string;
  public dimension: number = 1024;
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' | 'error' = 'online';

  public get batchSize(): number {
    return parseInt(process.env.QWEN_EMBEDDING_BATCH_SIZE || '4', 10);
  }

  public get timeoutMs(): number {
    return parseInt(process.env.QWEN_EMBEDDING_TIMEOUT_MS || '60000', 10);
  }

  public get maxRetries(): number {
    return parseInt(process.env.QWEN_EMBEDDING_MAX_RETRIES || '2', 10);
  }

  constructor(endpoint?: string, model?: string) {
    this.endpoint = endpoint || config.rag.localEmbeddingUrl || 'http://127.0.0.1:8000/v1/embeddings';
    this.model = model || config.rag.localEmbeddingModel || 'Qwen/Qwen3-Embedding-0.6B';
  }

  public async embedText(text: string, isQuery: boolean = false): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Array(this.dimension).fill(0);
    }

    let lastError: any = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = Math.pow(2, attempt - 1) * 500;
          await new Promise((r) => setTimeout(r, backoff));
        }

        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            model: this.model,
            input: [cleanText],
            is_query: isQuery,
            instruction: isQuery ? 'Given a search query, retrieve relevant passages that answer the query' : undefined,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          this.lastStatus = 'error';
          throw new Error(`Qwen Embedding HTTP ${res.status}: ${errText}`);
        }

        const data: any = await res.json();
        let rawVector: number[] | undefined;

        if (data?.data && Array.isArray(data.data) && data.data[0]?.embedding) {
          rawVector = data.data[0].embedding;
        } else if (data?.embedding && Array.isArray(data.embedding)) {
          rawVector = data.embedding;
        }

        if (!rawVector || !Array.isArray(rawVector)) {
          this.lastStatus = 'error';
          throw new Error(`Invalid response format from Qwen embedding endpoint: ${JSON.stringify(data)}`);
        }

        if (rawVector.length !== this.dimension) {
          this.lastStatus = 'error';
          throw new Error(
            `Embedding dimension mismatch: expected ${this.dimension}, got ${rawVector.length} from ${this.model}`
          );
        }

        this.lastStatus = 'online';
        return EmbeddingService.normalize(rawVector);
      } catch (err: any) {
        lastError = err;
        this.lastStatus = 'error';
      }
    }

    throw new Error(`[QWEN_EMBEDDING_FAILED] Endpoint=${this.endpoint} Model=${this.model}: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Internal recursive helper to embed a sub-batch with retry and automatic batch splitting.
   */
  private async embedSubBatchWithRetry(
    slice: string[],
    isQuery: boolean,
    materialName?: string,
    onRetry?: () => void
  ): Promise<number[][]> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          onRetry?.();
          const backoff = Math.pow(2, attempt - 1) * 500;
          console.warn(`[QWEN_EMBEDDING] Retrying batch (size: ${slice.length}, attempt: ${attempt}/${this.maxRetries}, material: "${materialName || 'N/A'}") after ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
        }

        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            model: this.model,
            input: slice,
            is_query: isQuery,
            instruction: isQuery ? 'Given a search query, retrieve relevant passages that answer the query' : undefined,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          this.lastStatus = 'error';
          throw new Error(`Qwen Embedding Batch HTTP ${res.status}: ${errText}`);
        }

        const data: any = await res.json();
        if (!data?.data || !Array.isArray(data.data)) {
          this.lastStatus = 'error';
          throw new Error(`Invalid batch response format from Qwen embedding: ${JSON.stringify(data)}`);
        }

        const batchVectors: number[][] = [];
        for (let idx = 0; idx < data.data.length; idx++) {
          const vec = data.data[idx].embedding;
          if (!Array.isArray(vec) || vec.length !== this.dimension) {
            throw new Error(
              `Embedding dimension mismatch at index ${idx}: expected ${this.dimension}, got ${vec?.length}`
            );
          }
          batchVectors.push(EmbeddingService.normalize(vec));
        }

        return batchVectors;
      } catch (err: any) {
        lastError = err;
        this.lastStatus = 'error';
      }
    }

    // If batch failed after retries and slice has multiple items, split the batch into halves
    if (slice.length > 1) {
      const mid = Math.floor(slice.length / 2);
      console.warn(`[QWEN_EMBEDDING] Batch of size ${slice.length} failed. Splitting into ${mid} and ${slice.length - mid} items...`);
      const leftSlice = slice.slice(0, mid);
      const rightSlice = slice.slice(mid);

      const leftVectors = await this.embedSubBatchWithRetry(leftSlice, isQuery, materialName, onRetry);
      const rightVectors = await this.embedSubBatchWithRetry(rightSlice, isQuery, materialName, onRetry);

      return [...leftVectors, ...rightVectors];
    }

    // Single chunk failure
    throw new Error(`[QWEN_EMBEDDING_BATCH_FAILED] Endpoint=${this.endpoint} Model=${this.model}: ${lastError?.message || 'Unknown error'}`);
  }

  public async embedBatch(
    texts: string[],
    isQuery: boolean = false,
    options?: {
      materialName?: string;
      onProgress?: (progress: BatchProgressInfo) => void;
    }
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const effectiveBatchSize = this.batchSize;
    const totalBatches = Math.ceil(texts.length / effectiveBatchSize);
    const allVectors: number[][] = [];
    let successfulChunks = 0;
    let failedChunks = 0;
    let totalRetries = 0;

    for (let i = 0; i < texts.length; i += effectiveBatchSize) {
      const slice = texts.slice(i, i + effectiveBatchSize);
      const batchNumber = Math.floor(i / effectiveBatchSize) + 1;

      try {
        const batchVectors = await this.embedSubBatchWithRetry(
          slice,
          isQuery,
          options?.materialName,
          () => { totalRetries++; }
        );

        allVectors.push(...batchVectors);
        successfulChunks += slice.length;

        if (options?.onProgress) {
          options.onProgress({
            material: options.materialName,
            batchNumber,
            totalBatches,
            batchSize: slice.length,
            successfulChunks,
            failedChunks,
            retryCount: totalRetries,
          });
        }
      } catch (err: any) {
        failedChunks += slice.length;
        if (options?.onProgress) {
          options.onProgress({
            material: options.materialName,
            batchNumber,
            totalBatches,
            batchSize: slice.length,
            successfulChunks,
            failedChunks,
            retryCount: totalRetries,
          });
        }
        throw err;
      }
    }

    this.lastStatus = 'online';
    return allVectors;
  }
}

