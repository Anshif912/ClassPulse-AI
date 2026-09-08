import { RAGProviderFactory } from '../services/rag/providers/providerFactory';
import { QwenEmbeddingProvider } from '../services/rag/providers/embeddingProviders';
import { QwenRerankerProvider } from '../services/rag/providers/rerankerProviders';
import { QwenLLMProvider } from '../services/rag/providers/llmProviders';

async function checkQwenReality() {
  console.log('--- 8. Qwen Provider Reality Check ---');

  // Check if local Ollama / vLLM is responding
  let ollamaAlive = false;
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags');
    if (res.ok) {
      const data: any = await res.json();
      console.log('Local Ollama endpoint is ACTIVE. Available models:', data.models?.map((m: any) => m.name));
      ollamaAlive = true;
    }
  } catch (err: any) {
    console.log('Local Ollama endpoint (http://127.0.0.1:11434) status: OFFLINE / NOT RUNNING');
  }

  // Check if local reranker server is responding
  let rerankerAlive = false;
  try {
    const res = await fetch('http://127.0.0.1:8000/v1/rerank');
    if (res.ok) rerankerAlive = true;
  } catch {
    console.log('Local Reranker endpoint (http://127.0.0.1:8000) status: OFFLINE / NOT RUNNING');
  }

  const qwenEmbed = new QwenEmbeddingProvider();
  console.log('\nQwen Embedding Provider details:');
  console.log('  Model Name:', qwenEmbed.model);
  console.log('  Target Hardware:', 'RTX 3050 / 4060 (~7-8 GB usable VRAM)');
  console.log('  Dimension:', qwenEmbed.dimension);
  console.log('  Active Mode:', ollamaAlive ? 'LOCAL_GPU_INFERENCE' : 'FALLBACK_DETERMINISTIC_NORM');

  const qwenRerank = new QwenRerankerProvider();
  console.log('\nQwen Reranker Provider details:');
  console.log('  Model Name:', qwenRerank.model);
  console.log('  Active Mode:', rerankerAlive ? 'LOCAL_GPU_INFERENCE' : 'FALLBACK_LOCAL_NEURAL_CROSS_ENCODER');

  const qwenLLM = new QwenLLMProvider();
  console.log('\nQwen LLM Provider details:');
  console.log('  Model Name:', qwenLLM.model);
  console.log('  Active Mode:', ollamaAlive ? 'LOCAL_GPU_INFERENCE' : 'FALLBACK_GROUNDED_SYNTHESIS');
}

checkQwenReality().catch(console.error);
