import {
  IEmbeddingProvider,
  IRerankerProvider,
  ILLMProvider,
} from './interfaces';
import {
  DeterministicEmbeddingProvider,
  OpenAIEmbeddingProvider,
  GeminiEmbeddingProvider,
  QwenEmbeddingProvider,
} from './embeddingProviders';
import {
  LocalNeuralRerankerProvider,
  QwenRerankerProvider,
} from './rerankerProviders';
import {
  GeminiLLMProvider,
  QwenLLMProvider,
} from './llmProviders';
import { config } from '../../../config';

export class RAGProviderFactory {
  private static embeddingProvider: IEmbeddingProvider | null = null;
  private static rerankerProvider: IRerankerProvider | null = null;
  private static llmProvider: ILLMProvider | null = null;

  public static getEmbeddingProvider(): IEmbeddingProvider {
    if (this.embeddingProvider) return this.embeddingProvider;

    const requested = (process.env.RAG_EMBEDDING_PROVIDER || '').toLowerCase();
    if (requested === 'qwen' || requested === 'qwen3') {
      this.embeddingProvider = new QwenEmbeddingProvider();
    } else if (requested === 'gemini' || (config.gemini.isConfigured && requested !== 'openai')) {
      this.embeddingProvider = new GeminiEmbeddingProvider();
    } else if (requested === 'openai' && config.openai.apiKey) {
      this.embeddingProvider = new OpenAIEmbeddingProvider();
    } else {
      this.embeddingProvider = new DeterministicEmbeddingProvider();
    }

    return this.embeddingProvider;
  }

  public static getRerankerProvider(): IRerankerProvider {
    if (this.rerankerProvider) return this.rerankerProvider;

    const requested = (process.env.RAG_RERANKER_PROVIDER || '').toLowerCase();
    if (requested === 'qwen' || requested === 'qwen3') {
      this.rerankerProvider = new QwenRerankerProvider();
    } else {
      this.rerankerProvider = new LocalNeuralRerankerProvider();
    }

    return this.rerankerProvider;
  }

  public static getLLMProvider(): ILLMProvider {
    if (this.llmProvider) return this.llmProvider;

    const requested = (process.env.RAG_LLM_PROVIDER || '').toLowerCase();
    if (requested === 'qwen' || requested === 'qwen3') {
      this.llmProvider = new QwenLLMProvider();
    } else {
      this.llmProvider = new GeminiLLMProvider();
    }

    return this.llmProvider;
  }

  public static setEmbeddingProvider(provider: IEmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  public static setRerankerProvider(provider: IRerankerProvider): void {
    this.rerankerProvider = provider;
  }

  public static setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  public static getActiveProvidersInfo(): {
    embedding: {
      requested: string;
      activeProvider: string;
      activeModel: string;
      dimension: number;
      isFallback: boolean;
      status: string;
    };
    reranker: {
      requested: string;
      activeProvider: string;
      activeModel: string;
      isFallback: boolean;
      status: string;
    };
    llm: {
      requested: string;
      activeProvider: string;
      activeModel: string;
      isFallback: boolean;
      status: string;
    };
  } {
    const emb = this.getEmbeddingProvider();
    const rerank = this.getRerankerProvider();
    const llm = this.getLLMProvider();

    const embReq = (process.env.RAG_EMBEDDING_PROVIDER || config.rag?.embeddingProvider || 'qwen').toLowerCase();
    const rerankReq = (process.env.RAG_RERANKER_PROVIDER || config.rag?.rerankerProvider || 'qwen').toLowerCase();
    const llmReq = (process.env.RAG_LLM_PROVIDER || config.rag?.llmProvider || 'qwen').toLowerCase();

    const isEmbFallback = emb.name === 'deterministic_fallback' || (emb as any).lastStatus === 'offline_fallback';
    const isRerankFallback = rerank.name === 'local-neural-reranker' || (rerank as any).lastStatus === 'offline_fallback';
    const isLLMFallback = (llm as any).lastStatus === 'offline_fallback';

    return {
      embedding: {
        requested: embReq,
        activeProvider: emb.name,
        activeModel: emb.model,
        dimension: emb.dimension,
        isFallback: isEmbFallback,
        status: isEmbFallback ? 'Fallback (Deterministic / Offline)' : 'Reachable / Active',
      },
      reranker: {
        requested: rerankReq,
        activeProvider: isRerankFallback ? 'Fallback (LocalNeuralCrossEncoder)' : rerank.name,
        activeModel: rerank.model,
        isFallback: isRerankFallback,
        status: isRerankFallback ? 'Port 8000 Offline -> Active: LocalNeuralCrossEncoder' : 'Port 8000 Reachable / Active',
      },
      llm: {
        requested: llmReq,
        activeProvider: llm.name,
        activeModel: llm.model,
        isFallback: isLLMFallback,
        status: isLLMFallback ? 'Local Ollama Offline / Fallback' : 'Reachable / Active',
      },
    };
  }
}
