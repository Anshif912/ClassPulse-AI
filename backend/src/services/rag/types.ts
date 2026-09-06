// ──────────────────────────────────────────────────────────────────────────────
// ClassPulse RAG 2.0 Types & Contracts
// ──────────────────────────────────────────────────────────────────────────────

export type LanguageCode = 'en' | 'ta' | 'hi' | 'tanglish';

export type EvidenceState = 'STRONG_EVIDENCE' | 'WEAK_EVIDENCE' | 'NO_EVIDENCE';

export interface EmbeddingConfig {
  provider: 'openai' | 'custom';
  model: string;
  dimensions: number;
  normalization: 'L2';
  version: string;
}

export interface ChunkMetadata {
  chunkId: string;
  materialId: string;
  classId: string;
  teacherId?: string;
  title: string;
  filename?: string;
  pageStart: number;
  pageEnd: number;
  sectionTitle?: string;
  unit?: string;
  chunkIndex: number;
  tokenCount: number;
  language: LanguageCode;
  createdAt: string;
  embeddingModel: string;
  embeddingDimension: number;
  embeddingVersion: string;
  contentHash: string; // SHA-256 of text
}

export interface RAGChunk {
  metadata: ChunkMetadata;
  text: string;
  embedding?: number[];
}

export interface RetrievalCandidate {
  chunk: RAGChunk;
  lexicalScore?: number;
  lexicalRank?: number;
  vectorScore?: number;
  vectorRank?: number;
  rrfScore?: number;
  rerankScore?: number;
}

export type UserIntent =
  | 'GREETING'
  | 'CASUAL'
  | 'GOODBYE'
  | 'COMMAND'
  | 'FACT'
  | 'EXPLANATION'
  | 'WHY'
  | 'HOW'
  | 'EXAMPLE'
  | 'DEFINITION'
  | 'EVALUATION'
  | 'COMPARISON'
  | 'FOLLOW_UP'
  | 'OUT_OF_SCOPE';

export interface QueryTransformation {
  originalQuery: string;
  retrievalQuery: string;
  detectedLanguage: LanguageCode;
  intent: UserIntent;
  targetEntities?: string[];
  isFollowUp: boolean;
  expandedVariants: string[];
}

export interface RAGLatencyMetrics {
  languageDetectionMs: number;
  queryTransformMs: number;
  embeddingMs: number;
  lexicalSearchMs: number;
  vectorSearchMs: number;
  fusionMs: number;
  rerankMs: number;
  compressionMs: number;
  llmGenerationMs: number;
  totalMs: number;
}

export interface RAGDiagnostics {
  originalQuery: string;
  retrievalQuery: string;
  detectedLanguage: LanguageCode;
  bm25TopCandidates: Array<{ chunkId: string; page: number; score: number }>;
  vectorTopCandidates: Array<{ chunkId: string; page: number; score: number }>;
  rrfCandidates: Array<{ chunkId: string; page: number; score: number }>;
  mmrSelectedChunks: Array<{ chunkId: string; page: number }>;
  rerankScores: Array<{ chunkId: string; page: number; score: number; state: EvidenceState }>;
  finalSelectedChunks: Array<{ chunkId: string; title: string; page: number; snippet: string }>;
  evidenceState: EvidenceState;
  latency: RAGLatencyMetrics;
}

export interface RAGSourceCitation {
  materialId: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  citationText: string; // e.g. "📘 Newton_Laws.pdf · p.3"
}

export interface RAGQueryResult {
  answerText: string;
  spokenText: string;
  evidenceState: EvidenceState;
  detectedLanguage: LanguageCode;
  sources: RAGSourceCitation[];
  diagnostics?: RAGDiagnostics;
  isEducational: boolean;
  topic?: string;
}
