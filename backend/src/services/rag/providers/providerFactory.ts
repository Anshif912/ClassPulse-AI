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

    const requested = (process.env.RAG_EMBEDDING_PROVIDER || config.rag?.embeddingProvider || 'qwen').toLowerCase();
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

    const requested = (process.env.RAG_RERANKER_PROVIDER || config.rag?.rerankerProvider || 'qwen').toLowerCase();
    if (requested === 'qwen' || requested === 'qwen3') {
      this.rerankerProvider = new QwenRerankerProvider();
    } else {
      this.rerankerProvider = new LocalNeuralRerankerProvider();
    }

    return this.rerankerProvider;
  }

  public static getLLMProvider(): ILLMProvider {
    if (this.llmProvider) return this.llmProvider;

    const requested = (process.env.RAG_LLM_PROVIDER || config.rag?.llmProvider || 'qwen').toLowerCase();
    if (requested === 'qwen' || requested === 'qwen3') {
      this.llmProvider = new QwenLLMProvider();
    } else if (requested === 'gemini' && config.gemini.apiKey) {
      this.llmProvider = new GeminiLLMProvider();
    } else {
      this.llmProvider = new QwenLLMProvider();
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

    const embStatus = (emb as any).lastStatus || 'online';
    const rerankStatus = (rerank as any).lastStatus || 'online';
    const llmStatus = (llm as any).lastStatus || 'online';

    const isEmbFallback = emb.name === 'deterministic_fallback' || embStatus === 'offline_fallback' || embStatus === 'error';
    const isRerankFallback = rerank.name === 'local-neural-reranker' || rerankStatus === 'offline_fallback' || rerankStatus === 'error';
    const isLLMFallback = llmStatus === 'offline_fallback' || llmStatus === 'error';

    return {
      embedding: {
        requested: embReq,
        activeProvider: emb.name,
        activeModel: emb.model,
        dimension: emb.dimension,
        isFallback: isEmbFallback,
        status: embStatus === 'online' ? 'READY (Qwen3-Embedding-0.6B / 1024d)' : `OFFLINE / ERROR (${embStatus})`,
      },
      reranker: {
        requested: rerankReq,
        activeProvider: rerank.name,
        activeModel: rerank.model,
        isFallback: isRerankFallback,
        status: rerankStatus === 'online' ? 'READY (Qwen3-Reranker-0.6B / Neural Cross-Encoder)' : `OFFLINE / ERROR (${rerankStatus})`,
      },
      llm: {
        requested: llmReq,
        activeProvider: llm.name,
        activeModel: llm.model,
        isFallback: isLLMFallback,
        status: llmStatus === 'online' ? 'READY (qwen3:4b Ollama)' : `OFFLINE / ERROR (${llmStatus})`,
      },
    };
  }
}
