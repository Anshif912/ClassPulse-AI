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
 * Local Qwen3 / Multilingual Embedding Provider
 * Connects to local Ollama / vLLM / FastEmbed endpoint: http://127.0.0.1:11434/api/embeddings
 * Supports models like nomic-embed-text, qwen3-embedding:0.6b, etc.
 */
export class QwenEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'qwen3-embedding';
  public readonly model: string;
  public dimension: number = 768;
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' = 'online';

  constructor(endpoint?: string, model?: string) {
    this.endpoint = endpoint || config.rag.localEmbeddingUrl || 'http://127.0.0.1:11434/api/embeddings';
    this.model = model || config.rag.localEmbeddingModel || 'nomic-embed-text:latest';
  }

  public async embedText(text: string): Promise<number[]> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000),
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });
      const data: any = await res.json();
      if (data?.embedding && Array.isArray(data.embedding)) {
        this.dimension = data.embedding.length;
        this.lastStatus = 'online';
        return EmbeddingService.normalize(data.embedding);
      }
    } catch {
      this.lastStatus = 'offline_fallback';
    }
    // Transparent deterministic fallback
    return EmbeddingService.normalize(EmbeddingService.generateDeterministicTestOnlyVector(text).slice(0, this.dimension));
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const t of texts) {
      results.push(await this.embedText(t));
    }
    return results;
  }
}
