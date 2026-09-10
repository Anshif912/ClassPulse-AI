import assert from 'assert';
import { EmbeddingService } from '../services/rag/embeddingService';
import { syncRAGRepositoryOnBoot } from '../services/rag/ragBootSync';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { QwenEmbeddingProvider } from '../services/rag/providers/embeddingProviders';
import { dbService } from '../services/db.service';

async function runHardeningVerification() {
  console.log('================================================================');
  console.log('  CLASSPULSE RAG EMBEDDING HARDENING & RELIABILITY VERIFICATION  ');
  console.log('================================================================\n');

  // --- 1. Health & Environment Inspection ---
  console.log('--- 1. INSPECTING LOCAL EMBEDDING SERVICE HEALTH ---');
  let health: any = null;
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    health = await res.json();
  } catch (err: any) {
    console.error('Failed to connect to local neural service on http://127.0.0.1:8000/health:', err.message);
    process.exit(1);
  }

  console.log(`[SERVICE_HEALTH] Status:         ${health.status}`);
  console.log(`[SERVICE_HEALTH] Device:         ${health.device}`);
  console.log(`[SERVICE_HEALTH] CUDA Available: ${health.gpu?.cuda_available}`);
  console.log(`[SERVICE_HEALTH] GPU Name:       ${health.gpu?.name}`);
  console.log(`[SERVICE_HEALTH] Embedding:      ${health.embedding?.model} (${health.embedding?.dimension}d)`);
  console.log(`[SERVICE_HEALTH] Reranker:       ${health.reranker?.model}`);

  assert.strictEqual(health.embedding?.model, 'Qwen/Qwen3-Embedding-0.6B');
  assert.strictEqual(health.embedding?.dimension, 1024);

  // --- 2. Configuration & Batching Defaults ---
  console.log('\n--- 2. VERIFYING CONFIGURABLE BATCHING & TIMEOUT PARAMETERS ---');
  const provider = new QwenEmbeddingProvider();
  console.log(`[CONFIG] Batch Size:    ${provider.batchSize} (Env: ${process.env.QWEN_EMBEDDING_BATCH_SIZE || 'default'})`);
  console.log(`[CONFIG] Timeout MS:    ${provider.timeoutMs}ms (Env: ${process.env.QWEN_EMBEDDING_TIMEOUT_MS || 'default'})`);
  console.log(`[CONFIG] Max Retries:   ${provider.maxRetries} (Env: ${process.env.QWEN_EMBEDDING_MAX_RETRIES || 'default'})`);

  assert.strictEqual(provider.batchSize, 4);
  assert.strictEqual(provider.timeoutMs, 60000);
  assert.strictEqual(provider.maxRetries, 2);

  // --- 3. Batch Ingestion, Splitting & Progress Visibility ---
  console.log('\n--- 3. TESTING BATCH INGESTION, RETRY & PROGRESS VISIBILITY ---');
  const testTexts = [
    'Newton First Law states that every object will remain at rest or in uniform motion unless acted upon by an external force.',
    'Inertia is the natural tendency of objects in motion to stay in motion and objects at rest to stay at rest.',
    'Balanced forces produce no acceleration, whereas unbalanced net forces cause a change in velocity.',
    'Newton Second Law relates net force to mass and acceleration through the fundamental equation F = ma.',
    'Heavier objects have greater inertia and therefore accelerate less under the application of an equal force.',
    'Momentum is defined as the product of mass and velocity (p = mv) and is conserved in isolated systems.',
    'Newton Third Law states that whenever one object exerts a force on a second object, the second object exerts an equal and opposite force on the first.',
    'Action-reaction forces never cancel each other because they act on two entirely different physical bodies.',
    'Gravitational force is directly proportional to the product of two masses and inversely proportional to the square of the distance between them.',
    'Normal force is the perpendicular contact force exerted by a surface on an object pressing against it.',
  ];

  let progressCalls = 0;
  const t0Embed = Date.now();
  const embeddings = await provider.embedBatch(testTexts, false, {
    materialName: "Newton's Laws Test Suite",
    onProgress: (p) => {
      progressCalls++;
      console.log(`[PROGRESS_CALLBACK] Batch ${p.batchNumber}/${p.totalBatches} | Size: ${p.batchSize} | Succeeded: ${p.successfulChunks}/${testTexts.length} | Retries: ${p.retryCount}`);
    },
  });
  const embedDurationMs = Date.now() - t0Embed;

  assert.strictEqual(embeddings.length, testTexts.length);
  assert.strictEqual(progressCalls, 3); // 10 texts / batch size 4 = 3 batches
  for (let i = 0; i < embeddings.length; i++) {
    assert.strictEqual(embeddings[i].length, 1024, `Vector ${i} must have 1024 dimensions`);
    // Check L2 normalization
    const norm = Math.sqrt(embeddings[i].reduce((sum, v) => sum + v * v, 0));
    assert(Math.abs(norm - 1.0) < 1e-3, `Vector ${i} must be normalized to unit length`);
  }
  console.log(`[BATCH_SUCCESS] Embedded ${embeddings.length} chunks across 2 batches in ${embedDurationMs}ms (${(embedDurationMs / embeddings.length).toFixed(1)}ms/chunk).`);

  // --- 4. RAG Boot-Sync Idempotency & Lock Protection ---
  console.log('\n--- 4. TESTING BOOT-SYNC CONCURRENCY LOCK & IDEMPOTENCY ---');
  // First run: sync database
  const firstSyncSummary = await syncRAGRepositoryOnBoot();
  console.log(`[FIRST_SYNC] Indexed: ${firstSyncSummary.indexedChunks}, Skipped: ${firstSyncSummary.skippedChunks}, Failed: ${firstSyncSummary.failedChunks}`);

  // Second run: should be 100% idempotent and skip already indexed chunks
  const secondSyncSummary = await syncRAGRepositoryOnBoot();
  console.log(`[SECOND_SYNC] Indexed: ${secondSyncSummary.indexedChunks}, Skipped: ${secondSyncSummary.skippedChunks}, Failed: ${secondSyncSummary.failedChunks}`);
  assert.strictEqual(secondSyncSummary.indexedChunks, 0, 'Second boot sync must not re-embed already indexed chunks');
  assert(secondSyncSummary.skippedChunks > 0, 'Second boot sync must recognize and skip existing chunks');

  // --- 5. Real Material Upload & Ingestion Flow (Newton's Laws of Motion) ---
  console.log("\n--- 5. TESTING REAL MATERIAL UPLOAD FLOW (Newton's Laws of Motion) ---");
  const classId = 'CLASS_PHY101_HARDENING';
  const materialId = `mat_physics_${Date.now()}`;
  const materialTitle = "Newton's Laws of Motion & Classical Mechanics";

  const physicsPages = [
    {
      pageNumber: 1,
      text: `Chapter 1: Introduction to Mechanics and Forces
Forces are vector quantities with magnitude and direction. A balanced force system has a net resultant vector of zero, meaning the object maintains constant velocity (zero acceleration). In contrast, unbalanced forces result in a non-zero net force (F_net != 0), producing linear or rotational acceleration according to Newtonian dynamics.`,
    },
    {
      pageNumber: 2,
      text: `Chapter 2: Newton's First Law of Motion and Inertia
Newton's First Law states: Every body continues in its state of rest or of uniform motion in a straight line unless compelled to change that state by forces impressed upon it. Inertia is quantified by inertial mass. A heavier object possesses greater inertial mass, demanding greater net force to change its state of motion.`,
    },
    {
      pageNumber: 3,
      text: `Chapter 3: Newton's Second Law of Motion
Newton's Second Law states: The rate of change of momentum of a body is directly proportional to the applied force and takes place in the direction of the force.
Formula: F = ma (Net Force = Mass * Acceleration).
From a = F / m, for an identical applied force F, acceleration is inversely proportional to mass. Consequently, a heavier object (larger mass m) experiences less acceleration than a lighter object under the exact same force.`,
    },
    {
      pageNumber: 4,
      text: `Chapter 4: Newton's Third Law and Action-Reaction Forces
Newton's Third Law states: To every action there is always an equal and opposite reaction.
Crucial Concept: Action and reaction forces never cancel each other out because they act on two distinct, different objects. For example, when a swimmer pushes against water, the swimmer exerts force F_SW on the water, and the water simultaneously exerts force F_WS on the swimmer. Because each force acts on a different body, neither force cancels the other, enabling forward propulsion.`,
    },
  ];

  const physicsChunks = SemanticChunker.chunkDocument(
    physicsPages,
    classId,
    materialId,
    materialTitle,
    'Newtons_Laws.pdf',
    'prof_newton'
  );

  console.log(`[CHUNK_EXTRACT] Extracted ${physicsChunks.length} semantic chunks from 4 pages.`);
  const physicsEmbeddings = await EmbeddingService.embedBatch(
    physicsChunks.map((c) => c.text),
    false,
    { materialName: materialTitle }
  );

  for (let i = 0; i < physicsChunks.length; i++) {
    physicsChunks[i].embedding = physicsEmbeddings[i];
  }
  ragRepository.addChunks(physicsChunks);
  console.log(`[INDEX_SUCCESS] Indexed ${physicsChunks.length} chunks into class ${classId}.`);

  // --- 6. Grounded Query Retrieval on 4 Specific Questions ---
  console.log('\n--- 6. VERIFYING GROUNDED RETRIEVAL FOR TEST QUESTIONS ---');
  const pipeline = new RAGPipeline();

  const testQuestions = [
    {
      q: "What is Newton's Second Law?",
      expectedKeywords: ['momentum', 'F = ma', 'Second Law', 'acceleration'],
      expectedPage: 3,
    },
    {
      q: 'Why does a heavier object accelerate less under the same force?',
      expectedKeywords: ['inversely proportional', 'mass', 'inertia', 'a = F / m'],
      expectedPage: 3,
    },
    {
      q: 'What is the difference between balanced and unbalanced forces?',
      expectedKeywords: ['balanced', 'unbalanced', 'zero acceleration', 'net force'],
      expectedPage: 1,
    },
    {
      q: "Why don't action-reaction forces cancel each other?",
      expectedKeywords: ['different objects', 'distinct', 'never cancel', 'swimmer'],
      expectedPage: 4,
    },
  ];

  for (let i = 0; i < testQuestions.length; i++) {
    const { q, expectedKeywords, expectedPage } = testQuestions[i];
    console.log(`\n>> Query ${i + 1}: "${q}"`);
    const result = await pipeline.query(q, classId);

    const selectedChunks = result.diagnostics?.finalSelectedChunks || [];
    console.log(`[RESULT] Evidence State: ${result.evidenceState}`);
    console.log(`[RESULT] Selected Chunks: ${selectedChunks.length}`);
    console.log(`[RESULT] Answer Text: "${result.answerText.slice(0, 120)}..."`);
    assert(selectedChunks.length > 0, `Query "${q}" must return at least 1 selected chunk`);

    const topChunk = selectedChunks[0];
    console.log(`[TOP_CHUNK] Page ${topChunk.page} (${topChunk.title})`);
    console.log(`[SNIPPET] "${topChunk.snippet.slice(0, 150)}..."`);

    // Verify embedding dimension of chunk in repository
    const repoChunk = ragRepository.getChunk(topChunk.chunkId);
    assert.strictEqual(repoChunk?.embedding?.length, 1024, 'Retrieved chunk vector must be 1024 dimensions');

    // Check keyword presence in top retrieved chunks or answer
    const combinedText = (selectedChunks.map((c: any) => c.text || c.snippet).join(' ') + ' ' + result.answerText).toLowerCase();
    const matchedKeywords = expectedKeywords.filter((kw) => combinedText.includes(kw.toLowerCase()));
    console.log(`[GROUNDING] Matched Keywords: [${matchedKeywords.join(', ')}] (Expected: [${expectedKeywords.join(', ')}])`);
    assert(matchedKeywords.length >= 2, `Retrieved context must contain key grounding concepts for "${q}"`);
  }

  // --- 7. Dimension Uniformity Audit ---
  console.log('\n--- 7. AUDITING REPOSITORY EMBEDDING DIMENSIONS ---');
  const allRepoChunks = ragRepository.getAllChunks();
  let valid1024Count = 0;
  let mismatchedCount = 0;

  for (const c of allRepoChunks) {
    if (c.embedding && c.embedding.length === 1024) {
      valid1024Count++;
    } else {
      mismatchedCount++;
    }
  }

  console.log(`[DIMENSION_AUDIT] Total Repository Chunks: ${allRepoChunks.length}`);
  console.log(`[DIMENSION_AUDIT] 1024-Dimension Chunks:   ${valid1024Count}`);
  console.log(`[DIMENSION_AUDIT] Mismatched Chunks:       ${mismatchedCount}`);
  assert.strictEqual(mismatchedCount, 0, 'Zero mismatched or stale embedding dimensions allowed in repository');

  console.log('\n================================================================');
  console.log('  ALL RAG EMBEDDING HARDENING VERIFICATIONS PASSED (100% OK)    ');
  console.log('================================================================\n');
}

runHardeningVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
