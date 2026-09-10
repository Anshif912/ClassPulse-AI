import { config } from '../config';
import { RAGProviderFactory } from '../services/rag/providers/providerFactory';
import { EmbeddingService } from '../services/rag/embeddingService';
import { ragPipeline } from '../services/rag/ragPipeline';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';

async function runLiveVerification() {
  console.log('================================================================');
  console.log('   ClassPulse AI - Live Qwen3 Local Model Stack Verification    ');
  console.log('================================================================\n');

  console.log('1. Active Configuration:');
  console.log(`- LLM Provider: ${config.rag.llmProvider} (Model: ${config.rag.localLlmModel}, URL: ${config.rag.localLlmUrl})`);
  console.log(`- Embedding Provider: ${config.rag.embeddingProvider} (Model: ${config.rag.localEmbeddingModel}, URL: ${config.rag.localEmbeddingUrl})`);
  console.log(`- Reranker Provider: ${config.rag.rerankerProvider} (Model: ${config.rag.localRerankerModel}, URL: ${config.rag.localRerankerUrl})`);
  console.log(`- Active Config Dimensions: ${EmbeddingService.DIMENSION}`);

  const activeInfo = RAGProviderFactory.getActiveProvidersInfo();
  console.log('\n2. Factory Provider Diagnostics:');
  console.log(JSON.stringify(activeInfo, null, 2));

  // --- Step 1: Real Embedding Inference ---
  console.log('\n--- Step 1: Live Embedding Test (Qwen3-Embedding-0.6B) ---');
  const sampleQuery = 'Explain second generation computers';
  const t0 = Date.now();
  const queryVector = await EmbeddingService.embedText(sampleQuery, true);
  const embLatency = Date.now() - t0;

  console.log(`- Query: "${sampleQuery}"`);
  console.log(`- Vector Length: ${queryVector.length}`);
  console.log(`- Latency: ${embLatency}ms`);
  console.log(`- First 5 dimensions: [${queryVector.slice(0, 5).map(v => v.toFixed(5)).join(', ')}]`);

  if (queryVector.length !== 1024) {
    throw new Error(`CRITICAL: Expected 1024 dimensions, got ${queryVector.length}`);
  }
  console.log('✅ Embedding 1024d dimension verified!');

  // --- Step 2: Real Reranker Inference ---
  console.log('\n--- Step 2: Live Reranker Test (Qwen3-Reranker-0.6B Neural Cross-Encoder) ---');
  const rerankerQuery = 'Why were transistors better than vacuum tubes?';
  const candidates = [
    { chunkId: 'chk_1', text: 'Second generation computers used transistors and reduced size, heat, and power consumption while increasing reliability.' },
    { chunkId: 'chk_2', text: 'Third generation computers used integrated circuits which combined many transistors onto a single silicon chip.' },
    { chunkId: 'chk_3', text: 'First generation computers used vacuum tubes and generated huge amounts of heat.' },
  ];

  const rerankerProvider = RAGProviderFactory.getRerankerProvider();
  const t1 = Date.now();
  const rerankResults = await rerankerProvider.rerank(rerankerQuery, candidates);
  const rerankLatency = Date.now() - t1;

  console.log(`- Reranker Query: "${rerankerQuery}"`);
  console.log(`- Latency: ${rerankLatency}ms`);
  console.log('- Ranked Results:');
  rerankResults.forEach((r, idx) => {
    const candidate = candidates.find(c => c.chunkId === r.chunkId);
    console.log(`  ${idx + 1}. [Score: ${r.score.toFixed(4)}] Chunk ${r.chunkId}: "${candidate?.text.slice(0, 70)}..."`);
  });

  if (rerankResults[0].chunkId !== 'chk_1') {
    console.warn('⚠️ Warning: Candidate 1 was not ranked #1! Top chunk was:', rerankResults[0].chunkId);
  } else {
    console.log('✅ Neural Cross-Encoder ranked relevant 2nd generation passage #1!');
  }

  // --- Step 3: Real LLM Inference ---
  console.log('\n--- Step 3: Live LLM Generation Test (qwen3:4b via Ollama) ---');
  const llmProvider = RAGProviderFactory.getLLMProvider();
  const testContext = 'Second generation computers (1956-1963) replaced vacuum tubes with transistors. Transistors made computers smaller, faster, cheaper, and more energy-efficient than first-generation computers.';
  const t2 = Date.now();
  const llmResponse = await llmProvider.generateAnswer(
    'What replaced vacuum tubes in second generation computers?',
    testContext,
    { language: 'en', temperature: 0.1, maxTokens: 150 }
  );
  const llmLatency = Date.now() - t2;

  console.log(`- LLM Response Latency: ${llmLatency}ms`);
  console.log(`- Model: ${llmResponse.model}`);
  console.log(`- Response:\n${llmResponse.text}`);
  console.log('✅ LLM Generation verified!');

  // --- Step 4: Multilingual Test Matrix ---
  console.log('\n--- Step 4: Multilingual Test Matrix ---');
  const testClassId = 'CLASS_CS101';
  
  // Seed sample educational material into repository
  const computerNotes = [
    {
      pageNumber: 1,
      text: `Unit 1: Computer Generations & Evolution\n\n1. First Generation (1940-1956): Used vacuum tubes. Large room-sized machines, high electricity consumption, huge heat generation. Example: ENIAC, UNIVAC.\n\n2. Second Generation (1956-1963): Used transistors instead of vacuum tubes. Transistors were much smaller, consumed less power, generated less heat, and were much faster and more reliable. Used magnetic core memory and assembly language.\n\n3. Third Generation (1964-1971): Used Integrated Circuits (ICs). Keyboards and monitors were introduced.\n\n4. Fourth Generation (1971-Present): Used Microprocessors (VLSI/VLSIC). Personal computers (PCs) became widely available.\n\n5. Fifth Generation (Present & Beyond): Based on Artificial Intelligence (AI) and Ultra Large Scale Integration (ULSI).`
    }
  ];

  const chunks = SemanticChunker.chunkDocument(computerNotes, testClassId, 'mat_comp_101', 'Computer Generations');
  const batchEmbeddings = await EmbeddingService.embedBatch(chunks.map(c => c.text), false);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = batchEmbeddings[i];
  }
  ragRepository.addChunks(chunks);
  console.log(`- Seeded ${chunks.length} chunks into class ${testClassId} with 1024d Qwen embeddings.`);

  const multilingualQueries = [
    { lang: 'English', query: 'Explain second generation computers' },
    { lang: 'Tamil', query: 'இரண்டாம் தலைமுறை கணினிகள் பற்றி சொல்லு' },
    { lang: 'Hindi', query: 'दूसरी पीढ़ी के कंप्यूटर के बारे में बताओ' },
    { lang: 'Tanglish', query: 'second generation computers pathi sollu' },
  ];

  for (const item of multilingualQueries) {
    console.log(`\nTesting ${item.lang}: "${item.query}"`);
    const startQ = Date.now();
    const result = await ragPipeline.query(item.query, testClassId);
    const queryDuration = Date.now() - startQ;

    console.log(`- Detected Language: ${result.detectedLanguage}`);
    console.log(`- Evidence State: ${result.evidenceState}`);
    console.log(`- Total Pipeline Duration: ${queryDuration}ms`);
    console.log(`- Answer:\n${result.answerText}\n`);
  }

  console.log('================================================================');
  console.log('       ✅ ALL QWEN3 LOCAL AI MODEL TESTS COMPLETED!             ');
  console.log('================================================================');
}

runLiveVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
