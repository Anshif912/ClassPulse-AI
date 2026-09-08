import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory, project root, and process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  agora: {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
    customerId: process.env.AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.AGORA_CUSTOMER_SECRET || '',
    isConfigured: Boolean(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE),
    isRecordingConfigured: Boolean(
      process.env.AGORA_APP_ID &&
      process.env.AGORA_CUSTOMER_ID &&
      process.env.AGORA_CUSTOMER_SECRET
    ),
  },
  recording: {
    vendor: parseInt(process.env.AGORA_RECORDING_STORAGE_VENDOR || '1', 10), // 1 = S3, 6 = GCS
    region: parseInt(process.env.AGORA_RECORDING_STORAGE_REGION || '0', 10),
    bucket: process.env.AGORA_RECORDING_STORAGE_BUCKET || '',
    accessKey: process.env.AGORA_RECORDING_STORAGE_ACCESS_KEY || '',
    secretKey: process.env.AGORA_RECORDING_STORAGE_SECRET_KEY || '',
    isStorageConfigured: Boolean(
      process.env.AGORA_RECORDING_STORAGE_BUCKET &&
      process.env.AGORA_RECORDING_STORAGE_ACCESS_KEY &&
      process.env.AGORA_RECORDING_STORAGE_SECRET_KEY
    ),
  },
  webhook: {
    secret: process.env.CLASSPULSE_WEBHOOK_SECRET || 'classpulse_default_secret_key',
    publicUrl: (process.env.CLASSPULSE_PUBLIC_URL || '').replace(/\/$/, ''),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  gemini: {
    apiKey: (process.env.GEMINI_API_KEY || '').trim(),
    isConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
  },
  rag: {
    embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER || 'qwen').toLowerCase(),
    rerankerProvider: (process.env.RAG_RERANKER_PROVIDER || 'qwen').toLowerCase(),
    llmProvider: (process.env.RAG_LLM_PROVIDER || 'qwen').toLowerCase(),
    localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL || 'http://127.0.0.1:11434/api/embeddings',
    localRerankerUrl: process.env.LOCAL_RERANKER_URL || 'http://127.0.0.1:8000/v1/rerank',
    localLlmUrl: process.env.LOCAL_LLM_URL || 'http://127.0.0.1:11434/api/generate',
    localEmbeddingModel: process.env.LOCAL_EMBEDDING_MODEL || 'nomic-embed-text:latest',
    localLlmModel: process.env.LOCAL_LLM_MODEL || 'qwen2.5:3b',
  },
  cors: {
    origin: '*',
  },
};
