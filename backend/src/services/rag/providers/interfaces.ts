export interface EmbeddingResult {
  vector: number[];
  dimension: number;
  model: string;
  provider: string;
}

export interface IEmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface ScoredEvidence {
  chunkId: string;
  score: number;
  explanation?: string;
}

export interface IRerankerProvider {
  readonly name: string;
  readonly model: string;
  rerank(
    query: string,
    candidates: Array<{ chunkId: string; text: string; initialScore?: number }>
  ): Promise<ScoredEvidence[]>;
}

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  language?: string;
  timeoutMs?: number;
}

export interface LLMResponse {
  text: string;
  tokensUsed?: number;
  model: string;
  provider: string;
}

export interface ILLMProvider {
  readonly name: string;
  readonly model: string;
  generateAnswer(
    query: string,
    context: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;
}

export interface VoiceStreamOptions {
  languageCode?: string;
  sampleRate?: number;
}

export interface IVoiceProvider {
  readonly name: string;
  processAudioStream(audioBuffer: Buffer, options?: VoiceStreamOptions): Promise<string>;
}
